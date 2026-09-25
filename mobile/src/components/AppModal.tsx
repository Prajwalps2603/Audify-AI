// TeleCaller AI — Custom App Modal
// Premium popup modal replacing native Alert.alert with OK + Cancel buttons.

import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Spacing} from '../theme';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export type ModalVariant = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface ModalButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface ModalConfig {
  title: string;
  message: string;
  variant?: ModalVariant;
  buttons?: ModalButton[];
  icon?: string;
}

const VARIANT_CONFIG: Record<ModalVariant, {icon: string; color: string; bgColor: string}> = {
  info: {icon: 'information-outline', color: '#2563EB', bgColor: '#EFF6FF'},
  success: {icon: 'check-circle-outline', color: '#16A34A', bgColor: '#F0FDF4'},
  warning: {icon: 'alert-outline', color: '#F59E0B', bgColor: '#FFFBEB'},
  error: {icon: 'alert-circle-outline', color: '#DC2626', bgColor: '#FEF2F2'},
  confirm: {icon: 'help-circle-outline', color: '#7C3AED', bgColor: '#F5F3FF'},
};

// ─── Global Modal Manager ──────────────────────────────────────
let _modalRef: AppModalRef | null = null;

interface AppModalRef {
  show: (config: ModalConfig) => void;
}

export function showModal(
  title: string,
  message: string,
  buttons?: ModalButton[],
  variant?: ModalVariant,
) {
  _modalRef?.show({title, message, buttons, variant});
}

// Convenience: confirm dialog with OK + Cancel
export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText: string = 'Confirm',
  onCancel?: () => void,
) {
  showModal(
    title,
    message,
    [
      {text: 'Cancel', style: 'cancel', onPress: onCancel},
      {text: confirmText, onPress: onConfirm},
    ],
    'confirm',
  );
}

// Convenience: destructive confirm
export function showDestructiveConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText: string = 'Delete',
) {
  showModal(
    title,
    message,
    [
      {text: 'Cancel', style: 'cancel'},
      {text: confirmText, style: 'destructive', onPress: onConfirm},
    ],
    'error',
  );
}

// Convenience: simple info alert with OK (supports both positional and object syntax)
export function showAlert(
  titleOrConfig: string | {title: string; message: string; variant?: ModalVariant; buttons?: ModalButton[]},
  message?: string,
  onOk?: () => void,
) {
  if (typeof titleOrConfig === 'object') {
    _modalRef?.show({
      title: titleOrConfig.title,
      message: titleOrConfig.message,
      buttons: titleOrConfig.buttons ?? [{text: 'OK'}],
      variant: titleOrConfig.variant ?? 'info',
    });
  } else {
    showModal(titleOrConfig, message ?? '', [{text: 'OK', onPress: onOk}], 'info');
  }
}

// Convenience: selection dialog (replaces Alert with multiple options)
export function showSelection(
  title: string,
  message: string,
  options: {text: string; onPress: () => void; selected?: boolean}[],
) {
  _modalRef?.show({
    title,
    message,
    variant: 'info',
    buttons: [
      ...options.map(o => ({
        text: o.selected ? `${o.text}  ✓` : o.text,
        onPress: o.onPress,
        style: 'default' as const,
      })),
      {text: 'Cancel', style: 'cancel' as const},
    ],
  });
}

// ─── Modal Container (mount once at app root) ──────────────────
export const AppModalContainer: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<ModalConfig | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const show = useCallback((cfg: ModalConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  useEffect(() => {
    _modalRef = {show};
    return () => {
      _modalRef = null;
    };
  }, [show]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleClose = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setConfig(null);
      callback?.();
    });
  };

  if (!config) return null;

  const variant = config.variant || 'info';
  const vc = VARIANT_CONFIG[variant];
  const buttons = config.buttons || [{text: 'OK'}];
  const hasMultipleButtons = buttons.length > 1;
  const isSelectionMode = buttons.length > 3;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => handleClose()}>
      <TouchableWithoutFeedback onPress={() => handleClose()}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View
              style={[
                styles.modalCard,
                {
                  transform: [{scale: scaleAnim}],
                  opacity: opacityAnim,
                },
              ]}>
              {/* Icon header */}
              <View style={[styles.iconCircle, {backgroundColor: vc.bgColor}]}>
                <Icon
                  name={config.icon || vc.icon}
                  size={32}
                  color={vc.color}
                />
              </View>

              {/* Title */}
              <Text style={styles.modalTitle}>{config.title}</Text>

              {/* Message */}
              <Text style={styles.modalMessage}>{config.message}</Text>

              {/* Buttons */}
              {isSelectionMode ? (
                <View style={styles.selectionContainer}>
                  {buttons.map((btn, idx) => {
                    const isCancel = btn.style === 'cancel';
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.selectionBtn,
                          isCancel && styles.selectionCancelBtn,
                          btn.text.includes('✓') && styles.selectionSelectedBtn,
                        ]}
                        onPress={() => handleClose(btn.onPress)}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.selectionBtnText,
                            isCancel && styles.selectionCancelText,
                            btn.text.includes('✓') && styles.selectionSelectedText,
                          ]}>
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={[
                    styles.buttonRow,
                    !hasMultipleButtons && styles.buttonRowSingle,
                  ]}>
                  {buttons.map((btn, idx) => {
                    const isCancel = btn.style === 'cancel';
                    const isDestructive = btn.style === 'destructive';
                    const isPrimary = !isCancel && !isDestructive;

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.modalBtn,
                          hasMultipleButtons && styles.modalBtnFlex,
                          isPrimary && styles.modalBtnPrimary,
                          isCancel && styles.modalBtnCancel,
                          isDestructive && styles.modalBtnDestructive,
                        ]}
                        onPress={() => handleClose(btn.onPress)}
                        activeOpacity={0.8}>
                        <Text
                          style={[
                            styles.modalBtnText,
                            isPrimary && styles.modalBtnTextPrimary,
                            isCancel && styles.modalBtnTextCancel,
                            isDestructive && styles.modalBtnTextDestructive,
                          ]}>
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    width: SCREEN_WIDTH - 56,
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius['2xl'],
    paddingTop: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: -0.3,
  },
  modalMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  buttonRowSingle: {
    justifyContent: 'center',
  },
  modalBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  modalBtnFlex: {
    flex: 1,
  },
  modalBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  modalBtnCancel: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnDestructive: {
    backgroundColor: '#DC2626',
  },
  modalBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  modalBtnTextPrimary: {
    color: Colors.textInverse,
  },
  modalBtnTextCancel: {
    color: Colors.textSecondary,
  },
  modalBtnTextDestructive: {
    color: Colors.textInverse,
  },
  // Selection mode (many options)
  selectionContainer: {
    width: '100%',
    gap: Spacing.sm,
  },
  selectionBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  selectionCancelBtn: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    marginTop: Spacing.xs,
  },
  selectionSelectedBtn: {
    backgroundColor: Colors.surfaceSecondary,
    borderColor: Colors.primary,
  },
  selectionBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  selectionCancelText: {
    color: Colors.textTertiary,
  },
  selectionSelectedText: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
