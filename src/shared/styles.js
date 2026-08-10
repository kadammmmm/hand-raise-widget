import { css } from 'lit';

export const sharedStyles = css`
  :host {
    --primary-color: #00bceb;
    --success-color: #28a745;
    --warning-color: #f59e0b;
    --danger-color: #dc3545;
    --hand-raise-active: #dc3545;
    --hand-raise-idle: #6c757d;

    --bg-color: #ffffff;
    --surface-color: #f7f8fa;
    --text-color: #1c1e21;
    --text-muted: #6c757d;
    --border-color: #e1e4e8;

    font-family: 'CiscoSansTT', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
    color: #ff8800;
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
    0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.5); }
    70% { box-shadow: 0 0 0 12px rgba(220, 53, 69, 0); }
    100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
  }
`;
