# Windows UserNotificationListener - Intercept and Suppress Native Toasts
# Outputs JSON lines over stdout for Cute Pet Companion
param(
    [int]$Suppress = 1,          # 1 = remove the native toast after capturing it
    [int]$ParentPid = 0,         # exit when the Electron app is gone (avoid orphaned pollers)
    [string]$BannerBackup = '',  # JSON file: original ShowBanner values, so they can be restored
    [switch]$RestoreBanners      # restore ShowBanner from $BannerBackup and exit
)

$ErrorActionPreference = 'Stop'

# Spawned hidden by Electron, PowerShell writes stdout in the OEM code page (e.g. 437), which turns
# Vietnamese into "C?m Y". Node reads UTF-8, so force UTF-8 without BOM (a BOM would corrupt line 1).
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

function Emit-JSON($obj) {
    $json = ConvertTo-Json -InputObject $obj -Compress
    [Console]::WriteLine($json)
    [Console]::Out.Flush()
}

# ---------------------------------------------------------------- native toast control
# Removing a toast after capture still lets Windows flash its banner and play its sound. For a full
# replacement we flip the same per-app switches Windows Settings writes, so notifications still
# flow into Action Center (where we read them) but Windows itself shows and plays nothing:
#   ShowBanner = 0 (DWORD)  -> "Show notification banners" off
#   SoundFile  = '' (SZ)    -> "Play a sound when a notification arrives" off
# plus the global NOC_GLOBAL_SETTING_ALLOW_NOTIFICATION_SOUND = 0. The pet plays its own sounds.
# Every original value is saved to $BannerBackup BEFORE it is changed ("<subkey>|<name>" -> value,
# $null = value did not exist) and restored by -RestoreBanners.
$NotifRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings'
$GlobalSound = 'NOC_GLOBAL_SETTING_ALLOW_NOTIFICATION_SOUND'
$origValues = @{}
if ($BannerBackup -and (Test-Path $BannerBackup)) {
    try {
        (Get-Content $BannerBackup -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object {
            # Older backups stored "<aumid>" -> ShowBanner only.
            $k = if ($_.Name.Contains('|')) { $_.Name } else { "$($_.Name)|ShowBanner" }
            $origValues[$k] = $_.Value
        }
    } catch {}
}

function Save-Backup {
    if (-not $BannerBackup) { return }
    $tmp = "$BannerBackup.tmp"
    ConvertTo-Json -InputObject $origValues -Compress | Set-Content -Path $tmp -Encoding UTF8
    Move-Item -Path $tmp -Destination $BannerBackup -Force
}

function Set-NotifValue([string]$subkey, [string]$name, $value, [string]$type) {
    $id = "$subkey|$name"
    $key = if ($subkey) { Join-Path $NotifRoot $subkey } else { $NotifRoot }
    if (-not $origValues.ContainsKey($id)) {
        $orig = $null
        try { $orig = (Get-ItemProperty -Path $key -Name $name -ErrorAction Stop).$name } catch {}
        $origValues[$id] = $orig
        Save-Backup   # persist BEFORE changing anything
    }
    try {
        if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
        New-ItemProperty -Path $key -Name $name -Value $value -PropertyType $type -Force | Out-Null
    } catch {}
}

function Skip-Aumid([string]$aumid) {
    return (-not $aumid) -or $aumid -match 'cutepet|Windows\.ActionCenter'
}

$handledApps = New-Object 'System.Collections.Generic.HashSet[string]'
function Silence-App([string]$aumid) {
    if ((Skip-Aumid $aumid) -or -not $handledApps.Add($aumid)) { return }
    Set-NotifValue $aumid 'ShowBanner' 0 'DWord'
    Set-NotifValue $aumid 'SoundFile' '' 'String'
}

if ($RestoreBanners) {
    foreach ($id in @($origValues.Keys)) {
        $parts = $id.Split('|')
        $subkey = $parts[0]; $name = $parts[1]
        $key = if ($subkey) { Join-Path $NotifRoot $subkey } else { $NotifRoot }
        $orig = $origValues[$id]
        try {
            if ($null -eq $orig) { Remove-ItemProperty -Path $key -Name $name -ErrorAction Stop }
            elseif ($name -eq 'SoundFile') { New-ItemProperty -Path $key -Name $name -Value ([string]$orig) -PropertyType String -Force | Out-Null }
            else { New-ItemProperty -Path $key -Name $name -Value ([int]$orig) -PropertyType DWord -Force | Out-Null }
        } catch {}
    }
    if ($BannerBackup -and (Test-Path $BannerBackup)) { Remove-Item $BannerBackup -Force }
    Emit-JSON @{ type = "banners-restored"; count = $origValues.Count }
    exit 0
}

if ($Suppress -eq 1) {
    Set-NotifValue '' $GlobalSound 0 'DWord'
    # Every app that has ever notified has a key with LastNotificationAddedTime (nested keys for
    # AUMIDs containing backslashes). Apps seen for the first time are handled on capture below.
    $marker = 'Notifications\Settings\'
    try {
        Get-ChildItem -Path $NotifRoot -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            $props = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue
            if ($props -and $null -ne $props.LastNotificationAddedTime) {
                Silence-App ($_.Name.Substring($_.Name.IndexOf($marker) + $marker.Length))
            }
        }
    } catch {}
}

try {
    # WindowsRuntimeSystemExtensions (AsTask) lives in this assembly; it is NOT loaded by default.
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime]
    $null = [Windows.UI.Notifications.KnownNotificationBindings, Windows.UI.Notifications, ContentType = WindowsRuntime]
    $null = [Windows.UI.Notifications.NotificationKinds, Windows.UI.Notifications, ContentType = WindowsRuntime]
    $null = [Windows.UI.Notifications.UserNotification, Windows.UI.Notifications, ContentType = WindowsRuntime]
} catch {
    Emit-JSON @{ type = "error"; message = "Failed to load Windows.UI.Notifications WinRT types: $($_.Exception.Message)" }
    exit 1
}

# PowerShell cannot pick the generic AsTask<T>(IAsyncOperation<T>) overload by itself.
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1

function Await($op, [Type]$resultType) {
    $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($op))
    $null = $task.Wait(-1)
    return $task.Result
}

$listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
if (-not $listener) {
    Emit-JSON @{ type = "error"; message = "UserNotificationListener is not available on this Windows version." }
    exit 1
}

$accessStatus = $listener.GetAccessStatus()
if ($accessStatus -ne [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]::Allowed) {
    try {
        $accessStatus = Await ($listener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
    } catch {
        Emit-JSON @{ type = "log"; message = "RequestAccessAsync failed: $($_.Exception.Message)" }
    }
}
Emit-JSON @{ type = "status"; status = $accessStatus.ToString(); os = "win32" }

$listType = [System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]]
$toastKind = [Windows.UI.Notifications.NotificationKinds]::Toast
$processedIds = New-Object 'System.Collections.Generic.HashSet[uint32]'

# Seed with what is already in Action Center so we don't replay history on startup
try {
    $existing = Await ($listener.GetNotificationsAsync($toastKind)) $listType
    foreach ($n in $existing) { $null = $processedIds.Add($n.Id) }
    Emit-JSON @{ type = "ready"; initialCount = $existing.Count }
} catch {
    Emit-JSON @{ type = "log"; message = "Could not fetch existing notifications: $($_.Exception.Message)" }
}

$tick = 0
while ($true) {
    $tick++
    if ($ParentPid -gt 0 -and ($tick % 16) -eq 0) {
        if (-not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
    }

    try {
        $active = Await ($listener.GetNotificationsAsync($toastKind)) $listType
        $currentIds = New-Object 'System.Collections.Generic.HashSet[uint32]'

        foreach ($notif in $active) {
            $id = $notif.Id
            $null = $currentIds.Add($id)
            if ($processedIds.Contains($id)) { continue }
            $null = $processedIds.Add($id)

            $appName = "Windows"
            $aumid = ""
            try { if ($notif.AppInfo -and $notif.AppInfo.DisplayInfo) { $appName = $notif.AppInfo.DisplayInfo.DisplayName } } catch {}
            try { $aumid = $notif.AppInfo.AppUserModelId } catch {}
            if ($Suppress -eq 1) { Silence-App $aumid }

            $title = ""
            $body = ""
            try {
                $binding = $notif.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
                if ($binding) {
                    $texts = @($binding.GetTextElements() | ForEach-Object { $_.Text })
                    if ($texts.Count -gt 0) { $title = $texts[0] }
                    if ($texts.Count -gt 1) { $body = ($texts[1..($texts.Count - 1)]) -join "`n" }
                }
            } catch {}

            $dismissed = $false
            if ($Suppress -eq 1) {
                try { $listener.RemoveNotification($id); $dismissed = $true } catch {}
            }

            Emit-JSON @{
                type = "notification"
                id = "win_$id"
                rawId = $id
                appName = $appName
                aumid = $aumid
                title = $title
                body = $body
                dismissedNative = $dismissed
                timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            }
        }

        # Forget ids no longer in Action Center (keeps the set bounded without replaying anything)
        $processedIds.IntersectWith($currentIds)
    } catch {
        # Transient COM / WinRT errors can happen during desktop unlock
    }

    Start-Sleep -Milliseconds 250
}
