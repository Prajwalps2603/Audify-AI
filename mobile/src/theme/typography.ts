// TeleCaller AI — Typography System

import {StyleSheet, Platform} from 'react-native';

export const FontFamily = {
  regular: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  medium: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  semiBold: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  bold: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
};

export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
};

export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
};

export const typography = StyleSheet.create({
  displayLarge: {
    fontSize: FontSize['5xl'],
    fontWeight: '700',
    letterSpacing: LetterSpacing.tight,
    lineHeight: 48,
  },
  displayMedium: {
    fontSize: FontSize['4xl'],
    fontWeight: '700',
    letterSpacing: LetterSpacing.tight,
    lineHeight: 38,
  },
  h1: {
    fontSize: FontSize['3xl'],
    fontWeight: '700',
    letterSpacing: LetterSpacing.tight,
    lineHeight: 34,
  },
  h2: {
    fontSize: FontSize['2xl'],
    fontWeight: '700',
    letterSpacing: LetterSpacing.tight,
    lineHeight: 30,
  },
  h3: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    lineHeight: 28,
  },
  h4: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    lineHeight: 24,
  },
  body1: {
    fontSize: FontSize.base,
    fontWeight: '400',
    lineHeight: 24,
  },
  body2: {
    fontSize: FontSize.md,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: FontSize.sm,
    fontWeight: '400',
    lineHeight: 20,
  },
  caption: {
    fontSize: FontSize.xs,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: LetterSpacing.wide,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: LetterSpacing.wide,
  },
  button: {
    fontSize: FontSize.base,
    fontWeight: '600',
    letterSpacing: LetterSpacing.wide,
  },
  buttonSmall: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    letterSpacing: LetterSpacing.wide,
  },
});
