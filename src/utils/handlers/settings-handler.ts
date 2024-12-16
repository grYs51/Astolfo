export const SETTING_FLAGS = {
  VOICE_CHANNEL_REMINDER: 1 << 0, // 0001 = 1
  // WELCOME_MESSAGE: 1 << 1, // 0010 = 2
  // LEAVE_MESSAGE: 1 << 2, // 0100 = 4
} as const;

export const SETTINGS_LABELS: Record<Settings, string> = {
  // WELCOME_MESSAGE: 'Send Welcome Message',
  // LEAVE_MESSAGE: 'Send Leave Message',
  VOICE_CHANNEL_REMINDER: 'Voice Channel Reminder',
} as const;

export type Settings = keyof typeof SETTING_FLAGS;

export const isEnabled = (toggles: number, feature: number) =>
  (toggles & feature) !== 0;

export const enableFeature = (toggles: number, feature: number) =>
  toggles | feature;

export const disableFeature = (toggles: number, feature: number) =>
  toggles & ~feature;

export const toggleFeature = (toggles: number, feature: number) =>
  isEnabled(toggles, feature)
    ? disableFeature(toggles, feature)
    : enableFeature(toggles, feature);

export const toggleArray = Object.entries(SETTING_FLAGS).map(([key]) => ({
  key,
  label: `${SETTINGS_LABELS[key as Settings]}`,
}));
