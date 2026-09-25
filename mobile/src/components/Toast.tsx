// TeleCaller AI — Premium Toast Notification System
// Animated slide-in toasts with glassmorphic styling.

import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Spacing} from '../theme';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastConfig {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState extends ToastConfig {
  id: number;
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'information',
  warning: 'alert',
};

const TOAST_COLORS: Record<ToastType, {bg: string; border: string; icon: string; iconBg: string; text: string; subtext: string}> = {
  success: {
    bg: '#FFFFFF',
    border: '#D1FAE5',
    icon: '#059669',
    iconBg: '#D1FAE5',
    text: '#0F172A',
    subtext: '#64748B',
  },
  error: {
    bg: '#FFFFFF',
    border: '#FEE2E2',
    icon: '#DC2626',
    iconBg: '#FEE2E2',
    text: '#0F172A',
    subtext: '#64748B',
  },
  info: {
    bg: '#FFFFFF',
    border: '#DBEAFE',
    icon: '#2563EB',
    iconBg: '#DBEAFE',
    text: '#0F172A',
    subtext: '#64748B',
  },
  warning: {
    bg: '#FFFFFF',
    border: '#FEF3C7',
    icon: '#D97706',
    iconBg: '#FEF3C7',
    text: '#0F172A',
    subtext: '#64748B',
  },
};

// ─── Global Toast Manager ──────────────────────────────────────
let _toastRef: ToastContainerRef | null = null;

interface ToastContainerRef {
  show: (config: ToastConfig) => void;
}

export function showToast(config: ToastConfig) {
  _toastRef?.show(config);
}

// Convenience methods
export const toast = {
  success: (title: string, message?: string) =>
    showToast({type: 'success', title, message}),
  error: (title: string, message?: string) =>
    showToast({type: 'error', title, message}),
  info: (title: string, message?: string) =>
    showToast({type: 'info', title, message}),
  warning: (title: string, message?: string) =>
    showToast({type: 'warning', title, message}),
};

// ─── Single Toast Item ────────────────────────────────────────
const ToastItem: React.FC<{
  toast: ToastState;
  onDismiss: (id: number) => void;
}> = ({toast: t, onDismiss}) => {
  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const colors = TOAST_COLORS[t.type];
  const iconName = TOAST_ICONS[t.type];
  const duration = t.duration ?? 2000; // 2 seconds as requested

  useEffect(() => {
    // Slide up from bottom
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after 2s
    const timer = setTimeout(() => {
      dismissToast();
    }, duration);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 60,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(t.id);
    });
  };

  return (
    <Animated.View
      style={[
        styles.toastItem,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          transform: [{translateY}, {scale}],
          opacity,
        },
      ]}>
      <View style={[styles.toastIconContainer, {backgroundColor: colors.iconBg}]}>
        <Icon name={iconName} size={20} color={colors.icon} />
      </View>
      <View style={styles.toastContent}>
        <Text style={[styles.toastTitle, {color: colors.text}]}>{t.title}</Text>
        {t.message ? (
          <Text style={[styles.toastMessage, {color: colors.subtext}]} numberOfLines={2}>
            {t.message}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={dismissToast}
        style={styles.toastClose}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        <Icon name="close" size={16} color="#64748B" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Toast Container (mount once at app root) ─────────────────
export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const idCounter = useRef(0);

  const show = useCallback((config: ToastConfig) => {
    const id = ++idCounter.current;
    setToasts(prev => [...prev.slice(-1), {...config, id}]); // Keep max 2
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Register ref
  useEffect(() => {
    _toastRef = {show};
    return () => {
      _toastRef = null;
    };
  }, [show]);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 85, // Center bottom of the screen, right above bottom navigation tabs
    left: 0,
    right: 0,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  toastItem: {
    width: Math.min(SCREEN_WIDTH - 36, 420),
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: 8,
    elevation: 8,
    shadowColor: '#64748B',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  toastIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  toastMessage: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  toastClose: {
    marginLeft: 8,
    padding: 4,
  },
});
