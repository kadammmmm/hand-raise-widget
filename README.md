# Hand Raise Widget

Custom Webex Contact Center (WxCC) Agent Desktop widget set that lets agents request real-time supervisor assistance during active interactions.

Three widgets, three jobs:

- **`hand-raise-agent`** (advancedHeader only) — a compact hand icon always visible in the header strip. Click to raise (reason + optional note) or lower. No page, no panel tab — raising a hand is the entire feature from the agent's side.
- **`hand-raise-supervisor-alert`** (advancedHeader) — the supervisor's always-visible hand icon. Idle, it's just a compact "Hand Raise" button. The moment a request comes in, the button itself expands inline to show the oldest request's agent/reason plus Acknowledge/Resolve buttons, alongside a browser notification + chime. No floating pop-up — see "Why no pop-up" below for why that was a deliberate choice, not an oversight.
- **`hand-raise-supervisor`** (Navigation Panel page) — the full dashboard for everything that doesn't fit in a compact header control: requests grouped by team, a live waiting/acknowledged/total summary row, reason/channel filters, and 24h history.

Real-time updates flow both ways over Server-Sent Events (SSE); no polling. Because header widgets stay mounted across every desktop view (unlike a Nav Panel page, which only mounts while visited), their SSE connections and notification listeners stay alive continuously.

## Project Structure

```
hand-raise-widget/
├── src/
│   ├── hand-raise-agent.js              # Agent header widget (raise/lower only)
│   ├── hand-raise-supervisor-alert.js   # Supervisor header widget (inline-expanding alert)
│   ├── hand-raise-supervisor.js         # Supervisor Nav Panel dashboard
│   └── shared/
│       ├── constants.js                 # Reason categories, status enums, event names
│       ├── sse-client.js                # Shared SSE connection helper
│       ├── overlay.js                   # Fixed-position panel anchoring/portal helper (used by hand-raise-agent only)
│       └── styles.js                    # Shared CSS (b+s branding, dark mode, overlay/toast)
├── backend/
│   ├── server.js                        # Express API + SSE
│   ├── routes/hand-raise.js             # Route handlers
│   ├── store.js                         # In-memory data store
│   ├── sse-manager.js                   # SSE connection manager + broadcast
│   └── package.json
├── dist/                                # Built widgets (after npm run build)
├── docs/
│   ├── agent-layout.json                # Agent advancedHeader snippet
│   ├── supervisor-header-layout.json    # Supervisor advancedHeader snippet
│   └── supervisor-layout.json           # Supervisor Nav Panel page snippet
├── package.json
├── webpack.config.cjs
├── agent.js                             # Copy of dist/agent.js for GitHub Pages
├── supervisor-alert.js                  # Copy of dist/supervisor-alert.js for GitHub Pages
└── supervisor.js                        # Copy of dist/supervisor.js for GitHub Pages
```

## Why advancedHeader for two of the three

`advancedHeader` widgets aren't limited to the visible strip height. `hand-raise-agent`'s click-to-raise form expands into a `position: fixed` overlay panel anchored to the trigger via `getBoundingClientRect` (see `src/shared/overlay.js`), the same technique used in [wxcc-queue-widget](https://github.com/kadammmmm/wxcc-queue-widget)'s click-to-expand queue panels — a small always-visible control that pops open a full interactive panel on click, backed by a transparent backdrop that closes it on an outside click.

`hand-raise-supervisor-alert` deliberately does **not** use that pattern — see "Why no pop-up for the supervisor alert" below.

The supervisor still gets a full Nav Panel page (`hand-raise-supervisor`) because some things genuinely don't fit a compact header control well: team/reason/channel filters, a 24h audit history, and a team-grouped view of everything in flight at once. The header alert widget is for "notice and triage the single oldest request right now"; the Nav Panel page is for "review and manage everything."

## Why no pop-up for the supervisor alert

The first version of `hand-raise-supervisor-alert` used the same floating overlay + toast pattern as the agent widget. In the live Supervisor Agent Desktop, that popup rendered almost entirely off-screen. The cause is a `position: fixed` containing-block issue: `fixed` is only relative to the true browser viewport if no ancestor establishes a new containing block (`transform`, `filter`, `perspective`, or CSS `contain`) — and the Supervisor Agent Desktop's header chrome apparently does. Portaling the overlay to a `<div>` appended directly to `document.body` (still in `src/shared/overlay.js`, still used by `hand-raise-agent`) didn't fully resolve it either, which points to the offending ancestor sitting even further up the tree (e.g. on `<body>` itself) than a body-level portal can escape.

Rather than chase a fix for a CSS mechanism whose exact host-page cause we can't fully inspect or control, `hand-raise-supervisor-alert` now avoids `position: fixed`/`absolute` entirely. The trigger button expands **in normal document flow** — the same rendering path that already reliably showed the badge count in the header — to show the oldest active request's summary and Acknowledge/Resolve buttons directly. No viewport math, no containing-block risk, nothing to escape. If you're adding new floating UI anywhere in this codebase, know that this failure mode is real in this specific host shell and plan accordingly — inline expansion first, `position: fixed` overlay only if the content truly can't fit inline (as with the agent's raise form, which has more fields than an icon can show).

## Build & Deploy (widgets)

```bash
npm install
npm run build
npm run postbuild   # copies dist/agent.js, dist/supervisor-alert.js, dist/supervisor.js to repo root
git add . && git commit -m "Update" && git push
```

GitHub Pages serves `agent.js`, `supervisor-alert.js`, and `supervisor.js` from the repo root — all three copies must be committed after every build.

## Backend

```bash
cd backend
npm install
npm start
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `CORS_ORIGINS` | Comma-separated allowed origins (must include the Agent Desktop origin) | allow all |
| `REQUEST_TTL_HOURS` | How long resolved requests stay in history | `24` |

### Render.com Settings

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

Note: Render's free tier sleeps after 15 minutes of inactivity, which drops SSE connections and clears in-memory state. `EventSource` auto-reconnects, but a paid tier (or Redis-backed persistence) is recommended for production.

## Desktop Layout

Three separate imports in Control Hub -> Desktop Layouts:

| Widget | Where it goes | Snippet |
|---|---|---|
| `hand-raise-agent` | Agent layout's `advancedHeader` widgets array | [docs/agent-layout.json](docs/agent-layout.json) |
| `hand-raise-supervisor-alert` | Supervisor layout's `advancedHeader` widgets array | [docs/supervisor-header-layout.json](docs/supervisor-header-layout.json) |
| `hand-raise-supervisor` | Supervisor layout's Navigation Panel (new page) | [docs/supervisor-layout.json](docs/supervisor-layout.json) |

Update the `script` and `backendUrl` values in each snippet to match your deployed URLs before importing. The exact nesting of the `advancedHeader` array can vary slightly by WxCC version — verify against your tenant's layout editor if the import is rejected.

Full step-by-step Control Hub walkthrough (where to click, how to merge into an existing layout, verification, rollback): see [DEPLOYMENT.md's Desktop Layout Configuration section](DEPLOYMENT.md#desktop-layout-configuration-control-hub).

## REST API

```
GET    /api/health
POST   /api/hand-raise
DELETE /api/hand-raise/:agentId
GET    /api/hand-raise[?teamId=xyz]
PATCH  /api/hand-raise/:id/acknowledge
PATCH  /api/hand-raise/:id/resolve
GET    /api/hand-raise/history[?teamId=xyz]
GET    /api/hand-raise/stream[?teamId=xyz]        (SSE, supervisor)
GET    /api/hand-raise/stream/agent?agentId=xyz   (SSE, agent)
```

## Debug Helper

Paste into the Agent Desktop browser console to locate a mounted widget across shadow DOM boundaries:

```javascript
function findWidget(name, root = document) {
  let widget = root.querySelector(name);
  if (widget) return widget;
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      widget = findWidget(name, el.shadowRoot);
      if (widget) return widget;
    }
  }
  return null;
}

const agentWidget = findWidget('hand-raise-agent');
const supervisorAlertWidget = findWidget('hand-raise-supervisor-alert');
const supervisorWidget = findWidget('hand-raise-supervisor');
```

## Common Pitfalls

1. Forgetting to copy all three built JS files (`agent.js` + `supervisor-alert.js` + `supervisor.js`) to the repo root for GitHub Pages.
2. Backend URL missing the `/api` suffix in widget properties.
3. CORS misconfiguration — ensure `CORS_ORIGINS` includes the Agent Desktop origin (`https://desktop.wxcc-*.cisco.com`).
4. Render free tier sleeping — SSE connections drop; clients auto-reconnect via `EventSource`.
5. Invalid layout JSON — validate before importing to Control Hub.
6. `EventSource` cannot send custom headers — pass the access token via query string, not a header.
7. Widgets must tolerate the SDK's agent/supervisor data not being ready yet on init.
8. Browser notification permission must be requested from a user gesture, not on page load — `hand-raise-supervisor-alert` requests it lazily on the trigger's first click, while it's still idle.
9. **`position: fixed` is unreliable in this host shell** — confirmed twice in the live Supervisor Agent Desktop, first rendering inline in the widget's own shadow DOM, then again after portaling to `document.body`. Some ancestor (possibly `<body>` itself) establishes a CSS containing block that `fixed` positioning can't escape even via a body-level portal. `hand-raise-agent`'s raise-form overlay still uses `position: fixed` + portal (`src/shared/overlay.js`) since it happened to render usably there; `hand-raise-supervisor-alert` was rewritten to avoid the mechanism entirely (inline expansion instead) once it proved unreliable. See "Why no pop-up for the supervisor alert" above before adding new floating UI anywhere in this codebase.

## Feature Gaps Considered (vs. NICE inContact Supervisor tools)

Cross-checked against [inContact's Supervisor Overview](https://help.incontact.com/Content/Supervisor/SupervisorOverview.htm):

- **Pop-up accept flow** — inContact surfaces agent consult/conference requests as a pop-up the supervisor accepts. `hand-raise-supervisor-alert`'s inline-expanding Acknowledge button is the equivalent for hand-raise requests (implemented as an inline expansion rather than a literal floating pop-up — see "Why no pop-up" above).
- **Teams View (agents grouped by team)** — added as team-grouped sections in the Nav Panel's active-requests list.
- **Real-time snapshot metrics** — added as a waiting/acknowledged/total summary row above the Nav Panel's card list.
- **Discreetly listen / coach / barge / take over calls** — these are native WxCC supervisor capabilities, not something a third-party widget can safely invoke on an arbitrary interaction via the public SDK. Instead, each request row exposes the `interactionId` with a one-click copy action so a supervisor can paste it into the native Team Performance / monitoring tools. Treat deeper integration here as an open item requiring SDK verification, not something this widget currently automates.
- **Force agent logout** — deliberately out of scope; that's an administrative action that belongs in native agent management, not a hand-raise triage tool.
