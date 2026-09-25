import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import {Colors, FontSize, Spacing} from '../theme';

interface BrandHeaderProps {
  rightAction?: React.ReactNode;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  variant?: 'light' | 'dark';
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({
  rightAction,
  subtitle,
  style,
  variant = 'light',
}) => {
  const isDark = variant === 'dark';

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftCol}>
        <View style={styles.brandRow}>
          <Image
            source={require('../assets/logo_icon_transparent.png')}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={[styles.brandTitle, isDark && styles.brandTitleDark]}>
            Audify<Text style={styles.brandAccent}> AI</Text>
          </Text>
        </View>
        {subtitle ? (
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAction ? <View style={styles.rightCol}>{rightAction}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  leftCol: {
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 32,
    height: 32,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  brandTitleDark: {
    color: '#FFFFFF',
  },
  brandAccent: {
    color: Colors.primary,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  subtitleDark: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default BrandHeader;
