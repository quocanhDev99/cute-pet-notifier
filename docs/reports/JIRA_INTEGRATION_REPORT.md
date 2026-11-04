# Jira Integration Report — v3.4.0 (04/11/2026)

## Implementation
- **Transport:** Composio Connect (consumer key `ck_…`) over MCP. The search uses `JIRA_SEARCH_FOR_ISSUES_USING_JQL_GET` with `assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC` and returns at most 20 issues. Each check is a poll (default every 2 min). It is not a webhook, so it is labelled `near_realtime_poll`.
- **Response shape:** Composio returns flattened issues (`summary`, `status{name}`, `priority{name}`, `reporter{display_name}`, `browser_url`). The parser also accepts raw Jira `fields.*`.
- **When a card is shown:** the dedupe id is `KEY@status`.
  - New assignment → "🧩 Việc mới cho bạn: KEY summary".
  - Status change → "🔄 KEY → Status".
  - Other edits do not create a card.
  - The first poll after start-up is a silent baseline.
- **Assigned by:** this follows guide §B3. The app reads the issue changelog through `COMPOSIO_PROXY_EXECUTE` at `api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue/{KEY}/changelog`. It takes the latest entry whose `assignee` change goes **to** the current account (`/myself`) and uses that entry's author. When no such entry exists (the issue was created already assigned) or the call is not permitted, the card says "Người giao: không có thông tin". The assigner is **never** inferred from the reporter.
- **Deep link:** the card opens `browser_url` (must be https `*.atlassian.net/browse/…`).
- **Priority:** Highest/Critical/Blocker → `critical`, High → `important`.

## Verified with the real connected account (counts only, no content printed)
| Check | Result |
|---|---|
| JQL search | 20 open assigned issues; key, summary, status and link parsed for all 20 |
| Changelog attribution (5 issues) | 1 assigned by someone else; 4 have no assignment record |
| Bug found and fixed | `fields` must be a list. A string made every Jira poll fail since the feature was added, and the error was swallowed. Per-app errors are now shown in 🔌 Kết nối |

## Not done
- No Jira webhook, so updates are not instant.
- No Work Hub list view. Only cards and the Inbox.
- Reassignment away from you is not shown.
