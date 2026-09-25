// TeleCaller AI — Model Tier Details Screen
// Displays detailed usage, benefits, pricing, and disabled upgrade notice for Paid AI Models

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import Card from '../../components/Card';
import {ApiModelService, AIModelConfig} from '../../services/admin/ApiModelService';
import {RootStackParamList} from '../../types';

type ModelTierDetailsRouteProp = RouteProp<RootStackParamList, 'ModelTierDetails'>;

const ModelTierDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<ModelTierDetailsRouteProp>();
  const {modelId} = route.params || {};

  const model: AIModelConfig | undefined = ApiModelService.getModelById(modelId);

  // Fallback defaults if model not found
  const modelName = model?.name || 'Premium AI Neural Model';
  const price = model?.price || '₹199 / month';
  const provider = model?.providerKey || 'OPENAI';
  const usageLimit =
    model?.usageLimit ||
    'Pro tier: 500 hours / month, unlimited audio length, 0 queue delay';
  const description =
    model?.description ||
    'High-accuracy neural transcription and multilingual reasoning engine for phone call recordings.';
  const benefits = model?.benefits && model.benefits.length > 0
    ? model.benefits
    : [
        'State-of-the-art accuracy across 99+ languages',
        'Automatic dialect & accent conditioning (Hindi, Tamil, Telugu, etc.)',
        'Multi-speaker diarization with conversational sentiment flags',
        'High-fidelity noise suppression for low-quality cellular audio',
        'Direct cloud sync to Google Drive & auto-formatting in Google Sheets',
        'Priority GPU server compute with instant turnaround',
      ];

  const getProviderIcon = (prov: string) => {
    switch (prov) {
      case 'OPENAI':
        return 'brain';
      case 'GOOGLE':
        return 'google';
      case 'DEEPGRAM':
        return 'waveform';
      case 'GROQ':
        return 'lightning-bolt';
      case 'ANTHROPIC':
        return 'robot';
      default:
        return 'cpu-64-bit';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button">
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Model Tier & Pricing</Text>
        <View style={styles.topBarRightPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Model Header Hero ── */}
        <LinearGradient
          colors={['#4F46E5', '#7C3AED', '#9333EA']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.providerBadge}>
              <Icon name={getProviderIcon(provider)} size={14} color="#FFFFFF" />
              <Text style={styles.providerBadgeText}>{provider}</Text>
            </View>
            <View style={styles.paidPill}>
              <Icon name="crown" size={13} color="#FEF08A" />
              <Text style={styles.paidPillText}>PAID TIER</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{modelName}</Text>
          <Text style={styles.heroDescription}>{description}</Text>

          {/* Pricing Box */}
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>SUBSCRIPTION FEE</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceAmount}>{price}</Text>
            </View>
            <Text style={styles.priceSubtext}>Billed monthly • Cancel anytime</Text>
          </View>
        </LinearGradient>

        {/* ── Temporary Unavailable Banner (User Requirement) ── */}
        <View style={styles.noticeBanner}>
          <View style={styles.noticeIconWrap}>
            <Icon name="information-outline" size={22} color="#D97706" />
          </View>
          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>Temporarily Not Available</Text>
            <Text style={styles.noticeText}>
              In-app purchases and payment gateways for paid tiers are currently in development.
              Free models are active, unrestricted, and available right now for your calls.
            </Text>
          </View>
        </View>

        {/* ── Usage Limits & Specs ── */}
        <Text style={styles.sectionHeading}>USAGE LIMITS & SPECIFICATIONS</Text>
        <Card variant="elevated" padding={16} style={styles.specsCard}>
          <View style={styles.specRow}>
            <View style={[styles.specIconBox, {backgroundColor: '#EEF2FF'}]}>
              <Icon name="speedometer" size={20} color="#4F46E5" />
            </View>
            <View style={styles.specTextCol}>
              <Text style={styles.specTitle}>Processing Quota & Speed</Text>
              <Text style={styles.specDesc}>{usageLimit}</Text>
            </View>
          </View>

          <View style={styles.specDivider} />

          <View style={styles.specRow}>
            <View style={[styles.specIconBox, {backgroundColor: '#ECFDF5'}]}>
              <Icon name="account-group-outline" size={20} color="#059669" />
            </View>
            <View style={styles.specTextCol}>
              <Text style={styles.specTitle}>Speaker Diarization</Text>
              <Text style={styles.specDesc}>
                Advanced multi-speaker detection separating caller and customer voices
              </Text>
            </View>
          </View>

          <View style={styles.specDivider} />

          <View style={styles.specRow}>
            <View style={[styles.specIconBox, {backgroundColor: '#FEF3C7'}]}>
              <Icon name="translate" size={20} color="#D97706" />
            </View>
            <View style={styles.specTextCol}>
              <Text style={styles.specTitle}>Multilingual Translation</Text>
              <Text style={styles.specDesc}>
                Automatic translation between Hindi, English, and regional Indian languages
              </Text>
            </View>
          </View>
        </Card>

        {/* ── Key Benefits ── */}
        <Text style={styles.sectionHeading}>KEY BENEFITS INCLUDED</Text>
        <Card variant="elevated" padding={16} style={styles.benefitsCard}>
          {benefits.map((benefit, idx) => (
            <View key={idx} style={styles.benefitRow}>
              <View style={styles.checkIconBox}>
                <Icon name="check" size={15} color="#4338CA" />
              </View>
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </Card>

        {/* ── Action Buttons ── */}
        <View style={styles.actionContainer}>
          {/* Disabled Button as per user requirements */}
          <TouchableOpacity
            style={styles.disabledBtn}
            disabled={true}
            activeOpacity={1}>
            <Icon name="lock" size={18} color="#94A3B8" style={{marginRight: 8}} />
            <Text style={styles.disabledBtnText}>Upgrade Plan (Temporarily Unavailable)</Text>
          </TouchableOpacity>
          <Text style={styles.disabledNote}>
            Paid tier activation is disabled during preview. Check back in the next update.
          </Text>

          <TouchableOpacity
            style={styles.backToFreeBtn}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backToFreeBtnText}>Return to Model Selection</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default ModelTierDetailsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    borderRadius: BorderRadius.md,
  },
  topBarTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  topBarRightPlaceholder: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  providerBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  paidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 240, 138, 0.25)',
    borderWidth: 1,
    borderColor: '#FEF08A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  paidPillText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: '#FEF08A',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: FontSize.sm,
    color: '#E0E7FF',
    lineHeight: 20,
    marginBottom: 16,
  },
  priceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: BorderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C7D2FE',
    letterSpacing: 1,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  priceSubtext: {
    fontSize: FontSize.xs,
    color: '#E0E7FF',
    marginTop: 2,
  },
  noticeBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: BorderRadius.lg,
    padding: 14,
    marginBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  noticeIconWrap: {
    marginRight: 10,
    marginTop: 2,
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  noticeText: {
    fontSize: FontSize.xs,
    color: '#B45309',
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  specsCard: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  specIconBox: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  specTextCol: {
    flex: 1,
  },
  specTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  specDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  specDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  benefitsCard: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  checkIconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  actionContainer: {
    marginTop: 4,
    alignItems: 'center',
  },
  disabledBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    width: '100%',
    paddingVertical: 15,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  disabledBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#94A3B8',
  },
  disabledNote: {
    fontSize: FontSize.xs,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  backToFreeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backToFreeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});
