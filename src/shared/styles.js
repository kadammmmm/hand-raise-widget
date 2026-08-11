import { css } from 'lit';

// Bucher + Suter brand book (https://brandbook.bucher-suter.com/color/,
// /typography/): Blue 600/Turquoise 600/Yellow 600/Red 600 are the brand's
// own accent tiers, mapped here to our semantic roles since the brand book
// doesn't define CTA/warning/error usage itself. Instrument Sans is the
// brand's primary operational/UI font (GT Planar is marketing-only and not
// freely licensable for a bundled widget); loaded via @font-face so the
// widget doesn't depend on the host page linking it.
export const sharedStyles = css`
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&display=swap');

  :host {
    --primary-color: #4f6fda;
    --success-color: #00dadf;
    --warning-color: #ffbc2a;
    --danger-color: #ff5c5f;
    --accent-orange: #ff8a30;
    --hand-raise-active: #ff5c5f;
    --hand-raise-idle: #8a8f98;

    --bg-color: #ffffff;
    --surface-color: #f7f7f7;
    --text-color: #000000;
    --text-muted: #5f6368;
    --border-color: #e8e8e8;

    font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Tahoma, Arial, Helvetica, sans-serif;
    display: block;
    color: var(--text-color);
    background: var(--bg-color);
    box-sizing: border-box;
  }

  :host([darkmode='true']) {
    --bg-color: #1e1f21;
    --surface-color: #2a2b2e;
    --text-color: #f2f2f2;
    --text-muted: #a3a6ab;
    --border-color: #3d3f42;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .header-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .header-subtitle {
    font-size: 11px;
    color: var(--accent-orange);
    text-decoration: none;
  }

  .live-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    background: var(--success-color);
    border-radius: 12px;
    padding: 2px 10px;
    letter-spacing: 0.5px;
  }

  .live-pill .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #fff;
    animation: pulse-dot 1.5s infinite ease-in-out;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 12px;
    padding: 2px 10px;
    color: #fff;
  }

  .status-pill.active {
    background: var(--danger-color);
    animation: pulse-bg 1.4s infinite;
  }

  .status-pill.acknowledged {
    background: var(--warning-color);
    animation: none;
  }

  .status-pill.resolved {
    background: var(--success-color);
  }

  .footer {
    display: flex;
    justify-content: space-between;
    padding: 8px 16px;
    font-size: 10px;
    color: var(--text-muted);
    border-top: 1px solid var(--border-color);
  }

  button {
    font-family: inherit;
    cursor: pointer;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    padding: 8px 14px;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  button:active {
    transform: scale(0.97);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  button.primary {
    background: var(--primary-color);
    color: #fff;
  }

  button.danger {
    background: var(--danger-color);
    color: #fff;
  }

  button.secondary {
    background: transparent;
    color: var(--text-color);
    border: 1px solid var(--border-color);
  }

  input[type='text'],
  textarea,
  select {
    font-family: inherit;
    font-size: 13px;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--bg-color);
    color: var(--text-color);
    width: 100%;
  }

  @keyframes pulse-bg {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.8); }
  }

  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(255, 92, 95, 0.5); }
    70% { box-shadow: 0 0 0 12px rgba(255, 92, 95, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 92, 95, 0); }
  }

  /* === Header trigger + floating overlay panel ===
     Used by advancedHeader widgets: a small always-visible control that
     expands into a fixed-position panel anchored to the trigger via
     getBoundingClientRect, so it isn't clipped by the header's height. */

  .header-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px;
    border-radius: 16px;
    border: none;
    background: var(--surface-color);
    color: var(--text-color);
  }

  .header-trigger .icon-badge {
    position: relative;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--hand-raise-idle);
    color: #fff;
    font-size: 12px;
    flex-shrink: 0;
  }

  .header-trigger .icon-badge.raised {
    background: var(--hand-raise-active);
    animation: pulse-ring 1.6s infinite;
  }

  .header-trigger .icon-badge.acknowledged {
    background: var(--warning-color);
    animation: none;
  }

  .count-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 7px;
    background: var(--danger-color);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    line-height: 14px;
    text-align: center;
  }

  .overlay-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: transparent;
  }

  .overlay-panel {
    position: fixed;
    min-width: 320px;
    max-width: 400px;
    max-height: 70vh;
    overflow-y: auto;
    background: var(--bg-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
    z-index: 10000;
    animation: slide-down 0.15s ease-out;
  }

  @keyframes slide-down {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .overlay-panel .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-color);
  }

  .overlay-panel .panel-title {
    font-size: 13px;
    font-weight: 600;
  }

  .overlay-panel .close-btn {
    background: transparent;
    color: var(--text-muted);
    padding: 2px 6px;
    font-size: 14px;
  }

  .overlay-panel .panel-body {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Toast notification (auto-dismissing, stacked top-right of the trigger) */
  .toast {
    position: fixed;
    z-index: 10001;
    min-width: 260px;
    max-width: 340px;
    background: var(--bg-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    border-left: 3px solid var(--danger-color);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    padding: 10px 12px;
    font-size: 12px;
    animation: slide-down 0.15s ease-out;
  }

  .toast .toast-title {
    font-weight: 600;
    margin-bottom: 2px;
  }

  .priority-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-block;
  }

  .priority-dot.normal { background: var(--text-muted); }
  .priority-dot.urgent { background: var(--warning-color); }
  .priority-dot.critical { background: var(--danger-color); }

  .priority-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .priority-badge.critical {
    color: var(--danger-color);
  }
`;
