import { LitElement, html, css } from 'lit';
import { Desktop } from '@wxcc-desktop/sdk';
import { sharedStyles } from './shared/styles.js';
import { HAND_RAISE_REASONS, NOTE_MAX_LENGTH, HAND_RAISE_STATUS } from './shared/constants.js';
import { connectSSE } from './shared/sse-client.js';

Desktop.config.init();
window.handRaiseService = Desktop.agentContact?.SERVICE;

class HandRaiseAgent extends LitElement {
  static properties = {
    darkmode: { type: String, reflect: true },
    backendUrl: { type: String, attribute: 'backend-url' },
    accessToken: { type: String, attribute: 'access-token' },

    _agent: { state: true },
    _interaction: { state: true },
    _status: { state: true },
    _requestId: { state: true },
    _reason: { state: true },
    _note: { state: true },
    _formOpen: { state: true },
    _elapsedSeconds: { state: true },
    _acknowledgedBy: { state: true },
    _lastMessage: { state: true },
    _submitting: { state: true },
    _error: { state: true }
  };

  static styles = [sharedStyles, css`
    .body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .hand-toggle {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      border-radius: 10px;
      background: var(--surface-color);
      border: 1px solid var(--border-color);
    }

    .hand-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      background: var(--hand-raise-idle);
      color: #fff;
      flex-shrink: 0;
      transition: background 0.2s ease;
    }

    .hand-icon.raised {
      background: var(--hand-raise-active);
      animation: pulse-ring 1.6s infinite;
    }

    .hand-icon.acknowledged {
      background: var(--warning-color);
      animation: none;
    }

    .hand-meta {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .hand-label {
      font-weight: 600;
      font-size: 14px;
    }

    .hand-timer {
      font-size: 12px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    .toggle-btn {
      flex-shrink: 0;
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 10px;
    }

    label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .char-count {
      font-size: 10px;
      color: var(--text-muted);
      text-align: right;
    }

    .form-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .notification {
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 12px;
      background: var(--surface-color);
      border-left: 3px solid var(--primary-color);
    }

    .error {
      color: var(--danger-color);
      font-size: 12px;
    }

    .no-interaction {
      font-size: 12px;
      color: var(--text-muted);
      padding: 8px;
    }
  `];

  constructor() {
    super();
    this.darkmode = 'false';
    this.backendUrl = '';
    this.accessToken = '';
    this._agent = null;
    this._interaction = null;
    this._status = HAND_RAISE_STATUS.RESOLVED;
    this._requestId = null;
    this._reason = HAND_RAISE_REASONS[0].value;
    this._note = '';
    this._formOpen = false;
    this._elapsedSeconds = 0;
    this._acknowledgedBy = null;
    this._lastMessage = '';
    this._submitting = false;
    this._error = '';
    this._timerHandle = null;
    this._eventSource = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._initAgentContext();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopTimer();
    this._eventSource?.close();
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
    } catch (err) {
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

  _openForm() {
    this._formOpen = true;
    this._error = '';
  }

  _closeForm() {
    this._formOpen = false;
    this._reason = HAND_RAISE_REASONS[0].value;
    this._note = '';
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
      this._interaction = interaction;
      this._formOpen = false;
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

  _renderHandIcon() {
    const raised = this._status === HAND_RAISE_STATUS.ACTIVE;
    const acknowledged = this._status === HAND_RAISE_STATUS.ACKNOWLEDGED;
    const cls = raised ? 'raised' : acknowledged ? 'acknowledged' : '';
    return html`<div class="hand-icon ${cls}">✋</div>`;
  }

  render() {
    const isRaised = this._status !== HAND_RAISE_STATUS.RESOLVED;

    return html`
      <div class="header">
        <div>
          <p class="header-title">Hand Raise</p>
          <a class="header-subtitle" href="#" @click=${(e) => e.preventDefault()}>powered by bucher+suter</a>
        </div>
      </div>

      <div class="body">
        <div class="hand-toggle">
          ${this._renderHandIcon()}
          <div class="hand-meta">
            <span class="hand-label">${isRaised ? 'Hand Raised' : 'Raise Hand'}</span>
            ${isRaised ? html`<span class="hand-timer">${this._formatElapsed()}</span>` : ''}
          </div>
          <button
            class="toggle-btn ${isRaised ? 'secondary' : 'primary'}"
            ?disabled=${this._submitting}
            @click=${() => (isRaised ? this._lowerHand() : this._openForm())}
          >
            ${isRaised ? 'Lower' : 'Raise'}
          </button>
        </div>

        ${this._formOpen ? this._renderForm() : ''}
        ${this._lastMessage ? html`<div class="notification">${this._lastMessage}</div>` : ''}
        ${this._error ? html`<div class="error">${this._error}</div>` : ''}
      </div>
    `;
  }

  _renderForm() {
    return html`
      <div class="form">
        <div>
          <label for="reason">Reason</label>
          <select id="reason" .value=${this._reason} @change=${(e) => (this._reason = e.target.value)}>
            ${HAND_RAISE_REASONS.map((r) => html`<option value=${r.value}>${r.label}</option>`)}
          </select>
        </div>
        <div>
          <label for="note">Note (optional)</label>
          <textarea
            id="note"
            rows="2"
            maxlength=${NOTE_MAX_LENGTH}
            .value=${this._note}
            @input=${(e) => (this._note = e.target.value)}
          ></textarea>
          <div class="char-count">${this._note.length} / ${NOTE_MAX_LENGTH}</div>
        </div>
        <div class="form-actions">
          <button class="secondary" @click=${() => this._closeForm()}>Cancel</button>
          <button class="danger" ?disabled=${this._submitting} @click=${() => this._submitHandRaise()}>
            Submit
          </button>
        </div>
      </div>
    `;
  }
}

customElements.define('hand-raise-agent', HandRaiseAgent);
