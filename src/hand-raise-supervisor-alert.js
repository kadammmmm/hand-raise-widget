import { LitElement, html, css } from 'lit';
import { Desktop } from '@wxcc-desktop/sdk';
import { sharedStyles } from './shared/styles.js';
import { HAND_RAISE_REASONS } from './shared/constants.js';
import { connectSSE } from './shared/sse-client.js';

Desktop.config.init();
window.handRaiseService = Desktop.agentContact?.SERVICE;

const REASON_LABELS = Object.fromEntries(HAND_RAISE_REASONS.map((r) => [r.value, r.label]));

const alertStyles = css`
  :host {
    display: inline-flex;
  }

  .header-trigger {
    max-width: 100%;
  }

  .header-trigger.expanded {
    padding: 0 12px 0 10px;
    gap: 10px;
    border-radius: 18px;
    background: rgba(220, 53, 69, 0.12);
  }

  .summary {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }

  .summary .agent-name {
    font-weight: 600;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
  }

  .summary .reason {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .more-count {
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .row-actions {
    display: flex;
    gap: 4px;
  }

  .row-actions button {
    font-size: 11px;
    padding: 3px 8px;
  }
`;

// advancedHeader widget: an always-visible hand icon that expands inline
// with the oldest active request's summary + quick actions when one comes
// in, instead of a floating pop-up/toast. Deliberately avoids
// position:fixed/absolute entirely: those depend on where the real browser
// viewport is, which turned out to render unpredictably inside the
// Supervisor Agent Desktop header chrome (some ancestor there changes what
// "fixed" is relative to, and it varies by host shell). Plain inline
// content in normal document flow has none of that risk. Full request
// list, filters, and history still live in the hand-raise-supervisor Nav
// Panel page — this widget is deliberately just "notice it and act now".
class HandRaiseSupervisorAlert extends LitElement {
  static properties = {
    darkmode: { type: String, reflect: true },
    backendUrl: { type: String, attribute: 'backend-url' },
    accessToken: { type: String, attribute: 'access-token' },

    _supervisor: { state: true },
    _activeRequests: { state: true },
    _connected: { state: true }
  };

  static styles = [sharedStyles, alertStyles];

  constructor() {
    super();
    this.darkmode = 'false';
    this.backendUrl = '';
    this.accessToken = '';
    this._supervisor = null;
    this._activeRequests = [];
    this._connected = false;
    this._eventSource = null;
    this._audioCtx = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._init();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._eventSource?.close();
  }

  async _init() {
    try {
      const personData = await Desktop.agentContact?.SERVICE?.webex?.fetchPersonData?.('me');
      this._supervisor = {
        id: personData?.id || 'unknown',
        name: personData?.displayName || personData?.name || 'Supervisor'
      };
    } catch {
      this._supervisor = { id: 'unknown', name: 'Supervisor' };
    }

    await this._loadActive();
    this._connectStream();
  }

  async _loadActive() {
    try {
      const res = await fetch(`${this.backendUrl}/hand-raise`);
      if (res.ok) this._activeRequests = await res.json();
    } catch {
      // header widget stays silent on load failure; Nav Panel surfaces errors
    }
  }

  _connectStream() {
    if (!this.backendUrl) return;
    this._eventSource = connectSSE(`${this.backendUrl}/hand-raise/stream`, {
      onOpen: () => (this._connected = true),
      onError: () => (this._connected = false),
      onNew: (data) => this._handleNew(data),
      onLowered: (data) => this._removeRequest(data.id),
      onAcknowledged: (data) => this._patchRequest(data),
      onResolved: (data) => this._removeRequest(data.id)
    });
  }

  _handleNew(data) {
    this._activeRequests = [...this._activeRequests, data];
    this._notify(data);
  }

  _patchRequest(data) {
    this._activeRequests = this._activeRequests.map((r) => (r.id === data.id ? { ...r, ...data } : r));
  }

  _removeRequest(id) {
    this._activeRequests = this._activeRequests.filter((r) => r.id !== id);
  }

  _notify(request) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Hand Raise Request', {
        body: `${request.agentName} needs assistance (${REASON_LABELS[request.reason] || request.reason})`
      });
    }
    this._playChime();
  }

  _requestNotificationPermission() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
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
    } catch {
      // best-effort; supervisor can retry from the Nav Panel dashboard
    }
  }

  async _resolve(request) {
    try {
      await fetch(`${this.backendUrl}/hand-raise/${request.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId: this._supervisor.id, supervisorName: this._supervisor.name })
      });
    } catch {
      // best-effort; supervisor can retry from the Nav Panel dashboard
    }
  }

  _oldestSorted() {
    return [...this._activeRequests].sort((a, b) => new Date(a.raisedAt) - new Date(b.raisedAt));
  }

  render() {
    const sorted = this._oldestSorted();
    const count = sorted.length;

    if (count === 0) {
      return html`
        <button class="header-trigger" @click=${() => this._requestNotificationPermission()}>
          <span class="icon-badge">✋</span>
          <span class="label">Hand Raise</span>
        </button>
      `;
    }

    const oldest = sorted[0];
    return html`
      <div class="header-trigger expanded">
        <span class="icon-badge raised">
          ✋
          <span class="count-badge">${count}</span>
        </span>
        <span class="summary">
          <span class="agent-name">${oldest.agentName}</span>
          <span class="reason">${REASON_LABELS[oldest.reason] || oldest.reason}</span>
        </span>
        <div class="row-actions">
          ${oldest.status === 'active'
            ? html`<button class="primary" @click=${() => this._acknowledge(oldest)}>Acknowledge</button>`
            : html`<span class="status-pill acknowledged">acknowledged</span>`}
          <button class="secondary" @click=${() => this._resolve(oldest)}>Resolve</button>
        </div>
        ${count > 1 ? html`<span class="more-count">+${count - 1} more</span>` : ''}
      </div>
    `;
  }
}

customElements.define('hand-raise-supervisor-alert', HandRaiseSupervisorAlert);
