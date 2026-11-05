# Cute Pet Companion - popup probe (diagnostics only, read-only).
# Watches for NEW top-level windows of any app for -Seconds and tries to read the text inside them
# with UI Automation. Purpose: find out whether apps that draw their OWN notification popups
# (instead of Windows notifications) can be read, e.g. Zalo on some Windows 10 machines.
# Text is MASKED by default (first 2 characters + length) so the report can be shared safely.
# It never clicks, closes or changes anything.
param(
    [int]$Seconds = 60,
    [string]$Out = '',
    [int]$ExcludePid = 0,
    [switch]$NoMask
)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes

Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class CpcWin {
    public delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    public static List<IntPtr> Visible() {
        var list = new List<IntPtr>();
        EnumWindows((h, l) => { if (IsWindowVisible(h)) list.Add(h); return true; }, IntPtr.Zero);
        return list;
    }
    public static string Cls(IntPtr h) { var s = new StringBuilder(256); GetClassName(h, s, 256); return s.ToString(); }
    public static string Title(IntPtr h) { var s = new StringBuilder(512); GetWindowText(h, s, 512); return s.ToString(); }
}
'@

function Mask([string]$s) {
    if ($NoMask) { return $s }
    $t = ($s -replace '\s+', ' ').Trim()
    if ($t.Length -le 2) { return "$t ($($t.Length))" }
    return ($t.Substring(0, 2) + ([string][char]0x2022 * 3) + " ($($t.Length))")
}

function Read-Texts($hwnd) {
    $names = New-Object System.Collections.Generic.List[string]
    try {
        $el = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
        # Chromium/Electron builds its accessibility tree on the first UIA request: ask, wait, ask again.
        $null = $el.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        Start-Sleep -Milliseconds 400
        $all = $el.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        foreach ($e in $all) {
            $n = $e.Current.Name
            if ($n -and $n.Trim().Length -gt 0 -and -not $names.Contains($n)) { $names.Add($n) }
            if ($names.Count -ge 25) { break }
        }
        return @{ count = $all.Count; names = $names }
    } catch {
        return @{ count = -1; names = $names; error = $_.Exception.Message }
    }
}

$skipProcs = @('explorer', 'ShellExperienceHost', 'StartMenuExperienceHost', 'SearchHost', 'SearchApp', 'TextInputHost', 'dwm', 'powershell', 'conhost', 'SystemSettings', 'LockApp')
$known = New-Object 'System.Collections.Generic.HashSet[long]'
foreach ($h in [CpcWin]::Visible()) { $null = $known.Add($h.ToInt64()) }

$os = [Environment]::OSVersion.Version
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("Cute Pet Companion - popup probe")
$lines.Add("Windows $($os.Major).$($os.Minor).$($os.Build) | started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | watching $Seconds s | text masked: $(-not $NoMask)")
$lines.Add("")
Write-Output "Watching new windows for $Seconds s... (make a Zalo / app notification appear now)"

$found = 0
$sw = [Diagnostics.Stopwatch]::StartNew()
while ($sw.Elapsed.TotalSeconds -lt $Seconds) {
    foreach ($h in [CpcWin]::Visible()) {
        if (-not $known.Add($h.ToInt64())) { continue }
        $procId = 0; [void][CpcWin]::GetWindowThreadProcessId($h, [ref]$procId)
        if ($ExcludePid -gt 0 -and $procId -eq $ExcludePid) { continue }
        $proc = (Get-Process -Id $procId -ErrorAction SilentlyContinue)
        $pname = if ($proc) { $proc.ProcessName } else { "pid $procId" }
        if ($skipProcs -contains $pname) { continue }
        $r = New-Object CpcWin+RECT; [void][CpcWin]::GetWindowRect($h, [ref]$r)
        $w = $r.R - $r.L; $hgt = $r.B - $r.T
        if ($w -lt 40 -or $hgt -lt 20) { continue }
        $ex = [CpcWin]::GetWindowLong($h, -20)
        $topmost = ($ex -band 0x8) -ne 0
        $toolwin = ($ex -band 0x80) -ne 0
        $noact = ($ex -band 0x08000000) -ne 0
        $found++
        $t = Read-Texts $h
        $lines.Add("[$('{0:N1}' -f $sw.Elapsed.TotalSeconds)s] app=$pname class=$([CpcWin]::Cls($h)) size=${w}x${hgt} at=($($r.L),$($r.T)) topmost=$topmost toolwindow=$toolwin noactivate=$noact")
        $lines.Add("    window title: $(Mask ([CpcWin]::Title($h)))")
        if ($t.error) { $lines.Add("    UI Automation error: $($t.error)") }
        $lines.Add("    UI Automation elements: $($t.count) | readable texts: $($t.names.Count)")
        foreach ($n in $t.names) { $lines.Add("      - $(Mask $n)") }
        $lines.Add("")
        Write-Output "new window: $pname ${w}x${hgt} -> $($t.names.Count) readable texts"
    }
    Start-Sleep -Milliseconds 300
}
$lines.Add("Done: $found new window(s).")
if ($Out) {
    New-Item -ItemType Directory -Force -Path (Split-Path $Out) | Out-Null
    [IO.File]::WriteAllLines($Out, $lines, (New-Object System.Text.UTF8Encoding $true))
    Write-Output "Report: $Out"
} else {
    $lines | ForEach-Object { Write-Output $_ }
}
