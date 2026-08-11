import { LitElement, html, css } from 'lit';
import { Desktop } from '@wxcc-desktop/sdk';
import { sharedStyles } from './shared/styles.js';
import { HAND_RAISE_REASONS, NOTE_MAX_LENGTH, HAND_RAISE_STATUS } from './shared/constants.js';
import { connectSSE } from './shared/sse-client.js';
import { anchorBelow, createPortal, renderPortal, destroyPortal } from './shared/overlay.js';

Desktop.config.init();
window.handRaiseService = Desktop.agentContact?.SERVICE;

const agentStyles = css`
  :host {
    display: inline-block;
  }

  .timer-inline {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }

  .label {
    font-size: 12px;
    font-weight: 600;
  }

  label.field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .char-count {
    font-size: 10px;
    color: var(--text-muted);
    text-align: right;
  }

  .panel-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .notification {
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 12px;
    background: var(--surface-color);
    border-left: 3px solid var(--primary-color);
  }

  .error {
    color: var(--danger-color);
    font-size: 12px;
  }
`;

// advancedHeader-only widget: a compact hand icon that lives in the
// always-visible header strip and expands into a floating panel on click.
// No dedicated page or auxiliary panel tab — raise/lower is the whole feature.
class HandRaiseAgent extends LitElement {
  static properties = {
    darkmode: { type: String, reflect: true },
    backendUrl: { type: String, attribute: 'backend-url' },
    accessToken: { type: String, attribute: 'access-token' },

    _agent: { state: true },
    _status: { state: true },
    _requestId: { state: true },
    _reason: { state: true },
    _note: { state: true },
    _panelOpen: { state: true },
    _panelPosition: { state: true },
    _elapsedSeconds: { state: true },
    _acknowledgedBy: { state: true },
    _lastMessage: { state: true },
    _submitting: { state: true },
    _error: { state: true }
  };

  static styles = [sharedStyles, agentStyles];

  constructor() {
    super();
    this.darkmode = 'false';
    this.backendUrl = '';
    this.accessToken = '';
    this._agent = null;
    this._status = HAND_RAISE_STATUS.RESOLVED;
    this._requestId = null;
    this._reason = HAND_RAISE_REASONS[0].value;
    this._note = '';
    this._panelOpen = false;
    this._panelPosition = { top: 0, left: 0 };
    this._elapsedSeconds = 0;
    this._acknowledgedBy = null;
    this._lastMessage = '';
    this._submitting = false;
    this._error = '';
    this._timerHandle = null;
    this._eventSource = null;
    this._portal = null;
    this._onDocClick = (e) => this._handleDocumentClick(e);
  }

  connectedCallback() {
    super.connectedCallback();
    this._initAgentContext();
    document.addEventListener('click', this._onDocClick, true);
    this._portal = createPortal([sharedStyles.styleSheet, agentStyles.styleSheet]);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopTimer();
    this._eventSource?.close();
    document.removeEventListener('click', this._onDocClick, true);
    destroyPortal(this._portal?.host);
  }

  updated() {
    if (!this._portal) return;
    this._portal.host.setAttribute('darkmode', this.darkmode);
    renderPortal(this._panelOpen ? this._renderPanel(this._status !== HAND_RAISE_STATUS.RESOLVED) : html``, this._portal.shadow);
  }

  async _initAgentContext() {
    try {
      const personData = await Desktop.agentContact?.SERVICE?.webex?.fetchPersonData?.('me');
      this._agent = {
        id: personData?.id || personData?.agentId || 'unknown',
        name: personData?.displayName || personData?.name || 'Agent',
        teamId: personData?.teamId || '',
        teamName: personData?.teamName || ''
      };
    } catch {
      this._agent = { id: 'unknown', name: 'Agent', teamId: '', teamName: '' };
    }

    this._connectAgentStream();
  }

  _connectAgentStream() {
    if (!this.backendUrl || !this._agent?.id) return;
    const url = `${this.backendUrl}/hand-raise/stream/agent?agentId=${encodeURIComponent(this._agent.id)}`;
    this._eventSource = connectSSE(url, {
      onAcknowledged: (data) => this._handleAcknowledged(data),
      onResolved: (data) => this._handleResolved(data)
    });
  }

  _getActiveInteraction() {
    const contacts = Desktop.agentContact?.SERVICE?.contacts || Desktop.agentContact?.contacts;
    if (!contacts) return { interactionId: null, channelType: 'none' };
    try {
      const entries = Object.values(contacts);
      const active = entries.find((c) => c?.state && c.state !== 'wrapup' && c.state !== 'inactive');
      if (!active) return { interactionId: null, channelType: 'none' };
      return {
        interactionId: active.interactionId || active.id || null,
        channelType: active.mediaType || active.channelType || 'voice'
      };
    } catch {
      return { interactionId: null, channelType: 'none' };
    }
  }

  _handleDocumentClick(e) {
    if (!this._panelOpen) return;
    const path = e.composedPath();
    if (!path.includes(this) && !path.includes(this._portal?.host)) {
      this._panelOpen = false;
    }
  }

  _toggleTrigger(e) {
    e.stopPropagation();
    if (this._panelOpen) {
      this._panelOpen = false;
      return;
    }
    const trigger = this.shadowRoot.querySelector('.header-trigger');
    this._panelPosition = anchorBelow(trigger, 320);
    this._panelOpen = true;
    this._error = '';
  }

  async _submitHandRaise() {
    if (this._submitting) return;
    this._submitting = true;
    this._error = '';

    const interaction = this._getActiveInteraction();

    try {
      const res = await fetch(`${this.backendUrl}/hand-raise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: this._agent.id,
          agentName: this._agent.name,
          teamId: this._agent.teamId,
          teamName: this._agent.teamName,
          interactionId: interaction.interactionId,
          channelType: interaction.channelType,
          reason: this._reason,
          note: this._note.slice(0, NOTE_MAX_LENGTH)
        })
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();

      this._requestId = data.id;
      this._status = HAND_RAISE_STATUS.ACTIVE;
      this._panelOpen = false;
      this._elapsedSeconds = 0;
      this._acknowledgedBy = null;
      this._lastMessage = '';
      this._startTimer();
    } catch (err) {
      this._error = err?.details?.msg?.errorMessage || err.message || 'Failed to raise hand';
    } finally {
      this._submitting = false;
    }
  }

  async _lowerHand() {
    if (this._submitting) return;
    this._submitting = true;
    this._error = '';

    try {
      await fetch(`${this.backendUrl}/hand-raise/${encodeURIComponent(this._agent.id)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      this._error = err?.details?.msg?.errorMessage || err.message || 'Failed to lower hand';
    } finally {
      this._resetState();
      this._submitting = false;
    }
  }

  _handleAcknowledged(data) {
    if (data.id !== this._requestId) return;
    this._status = HAND_RAISE_STATUS.ACKNOWLEDGED;
    this._acknowledgedBy = data.acknowledgedBy;
    this._lastMessage = `Supervisor ${data.acknowledgedBy} is reviewing your request`;
  }

  _handleResolved(data) {
    if (data.id !== this._requestId) return;
    this._lastMessage = `Request resolved by ${data.resolvedBy || data.acknowledgedBy || 'supervisor'}`;
    setTimeout(() => this._resetState(), 3000);
  }

  _resetState() {
    this._status = HAND_RAISE_STATUS.RESOLVED;
    this._requestId = null;
    this._acknowledgedBy = null;
    this._panelOpen = false;
    this._stopTimer();
    this._elapsedSeconds = 0;
  }

  _startTimer() {
    this._stopTimer();
    this._timerHandle = setInterval(() => {
      this._elapsedSeconds += 1;
    }, 1000);
  }

  _stopTimer() {
    if (this._timerHandle) {
      clearInterval(this._timerHandle);
      this._timerHandle = null;
    }
  }

  _formatElapsed() {
    const m = Math.floor(this._elapsedSeconds / 60).toString().padStart(2, '0');
    const s = (this._elapsedSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  render() {
    const isRaised = this._status !== HAND_RAISE_STATUS.RESOLVED;
    const iconCls =
      this._status === HAND_RAISE_STATUS.ACTIVE ? 'raised' : this._status === HAND_RAISE_STATUS.ACKNOWLEDGED ? 'acknowledged' : '';

    return html`
      <button class="header-trigger" @click=${(e) => this._toggleTrigger(e)}>
        <span class="icon-badge ${iconCls}">✋</span>
        <span class="label">${isRaised ? 'Hand Raised' : 'Raise Hand'}</span>
        ${isRaised ? html`<span class="timer-inline">${this._formatElapsed()}</span>` : ''}
      </button>
    `;
  }

  _renderPanel(isRaised) {
    return html`
      <div class="overlay-backdrop" @click=${() => (this._panelOpen = false)}></div>
      <div
        class="overlay-panel"
        style="top: ${this._panelPosition.top}px; left: ${this._panelPosition.left}px;"
        @click=${(e) => e.stopPropagation()}
      >
        <div class="panel-header">
          <span class="panel-title">Hand Raise</span>
          <button class="close-btn" @click=${() => (this._panelOpen = false)}>✕</button>
        </div>
        <div class="panel-body">
          ${isRaised ? this._renderStatusBody() : this._renderRaiseForm()}
          ${this._lastMessage ? html`<div class="notification">${this._lastMessage}</div>` : ''}
          ${this._error ? html`<div class="error">${this._error}</div>` : ''}
        </div>
      </div>
    `;
  }

  _renderStatusBody() {
    return html`
      <div class="notification">
        ${this._status === HAND_RAISE_STATUS.ACKNOWLEDGED
          ? `Supervisor ${this._acknowledgedBy || ''} is reviewing your request.`
          : 'Waiting for a supervisor to respond.'}
      </div>
      <div class="panel-actions">
        <button class="secondary" ?disabled=${this._submitting} @click=${() => this._lowerHand()}>Lower Hand</button>
      </div>
    `;
  }

  _renderRaiseForm() {
    return html`
      <div>
        <label class="field-label" for="reason">Reason</label>
        <select id="reason" .value=${this._reason} @change=${(e) => (this._reason = e.target.value)}>
          ${HAND_RAISE_REASONS.map((r) => html`<option value=${r.value}>${r.label}</option>`)}
        </select>
      </div>
      <div>
        <label class="field-label" for="note">Note (optional)</label>
        <textarea
          id="note"
          rows="2"
          maxlength=${NOTE_MAX_LENGTH}
          .value=${this._note}
          @input=${(e) => (this._note = e.target.value)}
        ></textarea>
        <div class="char-count">${this._note.length} / ${NOTE_MAX_LENGTH}</div>
      </div>
      <div class="panel-actions">
        <button class="secondary" @click=${() => (this._panelOpen = false)}>Cancel</button>
        <button class="danger" ?disabled=${this._submitting} @click=${() => this._submitHandRaise()}>Submit</button>
      </div>
    `;
  }
}

customElements.define('hand-raise-agent', HandRaiseAgent);
