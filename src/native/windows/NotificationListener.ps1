# Windows UserNotificationListener - Intercept and Suppress Native Toasts
# Outputs JSON lines over stdout for Cute Pet Companion

$ErrorActionPreference = 'SilentlyContinue'

function Emit-JSON($obj) {
    $json = ConvertTo-Json -InputObject $obj -Compress
    [Console]::WriteLine($json)
    [Console]::Out.Flush()
}

try {
    # Load WinRT UserNotificationListener types
    [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.UI.Notifications.KnownNotificationBindings, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.UI.Notifications.NotificationKinds, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
} catch {
    Emit-JSON @{ type = "error"; message = "Failed to load Windows.UI.Notifications WinRT types: $($_.Exception.Message)" }
    exit 1
}

$listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
if (-not $listener) {
    Emit-JSON @{ type = "error"; message = "UserNotificationListener is not available on this Windows version." }
    exit 1
}

$accessStatus = $listener.GetAccessStatus()
Emit-JSON @{ type = "status"; status = $accessStatus.ToString(); os = "win32" }

if ($accessStatus -ne [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]::Allowed) {
    try {
        # Request access asynchronously
        $op = $listener.RequestAccessAsync()
        # Convert IAsyncOperation to task
        $task = [System.WindowsRuntimeSystemExtensions]::AsTask($op)
        $accessStatus = $task.GetAwaiter().GetResult()
        Emit-JSON @{ type = "status"; status = $accessStatus.ToString(); requested = $true }
    } catch {
        Emit-JSON @{ type = "log"; message = "RequestAccessAsync failed: $($_.Exception.Message)" }
    }
}

$processedIds = New-Object 'System.Collections.Generic.HashSet[uint32]'

# Initialize with current notifications so we don't replay history on startup
try {
    $existing = [System.WindowsRuntimeSystemExtensions]::AsTask($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)).GetAwaiter().GetResult()
    foreach ($n in $existing) {
        $null = $processedIds.Add($n.Id)
    }
    Emit-JSON @{ type = "ready"; initialCount = $existing.Count }
} catch {
    Emit-JSON @{ type = "log"; message = "Could not fetch existing notifications: $($_.Exception.Message)" }
}

# Main polling and event loop
while ($true) {
    # Check for stdin commands
    if ([Console]::KeyAvailable) {
        $line = [Console]::ReadLine()
        if ($line) {
            try {
                $cmd = ConvertFrom-Json $line
                if ($cmd.action -eq "ping") {
                    Emit-JSON @{ type = "pong"; status = $listener.GetAccessStatus().ToString() }
                } elseif ($cmd.action -eq "quit") {
                    break
                }
            } catch {}
        }
    }

    try {
        $active = [System.WindowsRuntimeSystemExtensions]::AsTask($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)).GetAwaiter().GetResult()
        
        foreach ($notif in $active) {
            $id = $notif.Id
            if (-not $processedIds.Contains($id)) {
                $null = $processedIds.Add($id)
                
                $appName = "Windows"
                if ($notif.AppInfo -and $notif.AppInfo.DisplayInfo) {
                    $appName = $notif.AppInfo.DisplayInfo.DisplayName
                }
                
                $title = ""
                $body = ""
                
                $visual = $notif.Notification.Visual
                if ($visual) {
                    $binding = $visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
                    if ($binding) {
                        $elements = $binding.GetTextElements()
                        if ($elements.Count -gt 0) { $title = $elements[0].Text }
                        if ($elements.Count -gt 1) {
                            $bodyLines = @()
                            for ($i = 1; $i -lt $elements.Count; $i++) {
                                $bodyLines += $elements[$i].Text
                            }
                            $body = $bodyLines -join "`n"
                        }
                    }
                }
                
                # Remove from native Windows Action Center so user does NOT see duplicate banner!
                $dismissed = $false
                try {
                    $listener.RemoveNotification($id)
                    $dismissed = $true
                } catch {
                    $dismissed = $false
                }
                
                $epoch = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                
                Emit-JSON @{
                    type = "notification"
                    id = "win_$id"
                    rawId = $id
                    appName = $appName
                    title = $title
                    body = $body
                    dismissedNative = $dismissed
                    timestamp = $epoch
                }
            }
        }
        
        # Prevent hash set memory leak
        if ($processedIds.Count -gt 1000) {
            $processedIds.Clear()
        }
    } catch {
        # Transient COM / WinRT errors can happen during desktop unlock
    }

    Start-Sleep -Milliseconds 250
}

