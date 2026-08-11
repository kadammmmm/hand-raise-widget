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
