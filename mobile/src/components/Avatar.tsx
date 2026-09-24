// TeleCaller AI — Avatar Component

import React from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';
import {Colors, BorderRadius, FontSize} from '../theme';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  style?: object;
}

const getInitials = (name: string): string => {
  if (!name || name === 'Unknown') return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const generateAvatarColor = (name: string): string => {
  const colors = [
    '#2563EB',
    '#7C3AED',
    '#DB2777',
    '#DC2626',
    '#D97706',
    '#059669',
    '#0891B2',
    '#4F46E5',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const Avatar: React.FC<AvatarProps> = ({
  name,
  photoUrl,
  size = 44,
  style,
}) => {
  const initials = getInitials(name);
  const bgColor = generateAvatarColor(name);
  const fontSize = size * 0.38;

  if (photoUrl) {
    return (
      <Image
        source={{uri: photoUrl}}
        style={[
          styles.image,
          {width: size, height: size, borderRadius: size / 2},
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
        style,
      ]}>
      <Text style={[styles.initials, {fontSize}]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.textInverse,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  image: {
    backgroundColor: Colors.border,
  },
});

export default Avatar;
