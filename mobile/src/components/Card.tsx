// TeleCaller AI — Card Component

import React from 'react';
import {View, StyleSheet, ViewStyle} from 'react-native';
import {Colors, BorderRadius, Shadow} from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined' | 'flat';
  padding?: number;
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'elevated',
  padding = 16,
}) => {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        variant === 'flat' && styles.flat,
        {padding},
        style,
      ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
  },
  elevated: {
    ...(Shadow.md as object),
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  flat: {
    backgroundColor: Colors.background,
  },
});

export default Card;
