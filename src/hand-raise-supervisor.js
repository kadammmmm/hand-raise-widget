import { LitElement, html, css } from 'lit';
import { Desktop } from '@wxcc-desktop/sdk';
import { sharedStyles } from './shared/styles.js';
import {
  HAND_RAISE_REASONS,
  HAND_RAISE_PRIORITIES,
  CHANNEL_ICONS,
  HISTORY_WINDOW_HOURS,
  DEFAULT_SLA_THRESHOLD_SECONDS,
  ESCALATION_CHIME_INTERVAL_MS,
  CRITICAL_CHIME_INTERVAL_MS,
  MESSAGE_TEMPLATES,
  MESSAGE_MAX_LENGTH
} from './shared/constants.js';
import { connectSSE } from './shared/sse-client.js';

Desktop.config.init();
window.handRaiseService = Desktop.agentContact?.SERVICE;

const REASON_LABELS = Object.fromEntries(HAND_RAISE_REASONS.map((r) => [r.value, r.label]));
const PRIORITY_LABELS = Object.fromEntries(HAND_RAISE_PRIORITIES.map((p) => [p.value, p.label]));
const PRIORITY_WEIGHTS = Object.fromEntries(HAND_RAISE_PRIORITIES.map((p) => [p.value, p.weight]));

class HandRaiseSupervisor extends LitElement {
  static properties = {
    darkmode: { type: String, reflect: true },
    backendUrl: { type: String, attribute: 'backend-url' },
    accessToken: { type: String, attribute: 'access-token' },
    slaThresholdSeconds: { type: Number, attribute: 'sla-threshold-seconds' },

    _supervisor: { state: true },
    _teams: { state: true },
    _activeRequests: { state: true },
    _history: { state: true },
    _tab: { state: true },
    _filterTeam: { state: true },
    _filterReason: { state: true },
    _filterChannel: { state: true },
    _sortMode: { state: true },
    _soundEnabled: { state: true },
    _composingId: { state: true },
    _messageText: { state: true },
    _now: { state: true },
    _connected: { state: true },
    _error: { state: true }
  };

  static styles = [sharedStyles, css`
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      gap: 12px;
      flex-wrap: wrap;
    }

    .tabs {
      display: flex;
      gap: 4px;
    }

    .tab-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-color);
    }

    .tab-btn.active {
      background: var(--primary-color);
      color: #fff;
      border-color: var(--primary-color);
    }

    .filters {
      display: flex;
      gap: 8px;
      padding: 0 16px 10px;
      flex-wrap: wrap;
    }

    .filters select {
      width: auto;
      min-width: 140px;
    }

    .sound-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-muted);
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .toolbar-right select {
      width: auto;
    }

    .cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 0 16px 16px;
      max-height: calc(100vh - 160px);
      overflow-y: auto;
    }

    .card {
      display: flex;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      background: var(--surface-color);
      align-items: flex-start;
    }

    .avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--primary-color);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 13px;
      flex-shrink: 0;
    }

    .card-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .card-top {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .agent-name {
      font-weight: 600;
      font-size: 13px;
    }

    .team-name {
      font-size: 11px;
      color: var(--text-muted);
    }

    .channel-badge {
      font-size: 11px;
      padding: 1px 8px;
      border-radius: 10px;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
    }

    .reason-badge {
      font-size: 11px;
      padding: 1px 8px;
      border-radius: 10px;
      background: rgba(79, 111, 218, 0.15);
      color: var(--primary-color);
      font-weight: 600;
    }

    .note-text {
      font-size: 12px;
      color: var(--text-color);
    }

    .card-meta-row {
      display: flex;
      gap: 10px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .card-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: stretch;
      flex-shrink: 0;
    }

    .empty-state {
      padding: 32px 16px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }

    .nav-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: var(--danger-color);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
    }

    .summary-row {
      display: flex;
      gap: 16px;
      padding: 0 16px 10px;
      flex-wrap: wrap;
    }

    .summary-stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 72px;
    }

    .summary-stat .value {
      font-size: 20px;
      font-weight: 700;
      line-height: 1;
    }

    .summary-stat .value.danger { color: var(--danger-color); }
    .summary-stat .value.warning { color: var(--warning-color); }

    .summary-stat .label {
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .team-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .team-group-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      padding-top: 4px;
    }

    .team-group-header .count {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 0 7px;
      font-weight: 700;
    }

    .interaction-copy {
      color: var(--primary-color);
      text-decoration: none;
      margin-left: 4px;
    }

    .card.escalated {
      border-color: var(--danger-color);
      box-shadow: 0 0 0 1px var(--danger-color);
      animation: pulse-bg 1.4s infinite;
    }

    .sla-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.4px;
      padding: 1px 7px;
      border-radius: 10px;
      background: var(--danger-color);
      color: #fff;
    }

    .message-preview {
      font-size: 11px;
      color: var(--text-muted);
      font-style: italic;
    }

    .compose-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--bg-color);
    }

    .compose-box select {
      font-size: 11px;
    }

    .compose-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
  `];

  constructor() {
    super();
    this.darkmode = 'false';
    this.backendUrl = '';
    this.accessToken = '';
    this.slaThresholdSeconds = DEFAULT_SLA_THRESHOLD_SECONDS;
    this._supervisor = null;
    this._teams = [];
    this._activeRequests = [];
    this._history = [];
    this._tab = 'active';
    this._filterTeam = '';
    this._filterReason = '';
    this._filterChannel = '';
    this._sortMode = 'priority';
    this._soundEnabled = true;
    this._composingId = null;
    this._messageText = '';
    this._now = Date.now();
    this._connected = false;
    this._error = '';
    this._eventSource = null;
    this._tickHandle = null;
    this._audioCtx = null;
    this._escalation = { requestId: null, lastFiredAt: 0 };
  }

  connectedCallback() {
    super.connectedCallback();
    this._init();
    this._tickHandle = setInterval(() => {
      this._now = Date.now();
      this._checkEscalation();
    }, 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._eventSource?.close();
    if (this._tickHandle) clearInterval(this._tickHandle);
  }

  async _init() {
    try {
      const personData = await Desktop.agentContact?.SERVICE?.webex?.fetchPersonData?.('me');
      this._supervisor = {
        id: personData?.id || 'unknown',
        name: personData?.displayName || personData?.name || 'Supervisor'
      };
      this._teams = personData?.teams || [];
    } catch {
      this._supervisor = { id: 'unknown', name: 'Supervisor' };
      this._teams = [];
    }

    await this._loadActive();
    this._connectStream();
  }

  async _loadActive() {
    try {
      const qs = this._filterTeam ? `?teamId=${encodeURIComponent(this._filterTeam)}` : '';
      const res = await fetch(`${this.backendUrl}/hand-raise${qs}`);
      if (!res.ok) throw new Error(`Failed to load requests (${res.status})`);
      this._activeRequests = await res.json();
    } catch (err) {
      this._error = err.message || 'Failed to load active requests';
    }
  }

  async _loadHistory() {
    try {
      const qs = this._filterTeam ? `?teamId=${encodeURIComponent(this._filterTeam)}` : '';
      const res = await fetch(`${this.backendUrl}/hand-raise/history${qs}`);
      if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
      this._history = await res.json();
    } catch (err) {
      this._error = err.message || 'Failed to load history';
    }
  }

  _connectStream() {
    if (!this.backendUrl) return;
    const qs = this._filterTeam ? `?teamId=${encodeURIComponent(this._filterTeam)}` : '';
    const url = `${this.backendUrl}/hand-raise/stream${qs}`;
    this._eventSource = connectSSE(url, {
      onOpen: () => (this._connected = true),
      onError: () => (this._connected = false),
      onNew: (data) => this._handleNew(data),
      onLowered: (data) => this._handleLowered(data),
      onAcknowledged: (data) => this._handleAcknowledged(data),
      onResolved: (data) => this._handleResolved(data),
      onMessage: (data) => this._handleMessageEvent(data)
    });
  }

  _handleNew(data) {
    this._activeRequests = [...this._activeRequests, data];
    this._notify(data);
  }

  _handleLowered(data) {
    this._activeRequests = this._activeRequests.filter((r) => r.id !== data.id);
  }

  _handleAcknowledged(data) {
    this._activeRequests = this._activeRequests.map((r) => (r.id === data.id ? { ...r, ...data } : r));
  }

  _handleResolved(data) {
    this._activeRequests = this._activeRequests.filter((r) => r.id !== data.id);
    if (this._tab === 'history') this._loadHistory();
  }

  _handleMessageEvent(data) {
    this._activeRequests = this._activeRequests.map((r) =>
      r.id === data.requestId ? { ...r, messages: [...(r.messages || []), data.message] } : r
    );
  }

  _notify(request) {
    if (Notification?.permission === 'granted') {
      new Notification('Hand Raise Request', {
        body: `${request.agentName} needs assistance (${REASON_LABELS[request.reason] || request.reason})`
      });
    }
    if (this._soundEnabled) this._playChime();
  }

  _requestNotificationPermission() {
    if (Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  _playChime() {
    try {
      if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this._audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // audio unavailable; ignore
    }
  }

  async _acknowledge(request) {
    try {
      await fetch(`${this.backendUrl}/hand-raise/${request.id}/acknowledge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId: this._supervisor.id, supervisorName: this._supervisor.name })
      });
    } catch (err) {
      this._error = err.message || 'Failed to acknowledge request';
    }
  }

  async _resolve(request) {
    try {
      await fetch(`${this.backendUrl}/hand-raise/${request.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId: this._supervisor.id, supervisorName: this._supervisor.name })
      });
    } catch (err) {
      this._error = err.message || 'Failed to resolve request';
    }
  }

  _openCompose(request) {
    this._composingId = request.id;
    this._messageText = '';
  }

  _closeCompose() {
    this._composingId = null;
    this._messageText = '';
  }

  async _sendMessage(request) {
    const message = this._messageText.trim();
    if (!message) return;
    try {
      await fetch(`${this.backendUrl}/hand-raise/${request.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorId: this._supervisor.id,
          supervisorName: this._supervisor.name,
          message: message.slice(0, MESSAGE_MAX_LENGTH)
        })
      });
      this._closeCompose();
    } catch (err) {
      this._error = err.message || 'Failed to send message';
    }
  }

  _switchTab(tab) {
    this._tab = tab;
    if (tab === 'history') this._loadHistory();
  }

  _elapsed(raisedAt) {
    const secs = Math.max(0, Math.floor((this._now - new Date(raisedAt).getTime()) / 1000));
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  _isEscalated(request) {
    if (!request || request.status !== 'active') return false;
    if (request.priority === 'critical') return true;
    const elapsedSec = (this._now - new Date(request.raisedAt).getTime()) / 1000;
    return elapsedSec >= this.slaThresholdSeconds;
  }

  _chimeIntervalFor(request) {
    return request.priority === 'critical' ? CRITICAL_CHIME_INTERVAL_MS : ESCALATION_CHIME_INTERVAL_MS;
  }

  _checkEscalation() {
    const sorted = [...this._activeRequests].sort((a, b) => {
      const weightDiff = (PRIORITY_WEIGHTS[b.priority] ?? 0) - (PRIORITY_WEIGHTS[a.priority] ?? 0);
      if (weightDiff !== 0) return weightDiff;
      return new Date(a.raisedAt) - new Date(b.raisedAt);
    });
    const top = sorted[0];
    if (!this._isEscalated(top)) {
      this._escalation.requestId = null;
      return;
    }
    if (this._escalation.requestId !== top.id) {
      this._escalation = { requestId: top.id, lastFiredAt: this._now };
      if (this._soundEnabled) this._playChime();
    } else if (this._now - this._escalation.lastFiredAt >= this._chimeIntervalFor(top)) {
      this._escalation.lastFiredAt = this._now;
      if (this._soundEnabled) this._playChime();
    }
  }

  _initials(name) {
    return (name || '?')
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  _filteredActive() {
    return this._activeRequests
      .filter((r) => !this._filterReason || r.reason === this._filterReason)
      .filter((r) => !this._filterChannel || r.channelType === this._filterChannel)
      .sort((a, b) => {
        if (this._sortMode === 'priority') {
          const weightDiff = (PRIORITY_WEIGHTS[b.priority] ?? 0) - (PRIORITY_WEIGHTS[a.priority] ?? 0);
          if (weightDiff !== 0) return weightDiff;
        }
        return new Date(a.raisedAt) - new Date(b.raisedAt);
      });
  }

  _groupedByTeam(requests) {
    const groups = new Map();
    for (const r of requests) {
      const key = r.teamId || r.teamName || 'unassigned';
      if (!groups.has(key)) groups.set(key, { teamName: r.teamName || 'Unassigned', requests: [] });
      groups.get(key).requests.push(r);
    }
    return Array.from(groups.values()).sort(
      (a, b) => new Date(a.requests[0].raisedAt) - new Date(b.requests[0].raisedAt)
    );
  }

  async _copyInteractionId(id) {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // clipboard unavailable; the id is still visible in the row
    }
  }

  render() {
    const list = this._tab === 'active' ? this._filteredActive() : this._history;
    return html`
      <div class="header">
        <div>
          <p class="header-title">
            Hand Raise
            ${this._activeRequests.length > 0
              ? html`<span class="nav-badge">${this._activeRequests.length}</span>`
              : ''}
          </p>
          <a class="header-subtitle" href="#" @click=${(e) => e.preventDefault()}>powered by Bucher + Suter</a>
        </div>
        <span class="live-pill"><span class="dot"></span>${this._connected ? 'LIVE' : 'OFFLINE'}</span>
      </div>

      <div class="toolbar">
        <div class="tabs">
          <button class="tab-btn ${this._tab === 'active' ? 'active' : ''}" @click=${() => this._switchTab('active')}>
            Active (${this._activeRequests.length})
          </button>
          <button class="tab-btn ${this._tab === 'history' ? 'active' : ''}" @click=${() => this._switchTab('history')}>
            History (${HISTORY_WINDOW_HOURS}h)
          </button>
        </div>
        <div class="toolbar-right">
          <select @change=${(e) => (this._sortMode = e.target.value)}>
            <option value="priority" ?selected=${this._sortMode === 'priority'}>Sort: Priority</option>
            <option value="time" ?selected=${this._sortMode === 'time'}>Sort: Oldest</option>
          </select>
          <label class="sound-toggle">
            <input
              type="checkbox"
              .checked=${this._soundEnabled}
              @change=${(e) => {
                this._soundEnabled = e.target.checked;
                this._requestNotificationPermission();
              }}
            />
            Sound
          </label>
        </div>
      </div>

      <div class="filters">
        <select @change=${(e) => { this._filterTeam = e.target.value; this._loadActive(); this._eventSource?.close(); this._connectStream(); }}>
          <option value="">All Teams</option>
          ${this._teams.map((t) => html`<option value=${t.id}>${t.name}</option>`)}
        </select>
        <select @change=${(e) => (this._filterReason = e.target.value)}>
          <option value="">All Reasons</option>
          ${HAND_RAISE_REASONS.map((r) => html`<option value=${r.value}>${r.label}</option>`)}
        </select>
        <select @change=${(e) => (this._filterChannel = e.target.value)}>
          <option value="">All Channels</option>
          ${Object.keys(CHANNEL_ICONS).filter((c) => c !== 'none').map((c) => html`<option value=${c}>${c}</option>`)}
        </select>
      </div>

      ${this._tab === 'active' ? this._renderSummaryRow() : ''}

      <div class="cards">
        ${list.length === 0
          ? html`<div class="empty-state">No ${this._tab === 'active' ? 'active requests' : 'history'} to show.</div>`
          : this._tab === 'active' && !this._filterTeam
            ? this._groupedByTeam(list).map((g) => this._renderTeamGroup(g))
            : list.map((r) => this._renderCard(r))}
      </div>
    `;
  }

  _renderSummaryRow() {
    const active = this._activeRequests.filter((r) => r.status === 'active').length;
    const acknowledged = this._activeRequests.filter((r) => r.status === 'acknowledged').length;
    return html`
      <div class="summary-row">
        <div class="summary-stat">
          <span class="value danger">${active}</span>
          <span class="label">Waiting</span>
        </div>
        <div class="summary-stat">
          <span class="value warning">${acknowledged}</span>
          <span class="label">Acknowledged</span>
        </div>
        <div class="summary-stat">
          <span class="value">${this._activeRequests.length}</span>
          <span class="label">Total Active</span>
        </div>
      </div>
    `;
  }

  _renderTeamGroup(group) {
    return html`
      <div class="team-group">
        <div class="team-group-header">
          <span>${group.teamName}</span>
          <span class="count">${group.requests.length}</span>
        </div>
        ${group.requests.map((r) => this._renderCard(r))}
      </div>
    `;
  }

  _renderCard(request) {
    const isHistory = this._tab === 'history';
    const escalated = !isHistory && this._isEscalated(request);
    return html`
      <div class="card ${escalated ? 'escalated' : ''}">
        <div class="avatar">${this._initials(request.agentName)}</div>
        <div class="card-main">
          <div class="card-top">
            <span class="agent-name">${request.agentName}</span>
            <span class="team-name">${request.teamName}</span>
            <span class="channel-badge">${request.channelType}</span>
            <span class="reason-badge">${REASON_LABELS[request.reason] || request.reason}</span>
            ${request.priority && request.priority !== 'normal'
              ? html`
                  <span class="priority-badge ${request.priority}">
                    <span class="priority-dot ${request.priority}"></span>
                    ${PRIORITY_LABELS[request.priority] || request.priority}
                  </span>
                `
              : ''}
            ${!isHistory
              ? html`<span class="status-pill ${request.status}">${request.status}</span>`
              : ''}
            ${escalated && request.priority !== 'critical' ? html`<span class="sla-badge">SLA</span>` : ''}
          </div>
          ${request.note ? html`<div class="note-text">${request.note}</div>` : ''}
          <div class="card-meta-row">
            ${!isHistory
              ? html`<span>Elapsed: ${this._elapsed(request.raisedAt)}</span>`
              : html`<span>Raised: ${new Date(request.raisedAt).toLocaleTimeString()}</span>`}
            ${request.interactionId
              ? html`<span>
                  Interaction: ${request.interactionId}
                  <a
                    class="interaction-copy"
                    href="#"
                    @click=${(e) => {
                      e.preventDefault();
                      this._copyInteractionId(request.interactionId);
                    }}
                    >copy</a
                  >
                </span>`
              : ''}
            ${isHistory && request.acknowledgedBy ? html`<span>By: ${request.acknowledgedBy}</span>` : ''}
          </div>
          ${!isHistory && this._composingId !== request.id && request.messages?.length
            ? html`
                <div class="message-preview">
                  You: "${request.messages[request.messages.length - 1].message}"
                </div>
              `
            : ''}
          ${!isHistory && this._composingId === request.id ? this._renderCompose(request) : ''}
        </div>
        ${!isHistory
          ? html`
              <div class="card-actions">
                ${request.status === 'active'
                  ? html`<button class="primary" @click=${() => this._acknowledge(request)}>Acknowledge</button>`
                  : ''}
                <button class="secondary" @click=${() => this._openCompose(request)}>Message</button>
                <button class="secondary" @click=${() => this._resolve(request)}>Resolve</button>
              </div>
            `
          : ''}
      </div>
    `;
  }

  _renderCompose(request) {
    return html`
      <div class="compose-box">
        <select
          @change=${(e) => {
            if (e.target.value) this._messageText = e.target.value;
            e.target.value = '';
          }}
        >
          <option value="">Quick reply...</option>
          ${MESSAGE_TEMPLATES.map((t) => html`<option value=${t}>${t}</option>`)}
        </select>
        <textarea
          rows="2"
          maxlength=${MESSAGE_MAX_LENGTH}
          placeholder="Message to ${request.agentName}"
          .value=${this._messageText}
          @input=${(e) => (this._messageText = e.target.value)}
        ></textarea>
        <div class="compose-actions">
          <button class="secondary" @click=${() => this._closeCompose()}>Cancel</button>
          <button class="primary" ?disabled=${!this._messageText.trim()} @click=${() => this._sendMessage(request)}>
            Send
          </button>
        </div>
      </div>
    `;
  }
}

customElements.define('hand-raise-supervisor', HandRaiseSupervisor);
