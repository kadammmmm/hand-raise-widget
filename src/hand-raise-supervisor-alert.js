import { LitElement, html, css } from 'lit';
import { Desktop } from '@wxcc-desktop/sdk';
import { sharedStyles } from './shared/styles.js';
import { HAND_RAISE_REASONS, CHANNEL_ICONS } from './shared/constants.js';
import { connectSSE } from './shared/sse-client.js';
import { anchorBelow, createPortal, renderPortal, destroyPortal } from './shared/overlay.js';

Desktop.config.init();
window.handRaiseService = Desktop.agentContact?.SERVICE;

const REASON_LABELS = Object.fromEntries(HAND_RAISE_REASONS.map((r) => [r.value, r.label]));
const TOAST_AUTO_DISMISS_MS = 8000;

const alertStyles = css`
  :host {
    display: inline-block;
  }

  .toast-stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .toast-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .toast button {
    font-size: 11px;
    padding: 4px 10px;
  }

  .request-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--surface-color);
  }

  .request-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .agent-name {
    font-weight: 600;
    font-size: 12px;
  }

  .reason-badge {
    font-size: 10px;
    padding: 1px 7px;
    border-radius: 10px;
    background: rgba(0, 188, 235, 0.15);
    color: var(--primary-color);
    font-weight: 600;
  }

  .note-text {
    font-size: 11px;
    color: var(--text-color);
  }

  .meta-row {
    display: flex;
    gap: 8px;
    font-size: 10px;
    color: var(--text-muted);
  }

  .row-actions {
    display: flex;
    gap: 6px;
  }

  .row-actions button {
    font-size: 11px;
    padding: 4px 10px;
  }

  .empty-state {
    font-size: 12px;
    color: var(--text-muted);
    padding: 4px 0;
  }
`;

// advancedHeader widget: always-visible badge + pop-up alert for supervisors,
// mirroring inContact's "agent requests -> supervisor accepts via pop-up"
// pattern. Quick triage only (acknowledge / resolve / copy interaction id);
// filters, grouping, and 24h history live in the hand-raise-supervisor Nav
// Panel page.
class HandRaiseSupervisorAlert extends LitElement {
  static properties = {
    darkmode: { type: String, reflect: true },
    backendUrl: { type: String, attribute: 'backend-url' },
    accessToken: { type: String, attribute: 'access-token' },

    _supervisor: { state: true },
    _activeRequests: { state: true },
    _panelOpen: { state: true },
    _panelPosition: { state: true },
    _toasts: { state: true },
    _connected: { state: true },
    _now: { state: true }
  };

  static styles = [sharedStyles, alertStyles];

  constructor() {
    super();
    this.darkmode = 'false';
    this.backendUrl = '';
    this.accessToken = '';
    this._supervisor = null;
    this._activeRequests = [];
    this._panelOpen = false;
    this._panelPosition = { top: 0, left: 0 };
    this._toasts = [];
    this._connected = false;
    this._now = Date.now();
    this._eventSource = null;
    this._tickHandle = null;
    this._audioCtx = null;
    this._portal = null;
    this._onDocClick = (e) => this._handleDocumentClick(e);
  }

  connectedCallback() {
    super.connectedCallback();
    this._init();
    document.addEventListener('click', this._onDocClick, true);
    this._tickHandle = setInterval(() => (this._now = Date.now()), 1000);
    this._portal = createPortal([sharedStyles.styleSheet, alertStyles.styleSheet]);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._eventSource?.close();
    document.removeEventListener('click', this._onDocClick, true);
    if (this._tickHandle) clearInterval(this._tickHandle);
    destroyPortal(this._portal?.host);
  }

  updated() {
    if (!this._portal) return;
    this._portal.host.setAttribute('darkmode', this.darkmode);
    renderPortal(
      html`${this._renderToasts()}${this._panelOpen ? this._renderPanel() : ''}`,
      this._portal.shadow
    );
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
    this._pushToast(data);
    this._notify(data);
  }

  _patchRequest(data) {
    this._activeRequests = this._activeRequests.map((r) => (r.id === data.id ? { ...r, ...data } : r));
  }

  _removeRequest(id) {
    this._activeRequests = this._activeRequests.filter((r) => r.id !== id);
    this._toasts = this._toasts.filter((t) => t.request.id !== id);
  }

  _pushToast(request) {
    const toastId = `${request.id}-${Date.now()}`;
    this._toasts = [...this._toasts, { toastId, request }];
    setTimeout(() => {
      this._toasts = this._toasts.filter((t) => t.toastId !== toastId);
    }, TOAST_AUTO_DISMISS_MS);
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

  _handleDocumentClick(e) {
    if (!this._panelOpen) return;
    const path = e.composedPath();
    if (!path.includes(this) && !path.includes(this._portal?.host)) this._panelOpen = false;
  }

  _toggleTrigger(e) {
    e.stopPropagation();
    this._requestNotificationPermission();
    if (this._panelOpen) {
      this._panelOpen = false;
      return;
    }
    const trigger = this.shadowRoot.querySelector('.header-trigger');
    this._panelPosition = anchorBelow(trigger, 340);
    this._panelOpen = true;
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

  async _copyInteractionId(id) {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // clipboard unavailable; the id is still visible in the row
    }
  }

  _elapsed(raisedAt) {
    const secs = Math.max(0, Math.floor((this._now - new Date(raisedAt).getTime()) / 1000));
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  render() {
    const count = this._activeRequests.length;
    return html`
      <button class="header-trigger" @click=${(e) => this._toggleTrigger(e)}>
        <span class="icon-badge ${count > 0 ? 'raised' : ''}">
          ✋
          ${count > 0 ? html`<span class="count-badge">${count}</span>` : ''}
        </span>
        <span class="label">Hand Raise</span>
      </button>
    `;
  }

  _renderToasts() {
    if (!this._toasts.length) return '';
    return html`
      <div class="toast-stack" style="position: fixed; top: 56px; right: 16px; z-index: 10001;">
        ${this._toasts.map(
          (t) => html`
            <div class="toast">
              <div class="toast-title">${t.request.agentName} needs assistance</div>
              <div class="note-text">${REASON_LABELS[t.request.reason] || t.request.reason}</div>
              ${t.request.note ? html`<div class="note-text">"${t.request.note}"</div>` : ''}
              <div class="toast-actions">
                <button class="primary" @click=${() => this._acknowledge(t.request)}>Acknowledge</button>
                <button
                  class="secondary"
                  @click=${() => (this._toasts = this._toasts.filter((x) => x.toastId !== t.toastId))}
                >
                  Dismiss
                </button>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  _renderPanel() {
    const sorted = [...this._activeRequests].sort((a, b) => new Date(a.raisedAt) - new Date(b.raisedAt));
    return html`
      <div class="overlay-backdrop" @click=${() => (this._panelOpen = false)}></div>
      <div
        class="overlay-panel"
        style="top: ${this._panelPosition.top}px; left: ${this._panelPosition.left}px;"
        @click=${(e) => e.stopPropagation()}
      >
        <div class="panel-header">
          <span class="panel-title">Active Requests (${sorted.length})</span>
          <button class="close-btn" @click=${() => (this._panelOpen = false)}>✕</button>
        </div>
        <div class="panel-body">
          ${sorted.length === 0
            ? html`<div class="empty-state">No active hand-raise requests.</div>`
            : sorted.map((r) => this._renderRow(r))}
        </div>
      </div>
    `;
  }

  _renderRow(request) {
    return html`
      <div class="request-row">
        <div class="request-top">
          <span class="agent-name">${request.agentName}</span>
          <span class="reason-badge">${REASON_LABELS[request.reason] || request.reason}</span>
          <span class="status-pill ${request.status}">${request.status}</span>
        </div>
        ${request.note ? html`<div class="note-text">${request.note}</div>` : ''}
        <div class="meta-row">
          <span>${CHANNEL_ICONS[request.channelType] ? request.channelType : request.channelType}</span>
          <span>Elapsed: ${this._elapsed(request.raisedAt)}</span>
          ${request.interactionId
            ? html`<span>
                Interaction: ${request.interactionId}
                <a href="#" @click=${(e) => { e.preventDefault(); this._copyInteractionId(request.interactionId); }}>copy</a>
              </span>`
            : ''}
        </div>
        <div class="row-actions">
          ${request.status === 'active'
            ? html`<button class="primary" @click=${() => this._acknowledge(request)}>Acknowledge</button>`
            : ''}
          <button class="secondary" @click=${() => this._resolve(request)}>Resolve</button>
        </div>
      </div>
    `;
  }
}

customElements.define('hand-raise-supervisor-alert', HandRaiseSupervisorAlert);
