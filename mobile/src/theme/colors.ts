// TeleCaller AI — Design System: Colors
// Premium White/Light Theme

export const Colors = {
  // Backgrounds
  background: '#F7F9FC',
  surface: '#FFFFFF',
  surfaceSecondary: '#EFF6FF',
  surfacePurple: '#F5F3FF',

  // Primary
  primary: '#2563EB',
  primaryLight: '#93C5FD',
  primaryDark: '#1E40AF',

  // Secondary / Purple
  secondary: '#7C3AED',
  secondaryLight: '#C4B5FD',
  secondaryDark: '#5B21B6',

  // Status
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  info: '#2563EB',
  infoLight: '#DBEAFE',

  // Text
  textPrimary: '#111827',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  // Borders & Dividers
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#E2E8F0',

  // Transcript Bubbles
  callerBubble: '#EFF6FF',
  callerBubbleBorder: '#BFDBFE',
  callerText: '#1E3A5F',
  receiverBubble: '#F5F3FF',
  receiverBubbleBorder: '#DDD6FE',
  receiverText: '#3B1F6E',

  // Gradients (start / end arrays for LinearGradient)
  gradientPrimary: ['#2563EB', '#7C3AED'] as string[],
  gradientLight: ['#EFF6FF', '#F5F3FF'] as string[],
  gradientCard: ['#FFFFFF', '#F7F9FC'] as string[],

  // Shadows
  shadowColor: '#0F172A',

  // Overlay
  overlay: 'rgba(15,23,42,0.5)',

  // Transparent
  transparent: 'transparent',
};

export type ColorKeys = keyof typeof Colors;
