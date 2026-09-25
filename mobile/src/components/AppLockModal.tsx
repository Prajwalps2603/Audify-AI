// TeleCaller AI — App Lock PIN Modal
// Premium security screen for unlocking or configuring App PIN Lock

import React, {useState, useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Spacing, Shadow} from '../theme';
import {AppLockService} from '../services/security/AppLockService';

interface AppLockModalProps {
  visible: boolean;
  mode: 'unlock' | 'setup';
  onSuccess: () => void;
  onCancel?: () => void;
}

export const AppLockModal: React.FC<AppLockModalProps> = ({
  visible,
  mode,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setPin('');
      setConfirmPin('');
      setStep('enter');
      setErrorMsg('');
    }
  }, [visible]);

  const handleDigitPress = async (digit: string) => {
    if (errorMsg) setErrorMsg('');

    if (mode === 'unlock') {
      const newPin = pin + digit;
      if (newPin.length <= 4) {
        setPin(newPin);
        if (newPin.length === 4) {
          const success = await AppLockService.unlockWithPin(newPin);
          if (success) {
            setPin('');
            onSuccess();
          } else {
            Vibration.vibrate(200);
            setErrorMsg('Incorrect PIN. Please try again.');
            setPin('');
          }
        }
      }
    } else {
      // Setup mode
      if (step === 'enter') {
        const newPin = pin + digit;
        if (newPin.length <= 4) {
          setPin(newPin);
          if (newPin.length === 4) {
            setStep('confirm');
          }
        }
      } else {
        const newConfirm = confirmPin + digit;
        if (newConfirm.length <= 4) {
          setConfirmPin(newConfirm);
          if (newConfirm.length === 4) {
            if (newConfirm === pin) {
              await AppLockService.setPin(pin);
              onSuccess();
            } else {
              Vibration.vibrate(200);
              setErrorMsg('PINs do not match. Start again.');
              setPin('');
              setConfirmPin('');
              setStep('enter');
            }
          }
        }
      }
    }
  };

  const handleDelete = () => {
    if (errorMsg) setErrorMsg('');
    if (mode === 'unlock' || step === 'enter') {
      setPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  const currentDigits = mode === 'unlock' || step === 'enter' ? pin : confirmPin;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={mode === 'setup' ? onCancel : undefined}>
      <SafeAreaView style={styles.container}>
        {/* Header Cancel (setup only) */}
        {mode === 'setup' && onCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Icon name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Icon
              name={mode === 'unlock' ? 'shield-lock' : 'lock-plus'}
              size={36}
              color={Colors.primary}
            />
          </View>

          <Text style={styles.title}>
            {mode === 'unlock'
              ? 'Audify AI Locked'
              : step === 'enter'
              ? 'Set App PIN'
              : 'Confirm Your PIN'}
          </Text>

          <Text style={styles.subtitle}>
            {mode === 'unlock'
              ? 'Enter your 4-digit security PIN to access call recordings and transcripts'
              : step === 'enter'
              ? 'Create a 4-digit PIN to protect your private recordings'
              : 'Re-enter your 4-digit PIN to confirm'}
          </Text>

          {/* PIN Indicators */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map(index => {
              const isFilled = currentDigits.length > index;
              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    isFilled && styles.dotFilled,
                    Boolean(errorMsg) && styles.dotError,
                  ]}
                />
              );
            })}
          </View>

          {Boolean(errorMsg) && <Text style={styles.errorText}>{errorMsg}</Text>}

          {/* Keypad */}
          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['', '0', 'del'],
            ].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((key, keyIndex) => {
                  if (key === '') {
                    return <View key={keyIndex} style={styles.keyBtnEmpty} />;
                  }
                  if (key === 'del') {
                    return (
                      <TouchableOpacity
                        key={keyIndex}
                        style={styles.keyBtn}
                        onPress={handleDelete}
                        activeOpacity={0.7}>
                        <Icon
                          name="backspace-outline"
                          size={24}
                          color={Colors.textPrimary}
                        />
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={keyIndex}
                      style={styles.keyBtn}
                      onPress={() => handleDigitPress(key)}
                      activeOpacity={0.7}>
                      <Text style={styles.keyText}>{key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  cancelBtn: {
    alignSelf: 'flex-start',
    padding: Spacing.lg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.md,
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
    height: 24,
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    transform: [{scale: 1.1}],
  },
  dotError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  keypad: {
    width: '100%',
    maxWidth: 280,
    marginTop: Spacing.lg,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  keyBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  keyBtnEmpty: {
    width: 72,
    height: 72,
  },
  keyText: {
    fontSize: FontSize['2xl'],
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
