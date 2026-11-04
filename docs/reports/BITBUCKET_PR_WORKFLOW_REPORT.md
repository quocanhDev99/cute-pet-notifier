# Bitbucket PR Workflow Report — v3.4.0 (04/11/2026)

## Implementation
- **Account:** `GET /user` gives the UUID. Matching is done on the UUID, never on the display name.
- **Retrieval:** `GET /user/workspaces`, then the 25 most recently updated repos. For each repo the app calls `GET /repositories/{ws}/{repo}/pullrequests?q=state="OPEN" AND reviewers.uuid="{me}"` with a minimal `fields` list, 5 requests at a time, through `COMPOSIO_PROXY_EXECUTE`. Composio's own list tool has no reviewer filter and truncates its responses. PRs where the user's participant entry is `approved: true` are skipped.
- **Cards:**
  - Several PRs → one card listing up to 6, each with **↗ Open PR** and **✅ Approve**.
  - One new PR → its own card.
  - Duration is 30–60 s, and the card pauses while hovered.
- **Approve:** `POST /repositories/{ws}/{repo}/pullrequests/{id}/approve`.
  - The target (ws, repo, id) is held **in the main process**, keyed by an opaque id. The renderer only sends that id back, so unknown or forged ids are refused.
  - "✓ Đã approve" is shown only after the API answers 200/201. 409 is treated as already approved.
  - Approve and Merge are separate; nothing ever merges or declines.
  - On the user's request there is **no confirmation step** (guide §C4 recommends one).
  - With privacy modes other than "full", the Approve button is removed (guide §D4).

## Verified
- With the real account: 3 → 0 PRs waiting for review after the user approved them.
- Real approve from the card: **not yet confirmed** (we could not tell whether the 3 PRs were approved in the app or on bitbucket.org). The single-click flow and error path were tested with a fake PR (refused safely).
- Unit test: `test/bitbucket-review.test.js` covers the list card, per-row approve and forged id.

## Not done
- No Bitbucket webhook (polling only).
- PRs outside the 25 most recently updated repos are not seen.
- With 2 Bitbucket accounts in Composio, the proxy uses the default account.
