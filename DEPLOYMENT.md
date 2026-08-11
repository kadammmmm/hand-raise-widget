# Deployment Guide

Current live deployment for the Hand Raise widget.

## Live Endpoints

| Component | URL |
|---|---|
| Agent widget bundle (advancedHeader) | https://kadammmmm.github.io/hand-raise-widget/agent.js |
| Supervisor alert widget bundle (advancedHeader) | https://kadammmmm.github.io/hand-raise-widget/supervisor-alert.js |
| Supervisor dashboard widget bundle (Nav Panel) | https://kadammmmm.github.io/hand-raise-widget/supervisor.js |
| Backend API | https://hand-raise-api.onrender.com/api |
| Backend health check | https://hand-raise-api.onrender.com/api/health |
| GitHub repo | https://github.com/kadammmmm/hand-raise-widget |
| Render dashboard | https://dashboard.render.com/web/srv-d9t3993m8hqs73ctb8ng |

These are the exact URLs already referenced in [docs/agent-layout.json](docs/agent-layout.json), [docs/supervisor-header-layout.json](docs/supervisor-header-layout.json), and [docs/supervisor-layout.json](docs/supervisor-layout.json) — no placeholder substitution needed when importing those into Control Hub.

## Desktop Layout Configuration (Control Hub)

This is the step that actually puts the widgets in front of agents and supervisors — hosting the bundles and standing up the backend does nothing until a Desktop Layout references them. None of this is scripted; it's a manual edit in Control Hub because layout changes affect every agent/supervisor assigned to that layout immediately on publish.

**Before you start:** open the layout you're about to edit and copy its current JSON somewhere safe (a scratch file, a gist — anything). If an import goes wrong or a widget breaks the desktop, pasting the original JSON back and republishing is the fastest way out. Treat this as a production change, not a draft.

### 1. Locate the layouts

1. Sign in to Control Hub (`admin.webex.com`) with an account that has Contact Center admin rights.
2. Go to **Contact Center -> Desktop Layouts**.
3. Identify which layout is assigned to your agents (usually via an Agent Profile) and which is assigned to your supervisors. These may be the same layout or two different ones — Hand Raise needs different widgets in each, so treat them separately even if they're currently one layout.

### 2. Agent layout — advancedHeader only

1. Open the agent's layout and switch to the JSON/code editor view.
2. Find the `advancedHeader` widgets array (create it if the layout doesn't have one yet).
3. Append the object from [docs/agent-layout.json](docs/agent-layout.json) as a new entry in that array — don't replace the array, add to it, so any existing header widgets (e.g. a queue stats widget) keep working alongside it.
4. Confirm `script` points at `https://kadammmmm.github.io/hand-raise-widget/agent.js` and `properties.backendUrl` points at `https://hand-raise-api.onrender.com/api` (both already correct in the snippet as committed).
5. Save, then **Publish**.

### 3. Supervisor layout — advancedHeader + new Nav Panel page

Two separate additions to the supervisor's layout:

1. **Header alert** — same as the agent steps above, but append the object from [docs/supervisor-header-layout.json](docs/supervisor-header-layout.json) (`comp: hand-raise-supervisor-alert`) into the supervisor layout's `advancedHeader` array.
2. **Nav Panel dashboard** — open [docs/supervisor-layout.json](docs/supervisor-layout.json) and merge its two top-level pieces into the supervisor layout:
   - the `nav` object into the layout's navigation entries (this is what puts "Hand Raise" in the left nav with the icon)
   - the `page` object into the layout's pages collection (this defines what that nav entry actually renders)
3. Save, then **Publish**.

The exact key names/nesting for `advancedHeader`, navigation entries, and pages can vary slightly by WxCC release — if Control Hub rejects the merged JSON, compare against an existing working widget entry in the same layout (e.g. your `wxcc-queue-widget` header entry) rather than assuming the snippet's shape is exactly right for your tenant.

### 4. Verify

- Agent: refresh (or re-login to) Agent Desktop. The hand icon should appear in the header immediately, with no separate page or panel tab.
- Supervisor: refresh Agent Desktop. Confirm both (a) the header badge widget appears, and (b) a new "Hand Raise" entry appears in the left nav.
- Run one end-to-end pass: agent raises a hand -> supervisor's header badge increments and a toast/notification fires -> supervisor acknowledges from the header popup -> agent's header panel shows "Supervisor X is reviewing" -> supervisor resolves from the Nav Panel page -> agent's panel clears and the request shows up in Nav Panel history.
- Check the browser console (F12) on both sides for script-load or CORS errors if a widget doesn't render — see Common Pitfalls in [README.md](README.md).

### Rollback

If a published layout breaks the desktop for agents or supervisors, paste back the JSON you saved in step 0 and republish. There's no automatic versioning on Control Hub layouts, so that manual backup is the only safety net.

## Widget Hosting (GitHub Pages)

Repo: `kadammmmm/hand-raise-widget` (public — GitHub Pages on a personal account's free plan requires a public repo).

Pages is configured to serve from the `main` branch root (`/`), which is why `agent.js`, `supervisor-alert.js`, and `supervisor.js` live at the repo root alongside `dist/` — see [package.json](package.json)'s `postbuild` script.

**To ship a widget change:**

```bash
npm install          # first time only
npm run build         # webpack -> dist/agent.js, dist/supervisor-alert.js, dist/supervisor.js
npm run postbuild      # copies all three into the repo root
git add -A
git commit -m "Update widgets"
git push
```

GitHub Pages rebuilds automatically on push to `main`. First build after a push typically takes 30–60 seconds; check status with:

```bash
gh api repos/kadammmmm/hand-raise-widget/pages/builds/latest
```

No manual Pages configuration is needed again unless the branch or path changes. If you ever need to recreate it from scratch:

```bash
gh api -X POST repos/kadammmmm/hand-raise-widget/pages -f "source[branch]=main" -f "source[path]=/"
```

## Backend Hosting (Render)

Service: `hand-raise-api` (id `srv-d9t3993m8hqs73ctb8ng`), free plan, region `oregon`, connected to `kadammmmm/hand-raise-widget` with root directory `backend`.

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Auto-deploy | on push to `main` |
| Plan | Free |

### Environment Variables

| Variable | Current value | Notes |
|---|---|---|
| `PORT` | set automatically by Render | do not override |
| `CORS_ORIGINS` | *(unset — allows all origins)* | **left open intentionally for now.** Before going to production, set this to the Agent Desktop origin (e.g. `https://desktop.wxcc-us1.cisco.com`) so the API only accepts requests from Control Hub-hosted widgets. |
| `REQUEST_TTL_HOURS` | `24` | how long resolved requests stay in `/api/hand-raise/history` |

To update env vars via the Render API:

```bash
curl -X PUT https://api.render.com/v1/services/srv-d9t3993m8hqs73ctb8ng/env-vars \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"key":"CORS_ORIGINS","value":"https://desktop.wxcc-us1.cisco.com"},{"key":"REQUEST_TTL_HOURS","value":"24"}]'
```

Or via the dashboard: Service -> Environment -> Add Environment Variable. Either path triggers a redeploy.

**To ship a backend change:** just push to `main` — Render auto-deploys `backend/` on every commit. To watch a deploy from the CLI:

```bash
curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/srv-d9t3993m8hqs73ctb8ng/deploys?limit=1"
```

### Free-tier caveats

Render's free plan spins the service down after ~15 minutes of inactivity. On the next request it cold-starts (can take 30–60s), and any in-memory hand-raise state and open SSE connections from before the spin-down are lost. `EventSource` on the client reconnects automatically once the service is back up, but agents/supervisors will see a gap in real-time updates during a cold start. Upgrade to a paid plan (or add Redis persistence) before relying on this for production traffic.

## Recreating the Render Service From Scratch

If the service is ever deleted, recreate it with:

```bash
curl -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "web_service",
    "name": "hand-raise-api",
    "ownerId": "tea-d45nm7qdbo4c73823p80",
    "repo": "https://github.com/kadammmmm/hand-raise-widget",
    "autoDeploy": "yes",
    "branch": "main",
    "rootDir": "backend",
    "serviceDetails": {
      "env": "node",
      "plan": "free",
      "region": "oregon",
      "envSpecificDetails": {
        "buildCommand": "npm install",
        "startCommand": "npm start"
      }
    },
    "envVars": [
      {"key": "REQUEST_TTL_HOURS", "value": "24"}
    ]
  }'
```

This will assign a new service id and, if `hand-raise-api` is taken, a different `.onrender.com` subdomain — update the URLs in `docs/*.json`, `README.md`, and this file if that happens.

## Post-Deploy Checklist

- [x] `agent.js` and `supervisor.js` return `200 OK` from GitHub Pages
- [ ] `supervisor-alert.js` returns `200 OK` from GitHub Pages (added after the advancedHeader rework — verify after next push)
- [x] `/api/health` returns `{"status":"ok"}` from Render
- [ ] `CORS_ORIGINS` locked down to the real Agent Desktop origin before production rollout
- [ ] `docs/agent-layout.json` and `docs/supervisor-header-layout.json` imported into the agent/supervisor `advancedHeader` sections, `docs/supervisor-layout.json` imported as the supervisor Nav Panel page
- [ ] End-to-end test: agent raises hand from the header -> supervisor gets a header toast + browser notification -> acknowledge/resolve round-trips back to the agent's header panel -> Nav Panel dashboard reflects the same state (grouped by team, in the summary counts, and in history once resolved)
