# Hand Raise Widget

Custom Webex Contact Center (WxCC) Agent Desktop widget pair that lets agents request real-time supervisor assistance during active interactions.

- **`hand-raise-agent`** — agent-side toggle (raise/lower hand, reason, note, live status).
- **`hand-raise-supervisor`** — supervisor-side dashboard (active requests, acknowledge/resolve, history, filters, notifications).

Real-time updates flow both ways over Server-Sent Events (SSE); no polling.

## Project Structure

```
hand-raise-widget/
├── src/
│   ├── hand-raise-agent.js        # Agent-side LitElement component
│   ├── hand-raise-supervisor.js   # Supervisor-side LitElement component
│   └── shared/
│       ├── constants.js           # Reason categories, status enums, event names
│       ├── sse-client.js          # Shared SSE connection helper
│       └── styles.js              # Shared CSS (b+s branding, dark mode)
├── backend/
│   ├── server.js                  # Express API + SSE
│   ├── routes/hand-raise.js       # Route handlers
│   ├── store.js                   # In-memory data store
│   ├── sse-manager.js             # SSE connection manager + broadcast
│   └── package.json
├── dist/                          # Built widgets (after npm run build)
├── docs/
│   ├── agent-layout.json          # Agent desktop layout snippet
│   └── supervisor-layout.json     # Supervisor desktop layout snippet
├── package.json
├── webpack.config.cjs
├── agent.js                       # Copy of dist/agent.js for GitHub Pages
└── supervisor.js                  # Copy of dist/supervisor.js for GitHub Pages
```

## Build & Deploy (widgets)

```bash
npm install
npm run build
npm run postbuild   # copies dist/agent.js and dist/supervisor.js to repo root
git add . && git commit -m "Update" && git push
```

GitHub Pages serves `agent.js` and `supervisor.js` from the repo root — both copies must be committed after every build.

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

Import [docs/agent-layout.json](docs/agent-layout.json) into the agent's Auxiliary Information Panel and [docs/supervisor-layout.json](docs/supervisor-layout.json) as a Navigation Panel page in Control Hub. Update the `script` and `backendUrl` values to match your deployed URLs.

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
const supervisorWidget = findWidget('hand-raise-supervisor');
```

## Common Pitfalls

1. Forgetting to copy both built JS files (`agent.js` + `supervisor.js`) to the repo root for GitHub Pages.
2. Backend URL missing the `/api` suffix in widget properties.
3. CORS misconfiguration — ensure `CORS_ORIGINS` includes the Agent Desktop origin (`https://desktop.wxcc-*.cisco.com`).
4. Render free tier sleeping — SSE connections drop; clients auto-reconnect via `EventSource`.
5. Invalid layout JSON — validate before importing to Control Hub.
6. `EventSource` cannot send custom headers — pass the access token via query string, not a header.
7. Agent widget must tolerate the SDK's agent data not being ready yet on init.
