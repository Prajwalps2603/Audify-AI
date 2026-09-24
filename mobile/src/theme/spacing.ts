// TeleCaller AI — Spacing & Shadows

import {Platform} from 'react-native';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 9999,
};

export const Shadow = {
  sm: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    android: {elevation: 2},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    android: {elevation: 4},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: {elevation: 8},
  }),
  xl: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.16,
      shadowRadius: 24,
    },
    android: {elevation: 16},
  }),
};
