// Mirrors client/src/index.css's `.dark` palette — JobPilot ships one dark
// theme only (see client's ThemeContext), so mobile does the same.
export const colors = {
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceBorder: '#334155',
  primary: '#6366f1',
  secondary: '#22d3ee',
  textPrimary: '#f9fafb',
  textSecondary: '#94a3b8',
  danger: '#f87171',
  success: '#34d399',
  warning: '#fbbf24',
};

export const gradient = [colors.primary, colors.secondary] as const;
