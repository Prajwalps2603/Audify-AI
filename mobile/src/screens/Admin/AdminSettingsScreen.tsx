// TeleCaller AI — Admin Settings Screen
// Central control center for hackerweb402@gmail.com
// Controls feature visibility and settings availability across standard user accounts.

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  TextInput,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import Card from '../../components/Card';
import {useAuth} from '../../context/AuthContext';
import {toast} from '../../components/Toast';
import {showConfirm} from '../../components/AppModal';
import {
  AdminConfigService,
  AdminFeatureConfig,
  AdminSettingKey,
  ADMIN_EMAIL,
} from '../../services/admin/AdminConfigService';
import {
  ApiModelService,
  AIModelConfig,
  ModelTier,
  ProviderKey,
} from '../../services/admin/ApiModelService';

const PROVIDERS_LIST: ProviderKey[] = [
  'OPENAI',
  'GOOGLE',
  'DEEPGRAM',
  'GROQ',
  'ANTHROPIC',
  'CUSTOM',
];

interface AdminToggleRowProps {
  iconName: string;
  iconColor: string;
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const AdminToggleRow: React.FC<AdminToggleRowProps> = ({
  iconName,
  iconColor,
  title,
  subtitle,
  enabled,
  onToggle,
  isFirst,
  isLast,
}) => (
  <View
    style={[
      styles.toggleRow,
      isFirst && styles.rowFirst,
      isLast && styles.rowLast,
    ]}>
    <View style={[styles.iconBox, {backgroundColor: iconColor + '15'}]}>
      <Icon name={iconName} size={20} color={iconColor} />
    </View>
    <View style={styles.textCol}>
      <View style={styles.titleRow}>
        <Text style={styles.rowTitle}>{title}</Text>
        <View
          style={[
            styles.statusPill,
            {backgroundColor: enabled ? '#DCFCE7' : '#FEE2E2'},
          ]}>
          <Text
            style={[
              styles.statusPillText,
              {color: enabled ? '#15803D' : '#B91C1C'},
            ]}>
            {enabled ? 'VISIBLE' : 'HIDDEN'}
          </Text>
        </View>
      </View>
      <Text style={styles.rowSubtitle}>{subtitle}</Text>
    </View>
    <Switch
      value={enabled}
      onValueChange={onToggle}
      trackColor={{false: '#CBD5E1', true: Colors.primaryLight}}
      thumbColor={enabled ? Colors.primary : '#94A3B8'}
    />
  </View>
);

const AdminSectionHeader: React.FC<{title: string; icon: string}> = ({
  title,
  icon,
}) => (
  <View style={styles.sectionHeader}>
    <Icon name={icon} size={16} color={Colors.primary} style={{marginRight: 6}} />
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const AdminSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {authState} = useAuth();

  const realUser =
    authState.status === 'SIGNED_IN' ? authState.session.user : null;
  const userEmail = realUser?.email ?? '';
  const isSuperAdmin = AdminConfigService.isAdmin(userEmail);

  const [config, setConfig] = useState<AdminFeatureConfig>(
    AdminConfigService.getConfig(),
  );
  const [activeTab, setActiveTab] = useState<'features' | 'apis'>('features');
  const [models, setModels] = useState<AIModelConfig[]>(
    ApiModelService.getModels(userEmail),
  );

  // New Model Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newProvider, setNewProvider] = useState<ProviderKey>('OPENAI');
  const [newTier, setNewTier] = useState<ModelTier>('free');
  const [newPrice, setNewPrice] = useState('₹199 / month');
  const [newUsageLimit, setNewUsageLimit] = useState(
    '500 hours / month, Realtime streaming transcription',
  );
  const [newBenefits, setNewBenefits] = useState(
    'High accuracy multilingual\nSpeaker diarization\nDirect cloud sync',
  );
  const [showApiKeyInForm, setShowApiKeyInForm] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceText, setEditingPriceText] = useState('');

  useEffect(() => {
    AdminConfigService.setUserEmail(userEmail);
    ApiModelService.setUserEmail(userEmail);
    AdminConfigService.syncFromBackend(userEmail);
    ApiModelService.syncFromBackend(userEmail);

    const unsubConfig = AdminConfigService.subscribe(setConfig);
    const unsubModels = ApiModelService.subscribe(setModels);
    return () => {
      unsubConfig();
      unsubModels();
    };
  }, [userEmail]);

  const handleToggle = async (key: AdminSettingKey, val: boolean) => {
    try {
      await AdminConfigService.updateSetting(key, val, userEmail);
      toast.success(
        val ? 'Feature Enabled' : 'Feature Hidden',
        `User setting "${key}" is now ${val ? 'visible' : 'hidden'} for users.`,
      );
    } catch (e: any) {
      toast.error('Admin Error', e?.message || 'Unauthorized action.');
    }
  };

  const handleEnableAll = async () => {
    try {
      const allOn = Object.keys(config).reduce((acc, k) => {
        acc[k as AdminSettingKey] = true;
        return acc;
      }, {} as any);
      await AdminConfigService.batchUpdate(allOn, userEmail);
      toast.success('All Enabled', 'All settings are now visible to users.');
    } catch (e: any) {
      toast.error('Admin Error', e?.message || 'Failed to update settings.');
    }
  };

  const handleResetDefaults = async () => {
    try {
      await AdminConfigService.resetToDefaults(userEmail);
      toast.info('Reset Complete', 'All settings restored to factory defaults.');
    } catch (e: any) {
      toast.error('Admin Error', e?.message || 'Failed to reset settings.');
    }
  };

  // ── AI Model & API Handlers ──
  const handleAddModel = async () => {
    if (!newModelName.trim()) {
      toast.warning('Validation', 'Please enter a model name.');
      return;
    }

    try {
      const benefitsList = newBenefits
        .split('\n')
        .map(b => b.trim())
        .filter(Boolean);

      await ApiModelService.addModel(
        {
          name: newModelName.trim(),
          providerKey: newProvider,
          apiKey: newApiKey.trim() || '',
          tier: newTier,
          price: newTier === 'free' ? 'Free' : newPrice.trim() || '₹199 / month',
          usageLimit: newUsageLimit.trim(),
          benefits:
            benefitsList.length > 0
              ? benefitsList
              : ['High accuracy speech recognition', 'Cloud synchronized'],
          isActive: true,
        },
        userEmail,
      );

      toast.success(
        'Model Configured',
        `"${newModelName}" added to backend with ${newTier.toUpperCase()} tier.`,
      );

      // Reset form
      setNewModelName('');
      setNewApiKey('');
      setNewProvider('OPENAI');
      setNewTier('free');
      setShowAddForm(false);
    } catch (e: any) {
      toast.error('Admin Error', e?.message || 'Failed to add model.');
    }
  };

  const handleToggleTier = async (model: AIModelConfig, targetTier: ModelTier) => {
    try {
      const priceToSet =
        targetTier === 'free'
          ? 'Free'
          : model.price && model.price !== 'Free'
          ? model.price
          : '₹199 / month';

      await ApiModelService.setModelTier(
        model.id,
        targetTier,
        priceToSet,
        userEmail,
      );
      toast.success(
        'Tier Updated',
        `"${model.name}" is now set to ${targetTier.toUpperCase()} tier (${priceToSet}).`,
      );
    } catch (e: any) {
      toast.error('Admin Error', e?.message || 'Failed to update model tier.');
    }
  };

  const handleSaveEditedPrice = async (modelId: string) => {
    if (!editingPriceText.trim()) {
      setEditingPriceId(null);
      return;
    }
    try {
      await ApiModelService.updateModel(
        modelId,
        {price: editingPriceText.trim()},
        userEmail,
      );
      toast.success('Price Updated', `Price set to ${editingPriceText.trim()}`);
      setEditingPriceId(null);
    } catch (e: any) {
      toast.error('Admin Error', e?.message || 'Failed to update price.');
    }
  };

  const handleToggleModelActive = async (model: AIModelConfig) => {
    try {
      await ApiModelService.updateModel(
        model.id,
        {isActive: !model.isActive},
        userEmail,
      );
      toast.info(
        model.isActive ? 'Model Disabled' : 'Model Enabled',
        `"${model.name}" is now ${model.isActive ? 'disabled' : 'enabled'}.`,
      );
    } catch (e: any) {
      toast.error('Admin Error', e?.message || 'Failed to toggle model.');
    }
  };

  const handleDeleteModel = (model: AIModelConfig) => {
    showConfirm(
      'Delete AI Model',
      `Are you sure you want to permanently delete "${model.name}" and remove its API key?`,
      async () => {
        try {
          await ApiModelService.deleteModel(model.id, userEmail);
          toast.success('Deleted', `"${model.name}" removed from backend.`);
        } catch (e: any) {
          toast.error('Admin Error', e?.message || 'Failed to delete model.');
        }
      },
    );
  };

  const toggleKeyVisibility = (modelId: string) => {
    setRevealedKeys(prev => ({...prev, [modelId]: !prev[modelId]}));
  };

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.unauthContainer}>
          <Icon name="shield-lock-outline" size={64} color={Colors.error} />
          <Text style={styles.unauthTitle}>Access Denied</Text>
          <Text style={styles.unauthSubtitle}>
            This control center is exclusively reserved for the Super Admin
            ({ADMIN_EMAIL}).
          </Text>
          <TouchableOpacity
            style={styles.backHomeBtn}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backHomeBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Admin Controls</Text>
          <Text style={styles.topBarSubtitle}>Settings Visibility & Toggles</Text>
        </View>
        <View style={styles.adminBadge}>
          <Icon name="shield-crown" size={14} color="#D97706" style={{marginRight: 4}} />
          <Text style={styles.adminBadgeText}>SUPER ADMIN</Text>
        </View>
      </View>

      {/* ── Admin Tabs: Feature Toggles vs AI Models & APIs ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'features' && styles.tabItemActive]}
          onPress={() => setActiveTab('features')}
          activeOpacity={0.8}>
          <Icon
            name="toggle-switch-outline"
            size={18}
            color={activeTab === 'features' ? Colors.primary : Colors.textTertiary}
            style={{marginRight: 6}}
          />
          <Text
            style={[
              styles.tabItemText,
              activeTab === 'features' && styles.tabItemTextActive,
            ]}>
            Feature Toggles
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'apis' && styles.tabItemActive]}
          onPress={() => setActiveTab('apis')}
          activeOpacity={0.8}>
          <Icon
            name="brain"
            size={18}
            color={activeTab === 'apis' ? Colors.primary : Colors.textTertiary}
            style={{marginRight: 6}}
          />
          <Text
            style={[
              styles.tabItemText,
              activeTab === 'apis' && styles.tabItemTextActive,
            ]}>
            AI Models & APIs
          </Text>
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{models.length}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {activeTab === 'features' ? (
          <>
            {/* ── Hero Info Banner ── */}
            <LinearGradient
              colors={['#FEF3C7', '#FFFBEB', '#FFFFFF']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.heroBanner}>
          <View style={styles.heroRow}>
            <View style={styles.heroIconBox}>
              <Icon name="shield-account" size={28} color="#D97706" />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroTitle}>Master Visibility Controls</Text>
              <Text style={styles.heroEmail}>{userEmail}</Text>
              <Text style={styles.heroDesc}>
                Turn options ON or OFF. If toggled OFF, normal users cannot see
                or access that option when they log into TeleCaller AI.
              </Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={handleEnableAll}
              activeOpacity={0.8}>
              <Icon name="check-all" size={16} color={Colors.primary} style={{marginRight: 4}} />
              <Text style={styles.quickActionText}>Enable All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionBtn, styles.quickActionBtnSecondary]}
              onPress={handleResetDefaults}
              activeOpacity={0.8}>
              <Icon name="restore" size={16} color={Colors.textSecondary} style={{marginRight: 4}} />
              <Text style={[styles.quickActionText, {color: Colors.textSecondary}]}>
                Reset Defaults
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── 1. RECORDINGS CONTROLS ── */}
        <AdminSectionHeader title="RECORDINGS SETTINGS" icon="folder-music-outline" />
        <Card variant="elevated" padding={0} style={styles.cardGroup}>
          <AdminToggleRow
            iconName="folder-outline"
            iconColor="#F59E0B"
            title="Recording Folder Path"
            subtitle="Show currently selected local recording directory"
            enabled={config.recordingFolder}
            onToggle={val => handleToggle('recordingFolder', val)}
            isFirst={true}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="folder-swap-outline"
            iconColor="#F59E0B"
            title="Change Recording Folder"
            subtitle="Allow user to pick/change local recordings folder"
            enabled={config.changeRecordingFolder}
            onToggle={val => handleToggle('changeRecordingFolder', val)}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="magnify"
            iconColor="#2563EB"
            title="Scan Recordings Button"
            subtitle="Allow manual scanner trigger from settings"
            enabled={config.scanRecordings}
            onToggle={val => handleToggle('scanRecordings', val)}
            isLast={true}
          />
        </Card>

        {/* ── 2. AUTOMATION & BACKGROUND CONTROLS ── */}
        <AdminSectionHeader title="AUTOMATION & BACKGROUND" icon="robot-outline" />
        <Card variant="elevated" padding={0} style={styles.cardGroup}>
          <AdminToggleRow
            iconName="robot-outline"
            iconColor="#7C3AED"
            title="Background Monitoring"
            subtitle="Enable / disable background call scanning service"
            enabled={config.backgroundMonitoring}
            onToggle={val => handleToggle('backgroundMonitoring', val)}
            isFirst={true}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="bell-outline"
            iconColor="#7C3AED"
            title="Persistent Notification"
            subtitle="Android Foreground Service status notification"
            enabled={config.persistentNotification}
            onToggle={val => handleToggle('persistentNotification', val)}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="timer-outline"
            iconColor="#7C3AED"
            title="Scan Frequency Interval"
            subtitle="Interval selector (5, 15, 30, 60 minutes)"
            enabled={config.scanFrequency}
            onToggle={val => handleToggle('scanFrequency', val)}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="cog-outline"
            iconColor="#7C3AED"
            title="Auto-Process Pipeline"
            subtitle="End-to-end pipeline automation trigger"
            enabled={config.autoProcessPipeline}
            onToggle={val => handleToggle('autoProcessPipeline', val)}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="cloud-upload-outline"
            iconColor="#2563EB"
            title="Auto Google Drive Upload"
            subtitle="Automatic Drive syncing toggle"
            enabled={config.autoDriveUpload}
            onToggle={val => handleToggle('autoDriveUpload', val)}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="file-document-edit-outline"
            iconColor="#2563EB"
            title="Auto AI Transcription"
            subtitle="Automatic speech recognition toggle"
            enabled={config.autoTranscription}
            onToggle={val => handleToggle('autoTranscription', val)}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="wifi"
            iconColor="#16A34A"
            title="Wi-Fi Only Sync"
            subtitle="Restrict cellular data consumption"
            enabled={config.wifiOnlySync}
            onToggle={val => handleToggle('wifiOnlySync', val)}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="battery-charging"
            iconColor="#16A34A"
            title="Battery Optimization"
            subtitle="Allow user to request Doze Mode exemption"
            enabled={config.batteryOptimization}
            onToggle={val => handleToggle('batteryOptimization', val)}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="refresh"
            iconColor="#2563EB"
            title="Trigger Background Scan"
            subtitle="Manual trigger button for background sync"
            enabled={config.triggerBackgroundScan}
            onToggle={val => handleToggle('triggerBackgroundScan', val)}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="clock-outline"
            iconColor={Colors.textTertiary}
            title="Last Background Check"
            subtitle="Diagnostic timestamp of last background job"
            enabled={config.lastBackgroundCheck}
            onToggle={val => handleToggle('lastBackgroundCheck', val)}
            isLast={true}
          />
        </Card>

        {/* ── 3. GOOGLE SERVICES CONTROLS ── */}
        <AdminSectionHeader title="GOOGLE SERVICES INTEGRATION" icon="google" />
        <Card variant="elevated" padding={0} style={styles.cardGroup}>
          <AdminToggleRow
            iconName="google-drive"
            iconColor="#4285F4"
            title="Google Drive Sync"
            subtitle="Show Drive status, connection & folder sync"
            enabled={config.googleDrive}
            onToggle={val => handleToggle('googleDrive', val)}
            isFirst={true}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="google-spreadsheet"
            iconColor="#0F9D58"
            title="Google Sheets Sync"
            subtitle="Show Sheets status, workbook linking & spreadsheet"
            enabled={config.googleSheets}
            onToggle={val => handleToggle('googleSheets', val)}
            isLast={true}
          />
        </Card>

        {/* ── 4. TRANSCRIPTION CONTROLS ── */}
        <AdminSectionHeader title="SPEECH & TRANSCRIPTION" icon="microphone-outline" />
        <Card variant="elevated" padding={0} style={styles.cardGroup}>
          <AdminToggleRow
            iconName="microphone"
            iconColor="#DC2626"
            title="Speech-to-Text Provider"
            subtitle="Allow changing AI model (Google STT / OpenAI Whisper / Deepgram)"
            enabled={config.sttProvider}
            onToggle={val => handleToggle('sttProvider', val)}
            isFirst={true}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="web"
            iconColor="#2563EB"
            title="Language Detection"
            subtitle="Allow automatic multilingual detection switch"
            enabled={config.languageDetection}
            onToggle={val => handleToggle('languageDetection', val)}
            isLast={true}
          />
        </Card>

        {/* ── 5. PRIVACY & SECURITY CONTROLS ── */}
        <AdminSectionHeader title="PRIVACY & SECURITY" icon="shield-check-outline" />
        <Card variant="elevated" padding={0} style={styles.cardGroup}>
          <AdminToggleRow
            iconName="shield-check-outline"
            iconColor="#16A34A"
            title="Privacy & Consent Modal"
            subtitle="Show Local-First privacy architecture & consent terms"
            enabled={config.privacyConsent}
            onToggle={val => handleToggle('privacyConsent', val)}
            isFirst={true}
          />
          <View style={styles.divider} />
          <AdminToggleRow
            iconName="lock-outline"
            iconColor="#16A34A"
            title="Security Audit & Diagnostics"
            subtitle="Show hardware KeyStore verification & cryptographic audit"
            enabled={config.securityAudit}
            onToggle={val => handleToggle('securityAudit', val)}
            isLast={true}
          />
        </Card>

        {/* ── 6. ACCOUNT CONTROLS ── */}
        <AdminSectionHeader title="ACCOUNT SETTINGS" icon="account-cog-outline" />
        <Card variant="elevated" padding={0} style={styles.cardGroup}>
          <AdminToggleRow
            iconName="trash-can-outline"
            iconColor={Colors.error}
            title="Delete Account & Data Option"
            subtitle="Allow standard users to initiate permanent data erasure"
            enabled={config.deleteAccount}
            onToggle={val => handleToggle('deleteAccount', val)}
            isFirst={true}
            isLast={true}
          />
        </Card>
          </>
        ) : (
          <View style={styles.tabContentContainer}>
            {/* ── Summary Stats ── */}
            <View style={styles.apiStatsRow}>
              <View style={[styles.apiStatCard, {backgroundColor: '#EEF2FF', borderColor: '#C7D2FE'}]}>
                <Text style={[styles.apiStatNumber, {color: '#4F46E5'}]}>{models.length}</Text>
                <Text style={styles.apiStatLabel}>TOTAL APIS</Text>
              </View>
              <View style={[styles.apiStatCard, {backgroundColor: '#ECFDF5', borderColor: '#A7F3D0'}]}>
                <Text style={[styles.apiStatNumber, {color: '#059669'}]}>
                  {models.filter(m => m.tier === 'free').length}
                </Text>
                <Text style={styles.apiStatLabel}>FREE TIER</Text>
              </View>
              <View style={[styles.apiStatCard, {backgroundColor: '#FEF3C7', borderColor: '#FDE68A'}]}>
                <Text style={[styles.apiStatNumber, {color: '#D97706'}]}>
                  {models.filter(m => m.tier === 'paid').length}
                </Text>
                <Text style={styles.apiStatLabel}>PAID TIER</Text>
              </View>
            </View>

            {/* ── Add Model Accordion Button ── */}
            <TouchableOpacity
              style={styles.addModelToggleBtn}
              onPress={() => setShowAddForm(!showAddForm)}
              activeOpacity={0.8}>
              <LinearGradient
                colors={showAddForm ? ['#475569', '#334155'] : ['#4F46E5', '#6366F1']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.addModelToggleGradient}>
                <Icon
                  name={showAddForm ? 'close' : 'plus-circle-outline'}
                  size={20}
                  color="#FFFFFF"
                  style={{marginRight: 8}}
                />
                <Text style={styles.addModelToggleText}>
                  {showAddForm ? 'Close Model Form' : 'Add New Model & API Key'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* ── Add Model Form ── */}
            {showAddForm && (
              <Card variant="elevated" padding={16} style={styles.addFormCard}>
                <Text style={styles.formSectionTitle}>ADD AI MODEL TO BACKEND</Text>

                {/* Model Name */}
                <Text style={styles.inputLabel}>Model Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. OpenAI Whisper v3 Turbo, Gemini 1.5 Pro"
                  placeholderTextColor={Colors.textTertiary}
                  value={newModelName}
                  onChangeText={setNewModelName}
                />

                {/* Provider Selection */}
                <Text style={styles.inputLabel}>Provider</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                  contentContainerStyle={{paddingVertical: 2}}>
                  {PROVIDERS_LIST.map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.providerChip,
                        newProvider === p && styles.providerChipActive,
                      ]}
                      onPress={() => setNewProvider(p)}>
                      <Text
                        style={[
                          styles.providerChipText,
                          newProvider === p && styles.providerChipTextActive,
                        ]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* API Key */}
                <Text style={styles.inputLabel}>API Key (Secure Backend Storage)</Text>
                <View style={styles.apiKeyInputWrap}>
                  <TextInput
                    style={[styles.textInput, {flex: 1, marginBottom: 0, paddingRight: 40}]}
                    placeholder="Enter API Key (or leave empty)"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry={!showApiKeyInForm}
                    value={newApiKey}
                    onChangeText={setNewApiKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowApiKeyInForm(!showApiKeyInForm)}>
                    <Icon
                      name={showApiKeyInForm ? 'eye-off' : 'eye'}
                      size={20}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Tier Selection */}
                <Text style={styles.inputLabel}>Model Access Tier</Text>
                <View style={styles.tierSelectorRow}>
                  <TouchableOpacity
                    style={[
                      styles.tierChoiceBtn,
                      newTier === 'free' && styles.tierChoiceBtnActiveFree,
                    ]}
                    onPress={() => setNewTier('free')}>
                    <Icon
                      name="check-circle"
                      size={18}
                      color={newTier === 'free' ? '#15803D' : '#94A3B8'}
                      style={{marginRight: 6}}
                    />
                    <Text
                      style={[
                        styles.tierChoiceText,
                        newTier === 'free' && styles.tierChoiceTextActiveFree,
                      ]}>
                      FREE TIER
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.tierChoiceBtn,
                      newTier === 'paid' && styles.tierChoiceBtnActivePaid,
                    ]}
                    onPress={() => setNewTier('paid')}>
                    <Icon
                      name="crown"
                      size={18}
                      color={newTier === 'paid' ? '#B45309' : '#94A3B8'}
                      style={{marginRight: 6}}
                    />
                    <Text
                      style={[
                        styles.tierChoiceText,
                        newTier === 'paid' && styles.tierChoiceTextActivePaid,
                      ]}>
                      PAID TIER
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* If Paid: Price and Limits */}
                {newTier === 'paid' && (
                  <View style={styles.paidInputsBox}>
                    <Text style={styles.inputLabel}>Subscription Price / Amount</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. ₹199 / month or $4.99 / mo"
                      placeholderTextColor={Colors.textTertiary}
                      value={newPrice}
                      onChangeText={setNewPrice}
                    />

                    <Text style={styles.inputLabel}>Usage Limits & Quota</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 500 hours / month, Realtime streaming"
                      placeholderTextColor={Colors.textTertiary}
                      value={newUsageLimit}
                      onChangeText={setNewUsageLimit}
                    />

                    <Text style={styles.inputLabel}>Key Benefits (one per line)</Text>
                    <TextInput
                      style={[styles.textInput, {height: 72, textAlignVertical: 'top'}]}
                      multiline
                      placeholder="High accuracy multi-language&#10;Speaker Diarization&#10;Zero latency"
                      placeholderTextColor={Colors.textTertiary}
                      value={newBenefits}
                      onChangeText={setNewBenefits}
                    />
                  </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                  style={styles.submitModelBtn}
                  onPress={handleAddModel}
                  activeOpacity={0.8}>
                  <Icon name="check" size={18} color="#FFFFFF" style={{marginRight: 6}} />
                  <Text style={styles.submitModelBtnText}>Add Model to Backend</Text>
                </TouchableOpacity>
              </Card>
            )}

            {/* ── Models List Header ── */}
            <AdminSectionHeader
              title={`AVAILABLE MODELS & APIS (${models.length})`}
              icon="robot-outline"
            />

            {/* ── Models List ── */}
            {models.map(model => {
              const isKeyRevealed = Boolean(revealedKeys[model.id]);
              const isPaid = model.tier === 'paid';
              const isEditingThisPrice = editingPriceId === model.id;

              return (
                <Card key={model.id} variant="elevated" padding={16} style={styles.modelCard}>
                  {/* Top Row: Provider badge, Name, Switch */}
                  <View style={styles.modelCardTopRow}>
                    <View style={styles.modelHeaderLeft}>
                      <View style={styles.providerTag}>
                        <Text style={styles.providerTagText}>{model.providerKey}</Text>
                      </View>
                      <Text style={styles.modelCardName}>{model.name}</Text>
                    </View>
                    <Switch
                      value={model.isActive}
                      onValueChange={() => handleToggleModelActive(model)}
                      trackColor={{false: '#CBD5E1', true: Colors.primaryLight}}
                      thumbColor={model.isActive ? Colors.primary : '#94A3B8'}
                    />
                  </View>

                  {model.description ? (
                    <Text style={styles.modelCardDesc}>{model.description}</Text>
                  ) : null}

                  {/* API Key Box */}
                  <View
                    style={[
                      styles.keyDisplayRow,
                      (!model.apiKey || model.apiKey.trim() === '') && {
                        backgroundColor: '#F8FAFC',
                        borderColor: '#E2E8F0',
                      },
                    ]}>
                    <Icon
                      name="key-outline"
                      size={16}
                      color={
                        model.apiKey && model.apiKey.trim() !== ''
                          ? Colors.textSecondary
                          : '#94A3B8'
                      }
                      style={{marginRight: 6}}
                    />
                    <Text
                      style={[
                        styles.keyDisplayText,
                        (!model.apiKey || model.apiKey.trim() === '') && {
                          color: '#94A3B8',
                          fontStyle: 'italic',
                        },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="middle">
                      {model.apiKey && model.apiKey.trim() !== ''
                        ? isKeyRevealed
                          ? model.apiKey
                          : `••••••••••••${model.apiKey.slice(-4)}`
                        : 'No API Key Set (Empty)'}
                    </Text>
                    {model.apiKey && model.apiKey.trim() !== '' ? (
                      <TouchableOpacity
                        style={styles.keyRevealBtn}
                        onPress={() => toggleKeyVisibility(model.id)}>
                        <Icon
                          name={isKeyRevealed ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={Colors.primary}
                        />
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={{
                          backgroundColor: '#F1F5F9',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}>
                        <Text style={{fontSize: 9, fontWeight: '700', color: '#94A3B8'}}>
                          EMPTY
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Tier Controls */}
                  <View style={styles.tierControlSection}>
                    <Text style={styles.tierControlLabel}>TIER ACCESS:</Text>
                    <View style={styles.tierBadgeRow}>
                      <TouchableOpacity
                        style={[
                          styles.tierPillBtn,
                          !isPaid && styles.tierPillBtnActiveFree,
                        ]}
                        onPress={() => handleToggleTier(model, 'free')}>
                        <Icon
                          name="check-circle"
                          size={14}
                          color={!isPaid ? '#15803D' : '#64748B'}
                          style={{marginRight: 4}}
                        />
                        <Text
                          style={[
                            styles.tierPillText,
                            !isPaid && styles.tierPillTextActiveFree,
                          ]}>
                          FREE
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.tierPillBtn,
                          isPaid && styles.tierPillBtnActivePaid,
                        ]}
                        onPress={() => handleToggleTier(model, 'paid')}>
                        <Icon
                          name="crown"
                          size={14}
                          color={isPaid ? '#B45309' : '#64748B'}
                          style={{marginRight: 4}}
                        />
                        <Text
                          style={[
                            styles.tierPillText,
                            isPaid && styles.tierPillTextActivePaid,
                          ]}>
                          PAID
                        </Text>
                        {isPaid && (
                          <Text style={styles.tierPriceTag}>
                            ({model.price || '₹199 / mo'})
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Inline Price Editor for Paid Tier */}
                  {isPaid && (
                    <View style={styles.priceEditContainer}>
                      {isEditingThisPrice ? (
                        <View style={styles.inlinePriceEditRow}>
                          <TextInput
                            style={styles.inlinePriceInput}
                            value={editingPriceText}
                            onChangeText={setEditingPriceText}
                            placeholder="e.g. ₹299 / month"
                            placeholderTextColor={Colors.textTertiary}
                          />
                          <TouchableOpacity
                            style={styles.savePriceBtn}
                            onPress={() => handleSaveEditedPrice(model.id)}>
                            <Icon name="check" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cancelPriceBtn}
                            onPress={() => setEditingPriceId(null)}>
                            <Icon name="close" size={18} color={Colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.editPriceTriggerBtn}
                          onPress={() => {
                            setEditingPriceId(model.id);
                            setEditingPriceText(model.price || '₹199 / month');
                          }}>
                          <Icon name="pencil" size={14} color={Colors.primary} style={{marginRight: 4}} />
                          <Text style={styles.editPriceTriggerText}>
                            Edit Price: {model.price || '₹199 / month'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Card Bottom: Delete Model */}
                  <View style={styles.modelCardFooter}>
                    <Text style={styles.modelUsageNote} numberOfLines={1}>
                      {model.usageLimit || 'Standard processing limits'}
                    </Text>
                    <TouchableOpacity
                      style={styles.deleteModelBtn}
                      onPress={() => handleDeleteModel(model)}>
                      <Icon name="trash-can-outline" size={16} color={Colors.error} />
                      <Text style={styles.deleteModelBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        <View style={styles.footerNote}>
          <Icon name="lock" size={14} color={Colors.textTertiary} style={{marginRight: 4}} />
          <Text style={styles.footerNoteText}>
            Enforced by Super Admin Policy ({ADMIN_EMAIL})
          </Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  topBarCenter: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  topBarSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  heroBanner: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    ...(Shadow.sm as object),
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  heroEmail: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: '#D97706',
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  quickActionBtnSecondary: {
    borderColor: Colors.border,
  },
  quickActionText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  sectionHeaderText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  cardGroup: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  rowFirst: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  rowLast: {
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  textCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  rowTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rowSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.base + 36 + Spacing.md,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  footerNoteText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  unauthContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  unauthTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  unauthSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  backHomeBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  backHomeBtnText: {
    color: Colors.textInverse,
    fontWeight: '600',
    fontSize: FontSize.sm,
  },

  // ── Tab Bar Styles ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.primary,
  },
  tabItemText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  tabItemTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },

  // ── APIs Section Styles ──
  tabContentContainer: {
    paddingBottom: Spacing.md,
  },
  apiStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  apiStatCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  apiStatNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  apiStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  addModelToggleBtn: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...(Shadow.sm as object),
  },
  addModelToggleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  addModelToggleText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addFormCard: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  providerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  providerChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  providerChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  providerChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  apiKeyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    padding: 6,
  },
  tierSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  tierChoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  tierChoiceBtnActiveFree: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  tierChoiceBtnActivePaid: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  tierChoiceText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tierChoiceTextActiveFree: {
    color: '#15803D',
  },
  tierChoiceTextActivePaid: {
    color: '#B45309',
  },
  paidInputsBox: {
    backgroundColor: '#FFFDF5',
    borderRadius: BorderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginBottom: 10,
  },
  submitModelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    marginTop: 4,
  },
  submitModelBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FontSize.sm,
  },

  // Model Item Cards
  modelCard: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modelCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  providerTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    marginRight: 8,
  },
  providerTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  modelCardName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  modelCardDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 16,
  },
  keyDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  keyDisplayText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  keyRevealBtn: {
    padding: 4,
    marginLeft: 6,
  },
  tierControlSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tierControlLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  tierBadgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tierPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  tierPillBtnActiveFree: {
    borderColor: '#86EFAC',
    backgroundColor: '#DCFCE7',
  },
  tierPillBtnActivePaid: {
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
  },
  tierPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  tierPillTextActiveFree: {
    color: '#15803D',
  },
  tierPillTextActivePaid: {
    color: '#B45309',
  },
  tierPriceTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    marginLeft: 3,
  },
  priceEditContainer: {
    marginBottom: 8,
  },
  inlinePriceEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlinePriceInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  savePriceBtn: {
    backgroundColor: Colors.primary,
    padding: 7,
    borderRadius: BorderRadius.sm,
  },
  cancelPriceBtn: {
    backgroundColor: '#E2E8F0',
    padding: 7,
    borderRadius: BorderRadius.sm,
  },
  editPriceTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  editPriceTriggerText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  modelCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 4,
  },
  modelUsageNote: {
    fontSize: 10,
    color: Colors.textTertiary,
    flex: 1,
    marginRight: 8,
  },
  deleteModelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  deleteModelBtnText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    fontWeight: '600',
  },
});

export default AdminSettingsScreen;
