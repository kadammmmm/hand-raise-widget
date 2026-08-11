import { render } from 'lit';

// Positions a fixed-position overlay panel below/left-aligned to a trigger
// element, clamped to the viewport. Mirrors the pattern proven by the
// wxcc-queue-widget's expandable header panels.
export function anchorBelow(triggerEl, panelWidth = 340) {
  const rect = triggerEl.getBoundingClientRect();
  return {
    top: rect.bottom + 8,
    left: Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
  };
}

// Renders overlay content into a shadow-rooted node appended directly to
// document.body instead of the widget's own shadow tree.
//
// Why: `position: fixed` is only relative to the true browser viewport if
// no ancestor establishes a new CSS containing block (transform, filter,
// perspective, or `contain: layout/paint/content/strict`). Host app shells
// commonly apply one of those to header/nav chrome for isolation or GPU
// compositing, which silently turns descendant `fixed` elements into
// something anchored to that ancestor's box instead of the viewport —
// visually landing the overlay far outside the visible area. Appending to
// document.body sidesteps this regardless of what the host page does
// upstream of the widget.
export function createPortal(styleSheets) {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  if (styleSheets?.length) shadow.adoptedStyleSheets = styleSheets;
  document.body.appendChild(host);
  return { host, shadow };
}

export function renderPortal(template, shadow) {
  render(template, shadow);
}

export function destroyPortal(host) {
  if (!host) return;
  render(null, host.shadowRoot);
  host.remove();
}
