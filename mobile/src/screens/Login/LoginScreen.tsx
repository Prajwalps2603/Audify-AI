// TeleCaller AI — Login Screen
// Full-screen white theme. No scroll. Fits all screen sizes.

import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Spacing} from '../../theme';
import {useAuth} from '../../context/AuthContext';
import {RootStackParamList} from '../../types';
import {showAlert} from '../../components/AppModal';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Login'
>;
interface Props {
  navigation: LoginScreenNavigationProp;
}

// ─────────────────────────────────────────────────────────────
// Feature row
// ─────────────────────────────────────────────────────────────
interface FeatureRowProps {
  icon: string;
  bg: string;
  iconColor: string;
  title: string;
  desc: string;
}
const FeatureRow: React.FC<FeatureRowProps> = ({icon, bg, iconColor, title, desc}) => (
  <View style={styles.featureRow}>
    <View style={[styles.featureBadge, {backgroundColor: bg}]}>
      <Icon name={icon} size={18} color={iconColor} />
    </View>
    <View style={{flex: 1}}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{desc}</Text>
    </View>
    <Icon name="chevron-right" size={16} color={Colors.textTertiary} />
  </View>
);

// ─────────────────────────────────────────────────────────────
// Login Screen
// ─────────────────────────────────────────────────────────────
const LoginScreen: React.FC<Props> = ({navigation}) => {
  const {authState, signIn, clearError} = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;

  const isLoading = authState.status === 'INITIALIZING';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (authState.status === 'SIGNED_IN') {
      navigation.replace('Main');
    }
  }, [authState.status, navigation]);

  useEffect(() => {
    if (authState.status === 'ERROR') {
      const msg = authState.status === 'ERROR' ? authState.message : 'Sign-in failed.';
      showAlert({
        title: 'Sign-In Failed',
        message:
          msg +
          '\n\nMake sure you have:\n• Set WEB_CLIENT_ID in AuthService.ts\n• Placed google-services.json in android/app/',
        variant: 'error',
        buttons: [{text: 'OK', onPress: clearError}],
      });
    }
  }, [authState.status, clearError]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Subtle background decorations */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.bgCircle3} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Animated.View
          style={[
            styles.content,
            {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
          ]}>

          {/* ── HERO: Main Brand Logo ── */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo_main.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* ── HEADLINE ── */}
          <View style={styles.headlineSection}>
            <Text style={styles.headline}>
              Every call tells{'\n'}
              <Text style={styles.headlineAccent}>a story.</Text>
            </Text>
            <Text style={styles.subheadline}>
              AI-powered call transcription & audio intelligence
            </Text>
          </View>

          {/* ── FEATURES ── */}
          <View style={styles.featuresCard}>
            <FeatureRow
              icon="microphone-outline"
              bg={Colors.primaryLight + '55'}
              iconColor={Colors.primary}
              title="Auto-Transcription"
              desc="Google Cloud Speech-to-Text"
            />
            <View style={styles.featureDivider} />
            <FeatureRow
              icon="cloud-sync-outline"
              bg={Colors.secondaryLight + '44'}
              iconColor={Colors.secondary}
              title="Drive & Sheets Backup"
              desc="All recordings synced automatically"
            />
            <View style={styles.featureDivider} />
            <FeatureRow
              icon="shield-check-outline"
              bg={Colors.successLight}
              iconColor={Colors.success}
              title="Private & Secure"
              desc="Stays in your Google account"
            />
          </View>

          {/* ── SIGN IN ── */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={[styles.googleBtn, isLoading && {opacity: 0.7}]}
              onPress={async () => { if (!isLoading) await signIn(); }}
              disabled={isLoading}
              activeOpacity={0.87}
              accessibilityLabel="Continue with Google"
              accessibilityRole="button">
              {isLoading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.googleBtnText}>Signing in...</Text>
                </>
              ) : (
                <>
                  <View style={styles.gBadge}>
                    <Text style={styles.gText}>G</Text>
                  </View>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                  <View style={styles.arrowBadge}>
                    <Icon name="arrow-right" size={16} color={Colors.primary} />
                  </View>
                </>
              )}
            </TouchableOpacity>

            {/* Privacy note */}
            <View style={styles.privacyRow}>
              <Icon name="lock-outline" size={12} color={Colors.textTertiary} />
              <Text style={styles.privacyText}>
                Secure login · No password required · Google OAuth 2.0
              </Text>
            </View>
          </View>

        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Background decoration blobs
  bgCircle1: {
    position: 'absolute',
    top: -SCREEN_H * 0.08,
    right: -SCREEN_W * 0.25,
    width: SCREEN_W * 0.65,
    height: SCREEN_W * 0.65,
    borderRadius: SCREEN_W * 0.325,
    backgroundColor: Colors.primary,
    opacity: 0.06,
  },
  bgCircle2: {
    position: 'absolute',
    top: SCREEN_H * 0.22,
    left: -SCREEN_W * 0.2,
    width: SCREEN_W * 0.55,
    height: SCREEN_W * 0.55,
    borderRadius: SCREEN_W * 0.275,
    backgroundColor: Colors.secondary,
    opacity: 0.05,
  },
  bgCircle3: {
    position: 'absolute',
    bottom: SCREEN_H * 0.05,
    right: -SCREEN_W * 0.15,
    width: SCREEN_W * 0.45,
    height: SCREEN_W * 0.45,
    borderRadius: SCREEN_W * 0.225,
    backgroundColor: Colors.primary,
    opacity: 0.04,
  },

  safeArea: {flex: 1},
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },

  // ── Logo Hero ──
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SCREEN_H < 700 ? Spacing.sm : Spacing.md,
    marginTop: Spacing.xs,
  },
  logoImage: {
    width: SCREEN_W * 0.85,
    height: SCREEN_H < 700 ? 100 : 125,
  },

  // ── Headline ──
  headlineSection: {
    gap: Spacing.xs,
  },
  headline: {
    fontSize: SCREEN_H < 700 ? FontSize['2xl'] : FontSize['3xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.8,
    lineHeight: SCREEN_H < 700 ? 32 : 40,
  },
  headlineAccent: {
    color: Colors.primary,
  },
  subheadline: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },

  // ── Features card ──
  featuresCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  featureBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 1,
  },
  featureDesc: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  featureDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 66,
  },

  // ── Bottom ──
  bottomSection: {
    gap: Spacing.sm,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  gBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gText: {
    fontSize: FontSize.base,
    fontWeight: '900',
    color: Colors.primary,
    lineHeight: 19,
  },
  googleBtnText: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.base,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  arrowBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  privacyText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});

export default LoginScreen;
