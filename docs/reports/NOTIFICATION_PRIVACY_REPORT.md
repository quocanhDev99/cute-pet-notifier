# Notification Privacy Report — v3.4.0 (04/11/2026)

## Modes (guide §D1)
| Mode | Card shows | Inbox / history store |
|---|---|---|
| `full_content` (default) | app, title, content, rows, actions | full |
| `masked` | app + title with first letter per word ("H••• s•••"), content hidden | masked |
| `source_only` | "Tin nhắn mới từ Teams" / "Thông báo mới từ Gmail"; no rows, no Approve | redacted |
| `anonymous_source_only` | "Bạn có thông báo mới"; no app, no link | redacted |

## Policy and boundary
- **Policy:** the effective mode is the **stricter** of the global mode and the per-app list (`privacy.hiddenApps` → `source_only`). A per-app rule cannot relax a strict global mode.
- **One projection:** a single function, `src/core/privacy.js`, runs inside the pipeline **before** enqueue, the overlay, Control Center SSE events, history and the persisted Inbox. Classification details that may quote content (`rule`, mood `reasons`) are dropped as well.
- **What still uses content:** emotion and priority are decided on-device from the full content before projection. Log lines contain ids, delivery mode, emotion and reason only, never content.
- **Quick toggle:** "🙈 Ẩn nội dung thông báo" in the tray menu and the pet's right-click menu.

## Tests (`test/privacy.test.js`, synthetic secret marker)
The marker is absent from display/inbox/history events, `pipeline.history`, `inbox.list()` and every file on disk. Approve and rows are removed when content is hidden. Masking format, anonymous mode and policy precedence are checked.

## Not done / disclosure
- No automatic detection of screen sharing (no public macOS API in Electron), so use the quick toggle.
- Content still reaches this machine first: macOS Notification Center, Composio (cloud) and the Gateway process payloads before local redaction.
- The pet's emotion is still derived from the content.
