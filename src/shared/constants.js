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
  RESOLVED: 'hand-raise:resolved'
};

export const NOTE_MAX_LENGTH = 280;
export const HISTORY_WINDOW_HOURS = 24;

// SLA escalation: how long a request can sit unacknowledged before the
// supervisor UI flags it (red border/pulse) and starts re-firing the chime.
export const DEFAULT_SLA_THRESHOLD_SECONDS = 90;
export const ESCALATION_CHIME_INTERVAL_MS = 30000;
