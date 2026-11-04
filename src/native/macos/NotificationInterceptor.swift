import Foundation
import Cocoa
import ApplicationServices

// MARK: - JSON Output Helper
func emitJSON(_ obj: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: obj, options: []),
          let str = String(data: data, encoding: .utf8) else { return }
    print(str)
    fflush(stdout)
}

// MARK: - Check Accessibility Permissions
let trusted = AXIsProcessTrusted()
emitJSON(["type": "status", "trusted": trusted, "os": "darwin"])

if !trusted {
    // Optionally prompt system dialog
    let promptDict = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    _ = AXIsProcessTrustedWithOptions(promptDict)
}

// MARK: - Accessibility Helper Functions
func getAttribute<T>(_ element: AXUIElement, _ attribute: String) -> T? {
    var value: AnyObject?
    let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
    if result == .success, let val = value as? T {
        return val
    }
    return nil
}

func getAllChildren(_ element: AXUIElement) -> [AXUIElement] {
    return getAttribute(element, kAXChildrenAttribute) ?? []
}

func collectTexts(_ element: AXUIElement, depth: Int = 0) -> [String] {
    if depth > 8 { return [] }
    var results: [String] = []
    
    let role: String? = getAttribute(element, kAXRoleAttribute)
    let value: String? = getAttribute(element, kAXValueAttribute)
    let title: String? = getAttribute(element, kAXTitleAttribute)
    let desc: String? = getAttribute(element, kAXDescriptionAttribute)
    
    if role == (kAXStaticTextRole as String) {
        if let v = value, !v.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            results.append(v)
        } else if let t = title, !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            results.append(t)
        }
    }
    if let d = desc, !d.isEmpty, !results.contains(d) && role != (kAXButtonRole as String) {
        results.append(d)
    }
    
    for child in getAllChildren(element) {
        results.append(contentsOf: collectTexts(child, depth: depth + 1))
    }
    return results
}

func dismissBanner(_ element: AXUIElement, depth: Int = 0) -> Bool {
    if depth > 7 { return false }
    
    // Check if element itself has cancel / close action
    var actions: CFArray?
    if AXUIElementCopyActionNames(element, &actions) == .success, let actionList = actions as? [String] {
        if actionList.contains(kAXCancelAction as String) {
            _ = AXUIElementPerformAction(element, kAXCancelAction as CFString)
            return true
        }
    }
    
    let role: String? = getAttribute(element, kAXRoleAttribute)
    let desc: String? = getAttribute(element, kAXDescriptionAttribute)
    let title: String? = getAttribute(element, kAXTitleAttribute)
    
    if role == (kAXButtonRole as String) {
        let isClose = (desc?.lowercased().contains("close") == true) ||
                      (desc?.lowercased().contains("dismiss") == true) ||
                      (desc?.lowercased().contains("đóng") == true) ||
                      (title?.lowercased().contains("close") == true) ||
                      (title == "✕" || title == "×")
        if isClose {
            _ = AXUIElementPerformAction(element, kAXPressAction as CFString)
            return true
        }
    }
    
    for child in getAllChildren(element) {
        if dismissBanner(child, depth: depth + 1) {
            return true
        }
    }
    return false
}

// MARK: - Observer Setup
var observedPids = Set<pid_t>()
var activeObservers: [AXObserver] = []

func setupObserver(for app: NSRunningApplication) {
    let pid = app.processIdentifier
    if observedPids.contains(pid) { return }
    
    let axApp = AXUIElementCreateApplication(pid)
    var observer: AXObserver?
    let callback: AXObserverCallback = { (observer, element, notification, refcon) in
        let notifName = notification as String
        if notifName == (kAXWindowCreatedNotification as String) {
            handleNewWindow(element)
        }
    }
    
    let err = AXObserverCreate(pid, callback, &observer)
    guard err == .success, let obs = observer else {
        emitJSON(["type": "log", "message": "Failed to create AXObserver for pid \(pid): \(err.rawValue)"])
        return
    }
    
    let selfPtr = UnsafeMutableRawPointer(Unmanaged.passUnretained(app).toOpaque())
    AXObserverAddNotification(obs, axApp, kAXWindowCreatedNotification as CFString, selfPtr)
    
    CFRunLoopAddSource(CFRunLoopGetCurrent(), AXObserverGetRunLoopSource(obs), .defaultMode)
    observedPids.insert(pid)
    activeObservers.append(obs)
    emitJSON(["type": "status", "listening": true, "pid": pid, "bundle": app.bundleIdentifier ?? ""])
}

var processedWindows = Set<Int>()

func handleNewWindow(_ window: AXUIElement) {
    let hash = CFHash(window)
    if processedWindows.contains(hash) { return }
    processedWindows.insert(hash)
    
    // Slight pause to let children settle
    DispatchQueue.global().asyncAfter(deadline: .now() + 0.04) {
        let texts = collectTexts(window)
        if texts.isEmpty { return }
        
        let appName = texts.count > 0 ? texts[0] : "Notification"
        let title = texts.count > 1 ? texts[1] : (texts.count > 0 ? texts[0] : "")
        let body = texts.count > 2 ? texts[2...].joined(separator: "\n") : ""
        
        let id = "ax_\(Int(Date().timeIntervalSince1970 * 1000))_\(hash)"
        
        // Immediately dismiss the native banner so user does not see duplicate!
        let dismissed = dismissBanner(window)
        
        emitJSON([
            "type": "notification",
            "id": id,
            "appName": appName,
            "title": title,
            "body": body,
            "dismissedNative": dismissed,
            "timestamp": Int(Date().timeIntervalSince1970 * 1000)
        ])
    }
}

// Find NotificationCenter process
func findNotificationCenter() {
    let apps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.notificationcenterui")
    for app in apps {
        setupObserver(for: app)
    }
    if apps.isEmpty {
        // Fallback: look for notificationcenter by name
        for app in NSWorkspace.shared.runningApplications {
            if let name = app.localizedName?.lowercased(), name.contains("notification") {
                setupObserver(for: app)
            }
        }
    }
}

findNotificationCenter()

// Periodically check if NotificationCenter restarted
let timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
    findNotificationCenter()
    // Clean old processed window hashes
    if processedWindows.count > 200 {
        processedWindows.removeAll()
    }
}

// Handle stdin commands
DispatchQueue.global().async {
    while let line = readLine() {
        guard let data = line.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
              let action = json["action"] as? String else { continue }
        
        if action == "ping" {
            emitJSON(["type": "pong", "trusted": AXIsProcessTrusted()])
        } else if action == "check" {
            emitJSON(["type": "status", "trusted": AXIsProcessTrusted()])
        } else if action == "quit" {
            exit(0)
        }
    }
}

RunLoop.current.run()

