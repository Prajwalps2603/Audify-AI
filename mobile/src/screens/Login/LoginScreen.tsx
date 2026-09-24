// TeleCaller AI — Login Screen (Phase 2)
// Real Google OAuth Sign-In using @react-native-google-signin/google-signin.
// IMPORTANT: Requires WEB_CLIENT_ID to be set in AuthService.ts
//            and google-services.json placed in android/app/

import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../types';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import {useAuth} from '../../context/AuthContext';

const {width} = Dimensions.get('window');

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Login'
>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

// ─────────────────────────────────────────────────────────────
// Waveform visual decoration
// ─────────────────────────────────────────────────────────────
const WaveformVisual: React.FC = () => {
  const bars = [
    0.3, 0.6, 0.9, 0.7, 1.0, 0.8, 0.5, 0.9, 0.6, 0.4, 0.7, 0.95, 0.5, 0.3,
    0.65,
  ];
  return (
    <View style={styles.waveformContainer}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={[
            styles.waveBar,
            {
              height: h * 40,
              backgroundColor:
                i % 3 === 0
                  ? Colors.primary
                  : i % 3 === 1
                  ? Colors.secondary
                  : Colors.primaryLight,
              opacity: 0.7 + h * 0.3,
            },
          ]}
        />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Hero Visual
// ─────────────────────────────────────────────────────────────
const HeroVisual: React.FC = () => (
  <View style={styles.heroContainer}>
    <View style={styles.glowRing} />
    <View style={styles.middleRing} />
    <View style={styles.centerCircle}>
      <Text style={styles.phoneIcon}>📞</Text>
    </View>
    <View style={[styles.sparkDot, styles.sparkTopRight]} />
    <View style={[styles.sparkDot, styles.sparkBottomLeft]} />
    <View style={[styles.sparkDot, styles.sparkTopLeft]} />
  </View>
);

// ─────────────────────────────────────────────────────────────
// Login Screen
// ─────────────────────────────────────────────────────────────
const LoginScreen: React.FC<Props> = ({navigation}) => {
  const {authState, signIn, clearError} = useAuth();

  const isLoading = authState.status === 'INITIALIZING';
  const hasError = authState.status === 'ERROR';

  // Navigate to Main when signed in
  useEffect(() => {
    if (authState.status === 'SIGNED_IN') {
      navigation.replace('Main');
    }
  }, [authState.status, navigation]);

  // Show error alert when auth fails
  useEffect(() => {
    if (authState.status === 'ERROR') {
      const message =
        authState.status === 'ERROR' ? authState.message : 'Sign-in failed.';
      Alert.alert(
        'Sign-In Failed',
        message +
          '\n\nMake sure you have:\n• Set your WEB_CLIENT_ID in AuthService.ts\n• Placed google-services.json in android/app/',
        [
          {
            text: 'OK',
            onPress: clearError,
          },
        ],
      );
    }
  }, [authState.status]);

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    await signIn();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Branding ── */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>TC</Text>
            </View>
            <Text style={styles.brandName}>TeleCaller AI</Text>
          </View>
          <Text style={styles.tagline}>Record • Transcribe • Organize</Text>
        </View>

        {/* ── Hero Visual ── */}
        <View style={styles.heroSection}>
          <HeroVisual />
          <WaveformVisual />
        </View>

        {/* ── Headline ── */}
        <View style={styles.headlineSection}>
          <Text style={styles.headline}>
            Turn every conversation{'\n'}into organized insights.
          </Text>
          <Text style={styles.subheadline}>
            Automatically transcribe, organize, and analyze your call recordings
            powered by AI.
          </Text>
        </View>

        {/* ── Feature pills ── */}
        <View style={styles.featurePills}>
          {['🔒 Secure', '🔑 Google Login', '☁️ Cloud Sync'].map((feat, i) => (
            <View key={i} style={styles.featurePill}>
              <Text style={styles.featurePillText}>{feat}</Text>
            </View>
          ))}
        </View>

        {/* ── Sign-in Button ── */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[
              styles.googleButton,
              isLoading && styles.googleButtonDisabled,
            ]}
            onPress={handleGoogleSignIn}
            activeOpacity={0.85}
            accessibilityLabel="Continue with Google"
            accessibilityRole="button"
            disabled={isLoading}>
            <View style={styles.googleButtonInner}>
              {isLoading ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color={Colors.primary}
                    style={styles.spinner}
                  />
                  <Text style={styles.googleButtonText}>Signing in...</Text>
                </>
              ) : (
                <>
                  <View style={styles.googleIcon}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Configuration notice — shown when WEB_CLIENT_ID is empty */}
          <View style={styles.configNotice}>
            <Text style={styles.configNoticeTitle}>
              🔧 Google Cloud Setup Required
            </Text>
            <Text style={styles.configNoticeText}>
              {'1. Create a project in Google Cloud Console\n' +
                '2. Enable Google Sign-In + Drive + Sheets APIs\n' +
                '3. Create OAuth 2.0 credentials (Android + Web)\n' +
                '4. Set WEB_CLIENT_ID in AuthService.ts\n' +
                '5. Download google-services.json → android/app/\n\n' +
                'Debug SHA-1:\n5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25'}
            </Text>
          </View>
        </View>

        {/* ── Trust indicators ── */}
        <View style={styles.trustSection}>
          {[
            {icon: '🛡️', label: 'Secure'},
            {icon: '🔒', label: 'Private'},
            {icon: '✅', label: 'Google Account'},
          ].map((item, i) => (
            <View key={i} style={styles.trustItem}>
              <Text style={styles.trustIcon}>{item.icon}</Text>
              <Text style={styles.trustLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    ...(Shadow.md as object),
  },
  logoMarkText: {
    color: Colors.textInverse,
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandName: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    fontWeight: '500',
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  heroContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#EFF6FF',
    opacity: 0.8,
  },
  middleRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#DBEAFE',
    opacity: 0.6,
  },
  centerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Shadow.lg as object),
  },
  phoneIcon: {fontSize: 36},
  sparkDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.secondary,
  },
  sparkTopRight: {top: 16, right: 20},
  sparkBottomLeft: {bottom: 20, left: 12},
  sparkTopLeft: {
    top: 30,
    left: 20,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primaryLight,
  },

  // Waveform
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    gap: 3,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },

  // Headline
  headlineSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headline: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
  },
  subheadline: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },

  // Feature pills
  featurePills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing['2xl'],
    flexWrap: 'wrap',
  },
  featurePill: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    ...(Shadow.sm as object),
  },
  featurePillText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Button
  buttonSection: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  googleButton: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: Spacing.base,
    marginBottom: Spacing.md,
    ...(Shadow.md as object),
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: Spacing.md,
  },
  googleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  googleIconText: {
    color: Colors.textInverse,
    fontSize: FontSize.base,
    fontWeight: '800',
  },
  googleButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Config notice
  configNotice: {
    width: '100%',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
  },
  configNoticeTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  configNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Trust
  trustSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing['2xl'],
  },
  trustItem: {alignItems: 'center'},
  trustIcon: {fontSize: 20, marginBottom: 4},
  trustLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});

export default LoginScreen;
