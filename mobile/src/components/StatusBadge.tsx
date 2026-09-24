// TeleCaller AI — Status Badge Component

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {ProcessingStatus} from '../types';
import {Colors, BorderRadius, FontSize} from '../theme';

interface StatusBadgeProps {
  status: ProcessingStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<
  ProcessingStatus,
  {label: string; bg: string; text: string; dot: string}
> = {
  COMPLETED: {
    label: 'Completed',
    bg: Colors.successLight,
    text: Colors.success,
    dot: Colors.success,
  },
  PROCESSING: {
    label: 'Processing',
    bg: Colors.infoLight,
    text: Colors.primary,
    dot: Colors.primary,
  },
  UPLOADING: {
    label: 'Uploading',
    bg: Colors.infoLight,
    text: Colors.primary,
    dot: Colors.primary,
  },
  TRANSCRIBING: {
    label: 'Transcribing',
    bg: Colors.surfacePurple,
    text: Colors.secondary,
    dot: Colors.secondary,
  },
  SAVING: {
    label: 'Saving',
    bg: Colors.infoLight,
    text: Colors.primary,
    dot: Colors.primary,
  },
  PENDING: {
    label: 'Pending',
    bg: Colors.warningLight,
    text: Colors.warning,
    dot: Colors.warning,
  },
  DISCOVERED: {
    label: 'Discovered',
    bg: Colors.borderLight,
    text: Colors.textSecondary,
    dot: Colors.textSecondary,
  },
  FAILED: {
    label: 'Failed',
    bg: Colors.errorLight,
    text: Colors.error,
    dot: Colors.error,
  },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({status, size = 'md'}) => {
  const config = statusConfig[status];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {backgroundColor: config.bg},
        isSmall && styles.badgeSm,
      ]}>
      <View style={[styles.dot, {backgroundColor: config.dot}]} />
      <Text
        style={[
          styles.label,
          {color: config.text},
          isSmall && styles.labelSm,
        ]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: FontSize.xs,
  },
});

export default StatusBadge;
