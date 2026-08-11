export const HAND_RAISE_REASONS = [
  { value: 'escalation', label: 'Escalation Needed', icon: 'icon-escalate' },
  { value: 'billing', label: 'Billing Question', icon: 'icon-currency' },
  { value: 'technical', label: 'Technical Issue', icon: 'icon-settings' },
  { value: 'upset_customer', label: 'Customer Upset', icon: 'icon-warning' },
  { value: 'policy', label: 'Policy Clarification', icon: 'icon-document' },
  { value: 'other', label: 'Other', icon: 'icon-help-circle' }
];

export const HAND_RAISE_STATUS = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved'
};

export const CHANNEL_TYPES = {
  VOICE: 'voice',
  CHAT: 'chat',
  EMAIL: 'email',
  SOCIAL: 'social',
  NONE: 'none'
};

export const CHANNEL_ICONS = {
  voice: 'icon-handset',
  chat: 'icon-chat',
  email: 'icon-email',
  social: 'icon-share',
  none: 'icon-circle'
};

export const SSE_EVENTS = {
  NEW: 'hand-raise:new',
  LOWERED: 'hand-raise:lowered',
  ACKNOWLEDGED: 'hand-raise:acknowledged',
  RESOLVED: 'hand-raise:resolved',
  MESSAGE: 'hand-raise:message'
};

export const NOTE_MAX_LENGTH = 280;
export const HISTORY_WINDOW_HOURS = 24;

// SLA escalation: how long a request can sit unacknowledged before the
// supervisor UI flags it (red border/pulse) and starts re-firing the chime.
export const DEFAULT_SLA_THRESHOLD_SECONDS = 90;
export const ESCALATION_CHIME_INTERVAL_MS = 30000;

export const HAND_RAISE_PRIORITIES = [
  { value: 'normal', label: 'Normal', weight: 0 },
  { value: 'urgent', label: 'Urgent', weight: 1 },
  { value: 'critical', label: 'Critical', weight: 2 }
];

export const DEFAULT_PRIORITY = 'normal';

// Critical requests re-fire the chime faster than a plain SLA breach, and
// are always treated as escalated regardless of elapsed time.
export const CRITICAL_CHIME_INTERVAL_MS = 15000;

export const MESSAGE_MAX_LENGTH = 280;

// Quick-reply templates a supervisor can pick to prefill the message box
// (still editable before sending) — mirrors the reason categories in that
// they're a starting point, not a locked-down list.
export const MESSAGE_TEMPLATES = [
  "I'm joining the call",
  'One moment please',
  'Transfer to Tier 2',
  'Offer a discount if appropriate',
  "Please continue, I'm monitoring",
  'Escalate to a manager'
];
