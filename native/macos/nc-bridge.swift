// nc-bridge — Cute Pet Companion macOS helper
// Watches macOS Notification Center banners through the Accessibility API and lets the app
// (1) read them instantly, (2) hide the native banner, (3) "press" it later so the source app
// opens the exact conversation, exactly as if the user clicked the original banner.
//
// Protocol: JSON lines.
//   stdout: {"type":"ready","trusted":true} · {"type":"banner",...} · {"type":"gone","id"} · {"type":"result","cmd","id","ok","detail"}
//   stdin : {"cmd":"hide","id"} · {"cmd":"press","id"} · {"cmd":"close","id"} · {"cmd":"prompt"} · {"cmd":"status"}
//
// Only the NotificationCenter process is ever inspected. Requires the Accessibility permission.
import AppKit
import ApplicationServices
import Foundation

setvbuf(stdout, nil, _IOLBF, 0)
let NC_BUNDLE = "com.apple.notificationcenterui"

func emit(_ obj: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: obj), let s = String(data: data, encoding: .utf8) else { return }
  print(s)
}
func attr(_ e: AXUIElement, _ a: String) -> AnyObject? { var v: AnyObject?; return AXUIElementCopyAttributeValue(e, a as CFString, &v) == .success ? v : nil }
func str(_ e: AXUIElement, _ a: String) -> String? { attr(e, a) as? String }
func kids(_ e: AXUIElement) -> [AXUIElement] { (attr(e, kAXChildrenAttribute) as? [AXUIElement]) ?? [] }
func actionNames(_ e: AXUIElement) -> [String] { var n: CFArray?; AXUIElementCopyActionNames(e, &n); return (n as? [String]) ?? [] }
func nowMs() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }

struct Banner { let el: AXUIElement; let window: AXUIElement?; let id: String }

final class Bridge {
  var pid: pid_t = 0
  var app: AXUIElement?
  var observer: AXObserver?
  var banners: [String: Banner] = [:]   // id -> live element
  var scanPending = false
  var autoHide = CommandLine.arguments.contains("--autohide")

  func attach() {
    guard let nc = NSRunningApplication.runningApplications(withBundleIdentifier: NC_BUNDLE).first else { return }
    if nc.processIdentifier == pid, observer != nil { return }
    pid = nc.processIdentifier
    app = AXUIElementCreateApplication(pid)
    var obs: AXObserver?
    let cb: AXObserverCallback = { _, _, _, refcon in
      guard let refcon = refcon else { return }
      Unmanaged<Bridge>.fromOpaque(refcon).takeUnretainedValue().scheduleScan()
    }
    if AXObserverCreate(pid, cb, &obs) == .success, let obs = obs, let app = app {
      let me = Unmanaged.passUnretained(self).toOpaque()
      for n in [kAXWindowCreatedNotification, kAXCreatedNotification, kAXUIElementDestroyedNotification, kAXLayoutChangedNotification, kAXFocusedWindowChangedNotification] {
        AXObserverAddNotification(obs, app, n as CFString, me)
      }
      CFRunLoopAddSource(CFRunLoopGetCurrent(), AXObserverGetRunLoopSource(obs), .defaultMode)
      observer = obs
    }
    scheduleScan()
  }

  func scheduleScan() {
    if scanPending { return }
    scanPending = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.015) { self.scanPending = false; self.scan() }
  }

  func collect(_ e: AXUIElement, _ window: AXUIElement?, _ out: inout [(AXUIElement, AXUIElement?)], _ depth: Int = 0) {
    if depth > 14 { return }
    if str(e, kAXSubroleAttribute) == "AXNotificationCenterBanner" { out.append((e, window)); return }
    let w = (str(e, kAXRoleAttribute) == kAXWindowRole) ? e : window
    for c in kids(e) { collect(c, w, &out, depth + 1) }
  }

  func scan() {
    guard let app = app else { attach(); return }
    var found: [(AXUIElement, AXUIElement?)] = []
    for w in (attr(app, kAXWindowsAttribute) as? [AXUIElement]) ?? [] { collect(w, w, &found) }
    var live = Set<String>()
    for (el, win) in found {
      // Stable per-notification identifier exposed by Notification Center; fall back to text.
      var texts: [String: String] = [:]
      for c in kids(el) { if let ident = str(c, "AXIdentifier"), let v = attr(c, kAXValueAttribute) as? String { texts[ident] = v } }
      let id = str(el, "AXIdentifier") ?? "\(texts["title"] ?? "")|\(texts["body"] ?? "")".hashValue.description
      live.insert(id)
      if banners[id] != nil { continue }
      banners[id] = Banner(el: el, window: win, id: id)
      emit(["type": "banner", "id": id, "app": str(el, kAXDescriptionAttribute) ?? "", "title": texts["title"] ?? "", "subtitle": texts["subtitle"] ?? "", "body": texts["body"] ?? "", "t": nowMs(), "stack": found.count])
      if autoHide { _ = hide(id) }
    }
    for id in banners.keys where !live.contains(id) { banners.removeValue(forKey: id); emit(["type": "gone", "id": id]) }
  }

  /// Move the banner's window off-screen (keeps it alive so it can still be pressed). Falls back to Close.
  func hide(_ id: String) -> (Bool, String) {
    guard let b = banners[id] else { return (false, "unknown") }
    if let w = b.window {
      var settable: DarwinBoolean = false
      AXUIElementIsAttributeSettable(w, kAXPositionAttribute as CFString, &settable)
      if settable.boolValue {
        var p = CGPoint(x: -20000, y: -20000)
        if let v = AXValueCreate(.cgPoint, &p), AXUIElementSetAttributeValue(w, kAXPositionAttribute as CFString, v) == .success { return (true, "moved") }
      }
    }
    return close(id)
  }

  func perform(_ id: String, _ match: (String) -> Bool) -> (Bool, String) {
    guard let b = banners[id] else { return (false, "unknown") }
    guard let action = actionNames(b.el).first(where: match) else { return (false, "no-action") }
    let r = AXUIElementPerformAction(b.el, action as CFString)
    return (r == .success, "ax=\(r.rawValue)")
  }
  func press(_ id: String) -> (Bool, String) { perform(id) { $0 == kAXPressAction as String } }
  func close(_ id: String) -> (Bool, String) { perform(id) { $0.contains("Name:Close") || $0 == "AXCancel" } }
}

let bridge = Bridge()
let trustedNow = AXIsProcessTrusted()
emit(["type": "ready", "trusted": trustedNow, "pid": ProcessInfo.processInfo.processIdentifier])
bridge.attach()

// Re-attach when Notification Center restarts; light safety scan.
Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
  if NSRunningApplication.runningApplications(withBundleIdentifier: NC_BUNDLE).first?.processIdentifier != bridge.pid { bridge.observer = nil; bridge.attach() }
  if !bridge.banners.isEmpty { bridge.scan() }
}
var lastTrusted = trustedNow
Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { _ in
  let t = AXIsProcessTrusted()
  if t != lastTrusted { lastTrusted = t; emit(["type": "trust", "trusted": t]); bridge.observer = nil; bridge.attach() }
}

// stdin commands
FileHandle.standardInput.readabilityHandler = { h in
  let data = h.availableData
  if data.isEmpty { exit(0) } // parent closed the pipe → quit with it
  for line in String(decoding: data, as: UTF8.self).split(separator: "\n") {
    guard let obj = try? JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any], let cmd = obj["cmd"] as? String else { continue }
    let id = obj["id"] as? String ?? ""
    DispatchQueue.main.async {
      var res: (Bool, String) = (false, "unknown-cmd")
      switch cmd {
      case "hide": res = bridge.hide(id)
      case "press": res = bridge.press(id)
      case "close": res = bridge.close(id)
      case "prompt":
        let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        res = (AXIsProcessTrustedWithOptions(opts), "prompted")
      case "status": res = (AXIsProcessTrusted(), "banners=\(bridge.banners.count)")
      default: break
      }
      emit(["type": "result", "cmd": cmd, "id": id, "ok": res.0, "detail": res.1])
    }
  }
}

RunLoop.main.run()
