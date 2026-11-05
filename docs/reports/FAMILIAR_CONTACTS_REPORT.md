# 👥 Familiar Contacts & Adaptive Relationship Intelligence — Development Report

_Date: 2026-11-05 · Version: 3.5.5 (unreleased changes)_

## 1. What was built

| Area | Result |
|---|---|
| Chat discovery (official API) | **Microsoft Teams** via Microsoft Graph `GET /me/chats?$expand=members` (through Composio Connect, the user's own OAuth) and **Slack** via Web API `conversations.list / conversations.members / users.info` (bot token). Names/ids only, no message previews. |
| Fallback discovery | Every chat notification teaches a local directory: app, chat title, 1-1 or group, sender names, counts per day (14 days), "important" count. No message text. |
| Detected apps | Step ① lists chat apps installed / running on this computer (`src/main/messaging-apps.js`, process list + install paths, real icons via QuickLook) ∪ learned apps ∪ connected APIs. |
| Manual entry | ✏️ "Tự nhập tên" works with no integration at all (person or whole group chat). |
| Suggestions | ✨ **Hay nhắn nhất**: people/chats with the most messages in the last 7 days that have no rule yet → "Xếp nhóm" pre-fills step ③. Suggestion only. |
| Quick assign | Right-click a **notification card** → native menu "👤 X là… / 👥 Cả nhóm Y là…" (all relationships + remove). **Inbox** rows get "👥 Xếp nhóm" → small dialog. |
| Relationship hours | ⏰ Per relationship: "Ngoài giờ → Hộp thư" (own window), "Vẫn hiện trong giờ yên tĩnh" (bypass global quiet-hours schedule), "Gom vào Hộp thư (digest)". |
| Per-person behaviour | Emotion (or auto by relationship) + behaviour: Theo mối quan hệ · Ưu tiên · Bình thường · Hiện nhẹ nhàng không kêu · Chỉ lưu Hộp thư. Enable/disable per rule. |
| Adaptive memory | Metadata only: a sender whose messages were ≥ 50 % important by content (≥ 5 msgs) gets priority; a group chat with ≥ 40 messages today is shown silently. Shown as "Bé nhận thấy…", can be turned off, wiped with "Quên danh sách đã gặp". Never overrides an explicit rule, never learns from its own decisions. |

## 2. Rule priority (implemented in the engine, not the UI)

`src/core/contact-rules.js → contactPolicy()` then `AttentionEngine.decide()`:

1. Person rule (`kind: person`, optionally scoped to an app)
2. Group-chat rule (`kind: chat`)
3. Relationship policy (`settings.relationships[group]`: own hours, digest, after-hours)
4. App rules → 5. general rules → 6. defaults (unchanged engines)

Person beats chat (e.g. the boss inside a muted colleagues chat). A person's own behaviour beats the relationship's hours/digest. Critical notifications still bypass everything (existing `criticalBypass`). A familiar contact also beats the chat filter "Chỉ khi liên quan đến tôi".

## 3. Files

New
- `src/core/contact-rules.js` — policy resolution, `CONTACT_ATTENTION`, relationship defaults.
- `src/core/contact-directory.js` — learned directory, suggestions, insights, persistence (`userData/contact-directory.json`).
- `src/integrations/chat-sources.js` — Teams (Graph) + Slack chat lists with honest states: `ready · not_connected · unsupported · permission · error`, 5-min cache.
- `test/contact-rules.test.js`, `test/contact-directory.test.js`.

Modified
- `chat-filter.js` — relationships: 💕 partner · 👨‍👩‍👧 family · 👨‍👩‍👦 relatives · 👫 close_friends · 🤝 friends · 💼 manager · 👨‍💻 colleagues · 🎓 teacher · ⭐ important · ✏️ other (custom label) · 🔕 ignored; app-scoped + chat-level matching; disabled rules skipped.
- `attention-engine.js` — consumes the contact policy (priority, inbox, silent, cooldown bypass, after-hours).
- `notification-pipeline.js` — computes the policy, strips it (names) before output, feeds the directory with content-only priority.
- `settings-store.js` — validated schema for contacts and relationships, `privacy.learnContacts`, `privacy.adaptiveMemory`.
- `inbox-store.js` — keeps `sender`, `appName`, `privacy` for quick assign.
- `main/index.js`, `main/server.js`, `preload.js`, `renderer.js` — APIs, card context menu, Inbox targets.
- `control/control.js`, `control/control.css` — redesigned panel.

## 4. Data model (settings.contacts[])

```js
{ id, name, kind: 'person'|'chat', app: 'teams'|'zalo'|…|null, targetId: string|null,
  group: 'partner'|'family'|'relatives'|'close_friends'|'friends'|'manager'|'colleagues'|'teacher'|'important'|'other'|'ignored',
  label: string|null /* custom name for "other" */, emotion: EmotionId|null /* null = auto */,
  attention: 'auto'|'important'|'normal'|'silent'|'inbox', enabled: boolean, createdAt, updatedAt }
```
Duplicates (same app + kind + name) are merged — the later one wins. Old rules (name/group/emotion only) keep working.

## 5. API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/contacts/seen` | learned directory + suggestions + insights |
| DELETE | `/api/contacts/seen` | "Quên danh sách đã gặp" (rules are kept) |
| GET | `/api/contacts/sources` | official sources and their state |
| GET | `/api/contacts/sources/:id/chats[?refresh=1]` | chat list (names/ids only) |
| GET | `/api/contacts/sources/:id/members?chat=` | members of one chat |
| GET | `/api/contacts/apps[?refresh=1]` | chat apps installed / running on this computer, with icons |

## 6. Privacy

- Only names, ids, counts and timestamps are stored; never message bodies or previews (Graph request does not expand `lastMessagePreview`).
- Nothing is learned from apps whose content is hidden (privacy mode ≠ full content) or when "Bé ghi nhớ tên…" is off.
- The contact policy object (contains names) is removed before the item reaches the overlay, Control Center, history or Inbox.
- No relationship is ever assigned automatically; suggestions and memory never create rules.
- Wiping the directory does not disconnect apps, delete messages, or touch rules/Inbox.

## 7. Validation & UI states

Add is disabled until something is chosen; "Khác" requires a name; duplicates turn the button into "↻ Cập nhật" with a notice; edit mode "💾 Lưu / Huỷ" (Esc). States covered: no app, app selected, manual, loading list (⏳), list, no match, group expanded, member(s) selected (multi-select), not connected / unsupported / permission (⚠️ + Thử lại), empty saved list, forget confirmation dialog. Enter submits manual entry; focus rings; aria labels; layout wraps under 860 px.

## 8. Tests

`npm test` (Node 20): **104 / 105 pass**. The 1 failure (`Windows listener status is honest…`) existed before this work and is unrelated.

New tests cover: person > chat > relationship priority; relationship hours inside/outside the window; per-person behaviour beating digest; disabled rules; after-hours vs global quiet hours; contacts beating the mentions-only chat filter; policy not leaking names; adaptive memory on/off and explicit-rule override; memory not learning from its own decisions; suggestions excluding classified people; settings sanitization/dedupe; Teams Graph parsing (self excluded, no previews), not-connected and 403 permission states.

Manual check in the packaged app (Control Center in Chrome): app chips, learned Teams/Zalo chats, suggestions, member multi-select, add 2 people, edit behaviour, enable/disable, relationship hours panel, forget dialog (cancelled) — no console errors. Test data was removed afterwards.

## 9. Known limitations

- **Teams chat list** needs Microsoft Teams connected (work/school account) with a Composio Connect key (ck_…). Verified live on 2026-11-05: 467 chats (94 one-on-one, 97 groups, 276 meeting chats). How it works around Composio limits: replies over Composio's size limit come back only as a truncated `data_preview` (the full reply stays in Composio's sandbox), so the list is read **without** `$expand=members` (25–50 chats per page come back whole), names for untitled chats (all 1-1) come from Graph `$batch` on `/chats/{id}/members` (10 per call), and group members load only when a group is opened. `@odata.nextLink` is split into path + query because Composio rejects the full URL. Graph does not accept `$select` on `/me/chats` or nested `$select` inside `$expand`.
- First Teams load takes ~1–2 min (≈20 Composio calls); the names-only list is cached in `userData/chat-sources-cache.json` (opens in ~0.1 s, refreshed in the background after 5 min, wiped by "Quên danh sách đã gặp").
- Two Teams chats can share a title; learned counts ("N tin bé đã gặp") are matched by title, so both show the same counts.
- Slack lists only what the bot can see (channels it's in, its own DMs).
- Zalo, Messenger, iMessage… have no public chat-list API → learned names + manual entry only.
- The card right-click menu is a native menu (not covered by automated tests); the Inbox "Xếp nhóm" dialog was not exercised manually because the Inbox had no chat items during testing.
- New panel copy is Vietnamese only (the EN dictionary was not extended).
