; Custom NSIS hooks, picked up automatically by electron-builder (buildResources/installer.nsh).
;
; Uninstall safety (Blueprint V4.1 §5 Phase 1): Mode A ("replace Windows notifications") turns
; per-app banners and sounds off in HKCU and keeps the original values in
; %APPDATA%\<product>\windows-banners.json. The app restores them on quit, and the listener restores
; them when the app dies — but the uninstaller kills the app and then deletes the script, so a
; leftover backup would leave Windows silent for good. Restore from the backup here.
;
; customUnInit runs after the running app was closed and BEFORE any installed file is removed,
; so the unpacked listener script is still on disk. Skipped for updates: the new version restores
; or re-applies its own state on launch.

!macro customUnInit
  ${ifNot} ${isUpdated}
    ${if} ${FileExists} "$APPDATA\${PRODUCT_NAME}\windows-banners.json"
    ${andIf} ${FileExists} "$INSTDIR\resources\app.asar.unpacked\src\native\windows\NotificationListener.ps1"
      DetailPrint "Restoring Windows notification banners and sounds..."
      nsExec::Exec '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\src\native\windows\NotificationListener.ps1" -BannerBackup "$APPDATA\${PRODUCT_NAME}\windows-banners.json" -RestoreBanners'
      Pop $0
    ${endIf}
  ${endIf}
!macroend

; After a successful install / reinstall / update: leave a one-shot marker in the user's data folder.
; The app (launched by the installer's "run after finish") sees it, opens the Control Center once and
; deletes it — so every finished install shows the app's window, not only the very first one.
!macro customInstall
  CreateDirectory "$APPDATA\${PRODUCT_NAME}"
  FileOpen $0 "$APPDATA\${PRODUCT_NAME}\.just-installed" w
  FileWrite $0 "${VERSION}"
  FileClose $0
!macroend
