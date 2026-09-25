// TeleCaller AI — Settings Screen
// Premium settings with vector icons, custom modals, and professional UI.

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  Linking,
  Modal,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import Avatar from '../../components/Avatar';
import Card from '../../components/Card';
import BrandHeader from '../../components/BrandHeader';
import {useAuth} from '../../context/AuthContext';
import {useRecordings} from '../../context/RecordingContext';
import {GoogleDriveService} from '../../services/drive/GoogleDriveService';
import {GoogleSheetsService} from '../../services/sheets/GoogleSheetsService';
import {SheetsConnectionStatus} from '../../types/sheets';
import {TranscriptionService} from '../../services/transcription/TranscriptionService';
import {SpeechProvider, SUPPORTED_PROVIDERS} from '../../types/transcription';
import {BackgroundProcessingService} from '../../services/background/BackgroundProcessingService';
import {BackgroundSettings} from '../../types/background';
import {PrivacyConsentModal} from './PrivacyConsentModal';
import {SecurityAuditModal} from './SecurityAuditModal';
import {AppLockService} from '../../services/security/AppLockService';
import {AppLockModal} from '../../components/AppLockModal';
import {toast} from '../../components/Toast';
import {showModal, showConfirm, showDestructiveConfirm, showAlert, showSelection} from '../../components/AppModal';
import {
  AdminConfigService,
  AdminFeatureConfig,
} from '../../services/admin/AdminConfigService';
import {
  ApiModelService,
  AIModelConfig,
} from '../../services/admin/ApiModelService';

// ─────────────────────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{title: string; iconName: string}> = ({title, iconName}) => (
  <View style={styles.sectionHeaderRow}>
    <Icon name={iconName} size={14} color={Colors.textTertiary} />
    <Text style={styles.sectionHeader}>{title}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────
// Settings Row
// ─────────────────────────────────────────────────────────────
interface SettingRowProps {
  iconName: string;
  iconColor?: string;
  label: string;
  value?: string;
  type?: 'navigate' | 'toggle' | 'info';
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  isDestructive?: boolean;
  badge?: string;
  badgeColor?: string;
  isFirst?: boolean;
  isLast?: boolean;
}

function getSettingBadgeTheme(badgeText: string) {
  const t = badgeText.trim().toLowerCase();
  if (t === 'connected' || t === 'exempted' || t === 'verified' || t === 'active') {
    return {
      bg: '#DCFCE7',
      border: '#86EFAC',
      text: '#15803D',
    };
  }
  if (t.includes('not') || t.includes('tap') || t.includes('exempt')) {
    return {
      bg: '#FEF3C7',
      border: '#FDE68A',
      text: '#92400E',
    };
  }
  // Speech-to-text model name / provider e.g. GOOGLE, OPENAI, DEEPGRAM
  return {
    bg: '#EEF2FF',
    border: '#C7D2FE',
    text: '#312E81',
  };
}

const SettingRow: React.FC<SettingRowProps> = ({
  iconName,
  iconColor,
  label,
  value,
  type = 'navigate',
  toggleValue,
  onToggle,
  onPress,
  isDestructive,
  badge,
  badgeColor,
  isFirst,
  isLast,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.settingRow,
        isFirst && styles.settingRowFirst,
        isLast && styles.settingRowLast,
        type === 'info' && styles.settingRowInfo,
      ]}
      onPress={type !== 'toggle' ? onPress : undefined}
      activeOpacity={type === 'toggle' ? 1 : 0.7}
      disabled={type === 'info'}
      accessibilityLabel={label}
      accessibilityRole={type === 'toggle' ? 'switch' : 'button'}>
      {/* Icon */}
      <View
        style={[
          styles.settingIcon,
          isDestructive && styles.settingIconDestructive,
          iconColor ? {backgroundColor: iconColor + '15'} : null,
        ]}>
        <Icon
          name={iconName}
          size={18}
          color={isDestructive ? Colors.error : (iconColor || Colors.primary)}
        />
      </View>

      {/* Label */}
      <View style={styles.settingContent}>
        <Text
          style={[
            styles.settingLabel,
            isDestructive && styles.settingLabelDestructive,
          ]}>
          {label}
        </Text>
        {value && (
          <Text style={styles.settingValue} numberOfLines={1}>
            {value}
          </Text>
        )}
      </View>

      {/* Right side */}
      {type === 'toggle' && onToggle && (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{false: Colors.border, true: Colors.primaryLight}}
          thumbColor={toggleValue ? Colors.primary : Colors.textTertiary}
          accessibilityLabel={label}
        />
      )}
      {type === 'navigate' && (
        <Icon name="chevron-right" size={20} color={Colors.textTertiary} />
      )}
      {badge && (() => {
        const theme = getSettingBadgeTheme(badge);
        return (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.bg,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}>
            <Text style={[styles.badgeText, {color: theme.text}]}>
              {badge}
            </Text>
          </View>
        );
      })()}
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────
// Settings Screen
// ─────────────────────────────────────────────────────────────
const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {authState, signOut} = useAuth();

  // Real user from Google Auth
  const realUser =
    authState.status === 'SIGNED_IN' ? authState.session.user : null;
  const displayName = realUser?.name ?? 'Unknown User';
  const displayEmail = realUser?.email ?? '';
  const displayPhoto = realUser?.photo ?? undefined;

  const [bgSettings, setBgSettings] = useState<BackgroundSettings>(
    BackgroundProcessingService.getSettings(),
  );
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);
  const [langDetection, setLangDetection] = useState(true);
  const [driveStatus, setDriveStatus] = useState<
    'connected' | 'not_connected' | 'checking'
  >('checking');
  const [sheetsStatus, setSheetsStatus] =
    useState<SheetsConnectionStatus>('checking');
  const [selectedProvider, setSelectedProvider] =
    useState<SpeechProvider>('GOOGLE');
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);

  const [modelPickerVisible, setModelPickerVisible] = useState(false);
  const [availableModels, setAvailableModels] = useState<AIModelConfig[]>(
    ApiModelService.getModels(displayEmail),
  );
  const [selectedModelId, setSelectedModelId] = useState<string>(
    ApiModelService.getSelectedModelId(),
  );

  const isSuperAdmin = AdminConfigService.isAdmin(displayEmail);
  const [adminConfig, setAdminConfig] = useState<AdminFeatureConfig>(
    AdminConfigService.getConfig(),
  );

  const [isAppLockEnabled, setIsAppLockEnabled] = useState(AppLockService.isLockEnabled());
  const [showAppLockSetup, setShowAppLockSetup] = useState(false);

  useEffect(() => {
    const unsubAppLock = AppLockService.subscribe(() => {
      setIsAppLockEnabled(AppLockService.isLockEnabled());
    });
    return () => unsubAppLock();
  }, []);

  useEffect(() => {
    AdminConfigService.setUserEmail(displayEmail);
    ApiModelService.setUserEmail(displayEmail);
    AdminConfigService.syncFromBackend(displayEmail);
    ApiModelService.syncFromBackend(displayEmail);

    const unsubAdmin = AdminConfigService.subscribe(setAdminConfig);
    const unsubModels = ApiModelService.subscribe(models => {
      setAvailableModels(models);
    });
    return () => {
      unsubAdmin();
      unsubModels();
    };
  }, [displayEmail]);

  const showSetting = (key: keyof AdminFeatureConfig) => {
    return isSuperAdmin || Boolean(adminConfig[key]);
  };

  useEffect(() => {
    const unsub = BackgroundProcessingService.subscribe(setBgSettings);
    TranscriptionService.getSelectedProvider().then(setSelectedProvider);
    if (authState.status === 'SIGNED_IN') {
      GoogleDriveService.checkDriveConnection().then(setDriveStatus);
      GoogleSheetsService.checkSheetsConnection().then(setSheetsStatus);
    } else {
      setDriveStatus('not_connected');
      setSheetsStatus('not_connected');
    }
    return () => unsub();
  }, [authState.status]);

  const handleSelectInterval = () => {
    showSelection(
      'Scan Frequency',
      'Select how often Audify AI checks for new call recordings:',
      [
        {
          text: 'Every 5 Minutes',
          selected: bgSettings.intervalMinutes === 5,
          onPress: () => BackgroundProcessingService.updateSettings({intervalMinutes: 5}),
        },
        {
          text: 'Every 15 Minutes',
          selected: bgSettings.intervalMinutes === 15,
          onPress: () => BackgroundProcessingService.updateSettings({intervalMinutes: 15}),
        },
        {
          text: 'Every 30 Minutes',
          selected: bgSettings.intervalMinutes === 30,
          onPress: () => BackgroundProcessingService.updateSettings({intervalMinutes: 30}),
        },
        {
          text: 'Every 60 Minutes',
          selected: bgSettings.intervalMinutes === 60,
          onPress: () => BackgroundProcessingService.updateSettings({intervalMinutes: 60}),
        },
      ],
    );
  };

  const handleBatteryOptimization = async () => {
    if (bgSettings.batteryOptimizationsIgnored) {
      showAlert(
        'Battery Optimization',
        'Audify AI is already exempted from battery optimizations. Background tasks run reliably.',
      );
      return;
    }

    showConfirm(
      'Exempt from Battery Saver',
      'Android task killers may terminate background monitors. Exempt Audify AI to ensure recordings are processed immediately.',
      async () => {
        await BackgroundProcessingService.requestIgnoreBatteryOptimizations();
        toast.success('Exemption Granted', 'Battery optimization exemption applied.');
      },
      'Allow Exemption',
    );
  };

  const handleTriggerManualBackgroundSync = async () => {
    setIsTriggeringSync(true);
    try {
      const res =
        await BackgroundProcessingService.checkAndProcessNewRecordings(true);
      toast.success(
        'Sync Complete',
        `Discovered: ${res.discovered} • Processed: ${res.processed} • Failed: ${res.failed}`,
      );
    } catch (e: any) {
      toast.error('Sync Error', e?.message || 'Failed to complete background sync.');
    } finally {
      setIsTriggeringSync(false);
    }
  };

  const handleDriveDetails = async () => {
    if (driveStatus !== 'connected') {
      showAlert(
        'Google Drive',
        'Google Drive is not connected. Please ensure you are signed in with a Google account that has Drive permissions enabled.',
      );
      return;
    }

    showConfirm(
      'Google Drive Connected',
      `Account: ${displayEmail}\n\nFolder Hierarchy:\n• Audify AI/\n  • Recordings/\n    • YYYY/MM/DD/\n\nDuplicate Protection: Active`,
      async () => {
        try {
          const res = await GoogleDriveService.ensureFolderHierarchy();
          toast.success(
            'Folders Verified',
            `Root: ${res.rootFolderId}\nRecordings: ${res.recordingsFolderId}`,
          );
        } catch (e: any) {
          toast.error('Verification Failed', e?.message || 'Could not verify folders.');
        }
      },
      'Verify Folders',
    );
  };

  const handleSheetsDetails = async () => {
    if (sheetsStatus !== 'connected') {
      showAlert(
        'Google Sheets',
        'Google Sheets is not connected. Please ensure you are signed in with a Google account that has Sheets permissions enabled.',
      );
      return;
    }

    showConfirm(
      'Google Sheets Connected',
      `Account: ${displayEmail}\n\nSpreadsheet: Audify AI - Call Records\nColumns: A (Call ID) to N (Processed At)\n\nAutomatic row insertion active.`,
      async () => {
        try {
          const sheetInfo = await GoogleSheetsService.getOrCreateSpreadsheet();
          showConfirm(
            'Sheet Ready',
            `Spreadsheet verified!\n\nTitle: ${sheetInfo.title}\nID: ${sheetInfo.spreadsheetId}`,
            () => {
              if (sheetInfo.spreadsheetUrl) {
                Linking.openURL(sheetInfo.spreadsheetUrl);
              }
            },
            'Open Sheet',
          );
        } catch (e: any) {
          toast.error('Verification Failed', e?.message || 'Could not verify sheet.');
        }
      },
      'Verify Sheet',
    );
  };

  const handleSelectProvider = () => {
    setModelPickerVisible(true);
  };

  const handleSignOut = () => {
    showDestructiveConfirm(
      'Sign Out',
      'Are you sure you want to sign out from Audify AI?',
      async () => {
        await signOut();
      },
      'Sign Out',
    );
  };

  const handleDeleteAccount = () => {
    showDestructiveConfirm(
      'Delete Account & Data',
      'This will revoke authorization, permanently delete your local session tokens from Android KeyStore, and reset local app preferences. Are you sure you want to proceed?',
      async () => {
        try {
          await signOut();
          toast.success('Account Data Deleted', 'Session and credentials wiped successfully.');
        } catch (e: any) {
          toast.error('Error', e?.message || 'Failed to delete account data.');
        }
      },
      'Delete Account',
    );
  };

  const handleToggleAppLock = (enable: boolean) => {
    if (enable) {
      setShowAppLockSetup(true);
    } else {
      showDestructiveConfirm(
        'Disable App Lock',
        'Are you sure you want to remove PIN lock protection from Audify AI?',
        async () => {
          await AppLockService.disable();
          setIsAppLockEnabled(false);
          toast.info('App Lock Disabled', 'PIN protection turned off.');
        },
        'Disable Lock',
      );
    }
  };

  const {
    recordings,
    scanRecordings,
    status: scanStatus,
    selectedFolder,
    selectFolder,
    clearSelectedFolder,
  } = useRecordings();

  const handleScanRecordings = async () => {
    try {
      await scanRecordings();
      toast.success(
        'Scan Complete',
        `Discovered ${recordings.length} recording(s) on device.`,
      );
    } catch (e: any) {
      toast.error('Scan Failed', e?.message || 'Failed to scan recordings.');
    }
  };

  const handleSelectFolder = async () => {
    try {
      const folder = await selectFolder();
      toast.success('Folder Configured', `Access granted for "${folder.name}".`);
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('cancel')) return;
      toast.error('Folder Error', e?.message || 'Failed to select recording folder.');
    }
  };

  const handleFolderDetails = () => {
    if (!selectedFolder) {
      handleSelectFolder();
      return;
    }
    showModal(
      'Recording Folder',
      `Current folder: "${selectedFolder.name}"`,
      [
        {text: 'Change Folder', onPress: handleSelectFolder},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await clearSelectedFolder();
            toast.info('Folder Removed', 'Persisted folder access cleared.');
          },
        },
        {text: 'Close', style: 'cancel'},
      ],
      'info',
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* ── Brand Header ── */}
      <BrandHeader />

      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={['#EFF6FF', '#F5F3FF']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── ACCOUNT ── */}
        <SectionHeader title="ACCOUNT" iconName="account-circle-outline" />
        <Card variant="elevated" padding={0} style={styles.settingsGroup}>
          {/* Profile card */}
          <View style={styles.profileRow}>
            <Avatar name={displayName} photoUrl={displayPhoto} size={52} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileEmail}>{displayEmail}</Text>
              <View style={styles.googleBadge}>
                <Icon name="check-circle" size={12} color={Colors.success} />
                <Text style={styles.googleBadgeText}>Google Account</Text>
              </View>
            </View>
          </View>
          <View style={styles.settingDivider} />
          <SettingRow
            iconName="account-outline"
            iconColor={Colors.primary}
            label="Profile"
            value="View & edit profile"
            onPress={() => navigation.navigate('Profile')}
            isFirst={false}
            isLast={!isSuperAdmin}
          />
          {isSuperAdmin && (
            <>
              <View style={styles.settingDivider} />
              <SettingRow
                iconName="shield-crown-outline"
                iconColor="#D97706"
                label="Admin Controls"
                value="Manage feature visibility"
                badge="ADMIN"
                badgeColor="#FEF3C7"
                onPress={() => navigation.navigate('AdminSettings')}
                isLast={true}
              />
            </>
          )}
        </Card>

        {/* ── RECORDINGS ── */}
        {(showSetting('recordingFolder') ||
          showSetting('changeRecordingFolder') ||
          showSetting('scanRecordings')) && (
          <>
            <SectionHeader title="RECORDINGS" iconName="folder-music-outline" />
            <Card variant="elevated" padding={0} style={styles.settingsGroup}>
              {[
                showSetting('recordingFolder') && (
                  <SettingRow
                    key="rf"
                    iconName="folder-outline"
                    iconColor="#F59E0B"
                    label="Recording Folder"
                    value={selectedFolder ? selectedFolder.name : 'Not configured'}
                    onPress={handleFolderDetails}
                  />
                ),
                showSetting('changeRecordingFolder') && (
                  <SettingRow
                    key="crf"
                    iconName="folder-swap-outline"
                    iconColor="#F59E0B"
                    label="Change Recording Folder"
                    onPress={handleSelectFolder}
                  />
                ),
                showSetting('scanRecordings') && (
                  <SettingRow
                    key="sr"
                    iconName="magnify"
                    iconColor="#2563EB"
                    label="Scan Recordings"
                    value={
                      scanStatus === 'scanning'
                        ? 'Scanning...'
                        : recordings.length > 0
                        ? `${recordings.length} found`
                        : 'Tap to scan'
                    }
                    onPress={handleScanRecordings}
                  />
                ),
              ]
                .filter(Boolean)
                .map((item, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <View style={styles.settingDivider} />}
                    {item}
                  </React.Fragment>
                ))}
            </Card>
          </>
        )}

        {/* ── BACKGROUND & AUTOMATION ── */}
        {(showSetting('backgroundMonitoring') ||
          showSetting('persistentNotification') ||
          showSetting('scanFrequency') ||
          showSetting('autoProcessPipeline') ||
          showSetting('autoDriveUpload') ||
          showSetting('autoTranscription') ||
          showSetting('wifiOnlySync') ||
          showSetting('batteryOptimization') ||
          showSetting('triggerBackgroundScan') ||
          showSetting('lastBackgroundCheck')) && (
          <>
            <SectionHeader title="AUTOMATION" iconName="robot-outline" />
            <Card variant="elevated" padding={0} style={styles.settingsGroup}>
              {[
                showSetting('backgroundMonitoring') && (
                  <SettingRow
                    key="bm"
                    iconName="robot-outline"
                    iconColor="#7C3AED"
                    label="Background Monitoring"
                    type="toggle"
                    toggleValue={bgSettings.enabled}
                    onToggle={val =>
                      BackgroundProcessingService.updateSettings({enabled: val})
                    }
                  />
                ),
                showSetting('persistentNotification') && (
                  <SettingRow
                    key="pn"
                    iconName="bell-outline"
                    iconColor="#7C3AED"
                    label="Persistent Notification"
                    type="toggle"
                    toggleValue={bgSettings.foregroundServiceEnabled}
                    onToggle={val =>
                      BackgroundProcessingService.updateSettings({
                        foregroundServiceEnabled: val,
                      })
                    }
                  />
                ),
                showSetting('scanFrequency') && (
                  <SettingRow
                    key="sf"
                    iconName="timer-outline"
                    iconColor="#7C3AED"
                    label="Scan Frequency"
                    value={`Every ${bgSettings.intervalMinutes} min`}
                    type="navigate"
                    onPress={handleSelectInterval}
                  />
                ),
                showSetting('autoProcessPipeline') && (
                  <SettingRow
                    key="app"
                    iconName="cog-outline"
                    iconColor="#7C3AED"
                    label="Auto-Process Pipeline"
                    type="toggle"
                    toggleValue={bgSettings.autoProcess}
                    onToggle={val =>
                      BackgroundProcessingService.updateSettings({autoProcess: val})
                    }
                  />
                ),
                showSetting('autoDriveUpload') && (
                  <SettingRow
                    key="adu"
                    iconName="cloud-upload-outline"
                    iconColor="#2563EB"
                    label="Auto Google Drive Upload"
                    type="toggle"
                    toggleValue={bgSettings.autoUpload}
                    onToggle={val =>
                      BackgroundProcessingService.updateSettings({autoUpload: val})
                    }
                  />
                ),
                showSetting('autoTranscription') && (
                  <SettingRow
                    key="at"
                    iconName="file-document-edit-outline"
                    iconColor="#2563EB"
                    label="Auto AI Transcription"
                    type="toggle"
                    toggleValue={bgSettings.autoTranscribe}
                    onToggle={val =>
                      BackgroundProcessingService.updateSettings({autoTranscribe: val})
                    }
                  />
                ),
                showSetting('wifiOnlySync') && (
                  <SettingRow
                    key="wo"
                    iconName="wifi"
                    iconColor="#16A34A"
                    label="Wi-Fi Only Sync"
                    type="toggle"
                    toggleValue={bgSettings.wifiOnly}
                    onToggle={val =>
                      BackgroundProcessingService.updateSettings({wifiOnly: val})
                    }
                  />
                ),
                showSetting('batteryOptimization') && (
                  <SettingRow
                    key="bo"
                    iconName="battery-charging"
                    iconColor="#16A34A"
                    label="Battery Optimization"
                    badge={
                      bgSettings.batteryOptimizationsIgnored
                        ? 'Exempted'
                        : 'Tap to Exempt'
                    }
                    badgeColor={
                      bgSettings.batteryOptimizationsIgnored
                        ? Colors.successLight
                        : Colors.warningLight
                    }
                    onPress={handleBatteryOptimization}
                  />
                ),
                showSetting('triggerBackgroundScan') && (
                  <SettingRow
                    key="tbs"
                    iconName="refresh"
                    iconColor="#2563EB"
                    label="Trigger Background Scan"
                    value={
                      isTriggeringSync || bgSettings.lastSyncStatus === 'running'
                        ? 'Scanning...'
                        : 'Run Now'
                    }
                    onPress={handleTriggerManualBackgroundSync}
                  />
                ),
                showSetting('lastBackgroundCheck') && (
                  <SettingRow
                    key="lbc"
                    iconName="clock-outline"
                    iconColor={Colors.textTertiary}
                    label="Last Background Check"
                    value={formatLastSync(
                      bgSettings.lastSyncTimestamp,
                      bgSettings.lastSyncStatus,
                      bgSettings.lastSyncResult,
                    )}
                    type="info"
                  />
                ),
              ]
                .filter(Boolean)
                .map((item, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <View style={styles.settingDivider} />}
                    {item}
                  </React.Fragment>
                ))}
            </Card>
          </>
        )}

        {/* ── GOOGLE ── */}
        {(showSetting('googleDrive') || showSetting('googleSheets')) && (
          <>
            <SectionHeader title="GOOGLE SERVICES" iconName="google" />
            <Card variant="elevated" padding={0} style={styles.settingsGroup}>
              {[
                showSetting('googleDrive') && (
                  <SettingRow
                    key="gd"
                    iconName="google-drive"
                    iconColor="#4285F4"
                    label="Google Drive"
                    badge={driveStatus === 'connected' ? 'Connected' : 'Not Connected'}
                    badgeColor={
                      driveStatus === 'connected'
                        ? Colors.successLight
                        : Colors.warningLight
                    }
                    onPress={handleDriveDetails}
                  />
                ),
                showSetting('googleSheets') && (
                  <SettingRow
                    key="gs"
                    iconName="google-spreadsheet"
                    iconColor="#0F9D58"
                    label="Google Sheets"
                    badge={sheetsStatus === 'connected' ? 'Connected' : 'Not Connected'}
                    badgeColor={
                      sheetsStatus === 'connected'
                        ? Colors.successLight
                        : Colors.warningLight
                    }
                    onPress={handleSheetsDetails}
                  />
                ),
              ]
                .filter(Boolean)
                .map((item, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <View style={styles.settingDivider} />}
                    {item}
                  </React.Fragment>
                ))}
            </Card>
          </>
        )}

        {/* ── TRANSCRIPTION ── */}
        {(showSetting('sttProvider') || showSetting('languageDetection')) && (
          <>
            <SectionHeader title="TRANSCRIPTION" iconName="microphone-outline" />
            <Card variant="elevated" padding={0} style={styles.settingsGroup}>
              {[
                showSetting('sttProvider') && (
                  <SettingRow
                    key="stt"
                    iconName="microphone"
                    iconColor="#DC2626"
                    label="AI Speech & Transcription Model"
                    value={
                      availableModels.find(m => m.id === selectedModelId)?.name ||
                      SUPPORTED_PROVIDERS[selectedProvider]?.name ||
                      'Google Cloud STT'
                    }
                    badge={
                      availableModels.find(m => m.id === selectedModelId)?.tier === 'paid'
                        ? 'PAID'
                        : 'FREE'
                    }
                    badgeColor={
                      availableModels.find(m => m.id === selectedModelId)?.tier === 'paid'
                        ? '#FEF3C7'
                        : '#DCFCE7'
                    }
                    onPress={handleSelectProvider}
                  />
                ),
                showSetting('languageDetection') && (
                  <SettingRow
                    key="ld"
                    iconName="web"
                    iconColor="#2563EB"
                    label="Language Detection"
                    type="toggle"
                    toggleValue={langDetection}
                    onToggle={setLangDetection}
                  />
                ),
              ]
                .filter(Boolean)
                .map((item, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <View style={styles.settingDivider} />}
                    {item}
                  </React.Fragment>
                ))}
            </Card>
          </>
        )}

        {/* ── PRIVACY & SECURITY ── */}
        {(showSetting('privacyConsent') || showSetting('securityAudit')) && (
          <>
            <SectionHeader title="PRIVACY & SECURITY" iconName="shield-check-outline" />
            <Card variant="elevated" padding={0} style={styles.settingsGroup}>
              {[
                showSetting('privacyConsent') && (
                  <SettingRow
                    key="pc"
                    iconName="shield-check-outline"
                    iconColor="#16A34A"
                    label="Privacy & Consent"
                    value="Local-first architecture"
                    onPress={() => setPrivacyModalVisible(true)}
                  />
                ),
                showSetting('securityAudit') && (
                  <SettingRow
                    key="sa"
                    iconName="lock-outline"
                    iconColor="#16A34A"
                    label="Security Audit"
                    value="Hardware KeyStore & TLS"
                    badge="Verified"
                    badgeColor={Colors.successLight}
                    onPress={() => setSecurityModalVisible(true)}
                  />
                ),
                <SettingRow
                  key="applock"
                  iconName="shield-key-outline"
                  iconColor="#7C3AED"
                  label="App PIN Lock"
                  value={isAppLockEnabled ? 'KeyStore Hardware PIN' : 'Disabled'}
                  badge={isAppLockEnabled ? 'Active' : 'Off'}
                  badgeColor={isAppLockEnabled ? Colors.successLight : Colors.warningLight}
                  type="toggle"
                  toggleValue={isAppLockEnabled}
                  onToggle={handleToggleAppLock}
                />,
              ]
                .filter(Boolean)
                .map((item, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <View style={styles.settingDivider} />}
                    {item}
                  </React.Fragment>
                ))}
            </Card>
          </>
        )}

        {/* ── ABOUT ── */}
        <SectionHeader title="ABOUT" iconName="information-outline" />
        <Card variant="elevated" padding={0} style={styles.settingsGroup}>
          <SettingRow
            iconName="information-outline"
            iconColor={Colors.textTertiary}
            label="Version"
            value="1.0.0"
            type="info"
            isFirst={true}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            iconName="cellphone"
            iconColor={Colors.textTertiary}
            label="About Audify AI"
            onPress={() => toast.info('Audify AI', 'Record • Transcribe • Organize • Automate')}
            isLast={true}
          />
        </Card>

        {/* ── BOTTOM ACTIONS: LOGOUT & DELETE ACCOUNT ── */}
        <View style={styles.bottomActionsSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
            accessibilityLabel="Log out of account"
            accessibilityRole="button">
            <Icon name="logout" size={18} color="#DC2626" style={styles.actionButtonIcon} />
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>

          {showSetting('deleteAccount') && (
            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
              accessibilityLabel="Delete account and data"
              accessibilityRole="button">
              <Icon name="trash-can-outline" size={16} color="#DC2626" style={styles.actionButtonIcon} />
              <Text style={styles.deleteAccountButtonText}>Delete Account & Data</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Image
            source={require('../../assets/logo_main.png')}
            style={styles.footerLogo}
            resizeMode="contain"
          />
          <Text style={styles.footerTagline}>
            Record • Transcribe • Organize
          </Text>
        </View>
      </ScrollView>

      {/* Privacy & Security Modals */}
      <PrivacyConsentModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
      />
      <SecurityAuditModal
        visible={securityModalVisible}
        onClose={() => setSecurityModalVisible(false)}
      />
      <AppLockModal
        visible={showAppLockSetup}
        mode="setup"
        onSuccess={() => {
          setShowAppLockSetup(false);
          setIsAppLockEnabled(true);
          toast.success('App Lock Enabled', 'Your 4-digit PIN is now active.');
        }}
        onCancel={() => setShowAppLockSetup(false)}
      />

      {/* ── AI Model Picker Modal ── */}
      <Modal
        visible={modelPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModelPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderIconBox}>
                  <Icon name="brain" size={22} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.modalHeaderTitle}>Select AI Model</Text>
                  <Text style={styles.modalHeaderSubtitle}>
                    Transcription & audio reasoning models
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModelPickerVisible(false)}>
                <Icon name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Model List */}
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={{paddingBottom: 24}}
              showsVerticalScrollIndicator={false}>
              {availableModels.map(model => {
                const isSelected = selectedModelId === model.id;
                const isFree = model.tier === 'free';

                return (
                  <TouchableOpacity
                    key={model.id}
                    style={[
                      styles.modelPickerCard,
                      isSelected && styles.modelPickerCardSelected,
                      !isFree && styles.modelPickerCardPaid,
                    ]}
                    onPress={async () => {
                      if (isFree) {
                        await TranscriptionService.setSelectedProvider(
                          (model.providerKey === 'CUSTOM' ? 'GOOGLE' : model.providerKey) as any,
                        );
                        await ApiModelService.setSelectedModelId(model.id);
                        setSelectedModelId(model.id);
                        setSelectedProvider(
                          (model.providerKey === 'CUSTOM' ? 'GOOGLE' : model.providerKey) as any,
                        );
                        setModelPickerVisible(false);
                        toast.success(
                          'Model Activated',
                          `Using ${model.name} for speech transcription.`,
                        );
                      } else {
                        // User requirement: When clicking paid model, open new page showing usage, benefits, and amount
                        setModelPickerVisible(false);
                        navigation.navigate('ModelTierDetails', {modelId: model.id});
                      }
                    }}
                    activeOpacity={0.7}>
                    {/* Top Row: Name and Tier badge */}
                    <View style={styles.pickerModelHeader}>
                      <View style={styles.pickerModelTitleRow}>
                        <View style={styles.pickerProviderTag}>
                          <Text style={styles.pickerProviderTagText}>
                            {model.providerKey}
                          </Text>
                        </View>
                        <Text style={styles.pickerModelName}>{model.name}</Text>
                      </View>

                      {/* Tier Badge */}
                      <View
                        style={[
                          styles.pickerTierBadge,
                          isFree ? styles.pickerTierBadgeFree : styles.pickerTierBadgePaid,
                        ]}>
                        <Icon
                          name={isFree ? 'check-circle' : 'crown'}
                          size={11}
                          color={isFree ? '#15803D' : '#B45309'}
                          style={{marginRight: 3}}
                        />
                        <Text
                          style={[
                            styles.pickerTierBadgeText,
                            isFree
                              ? styles.pickerTierBadgeTextFree
                              : styles.pickerTierBadgeTextPaid,
                          ]}>
                          {isFree ? 'FREE' : `PAID • ${model.price || '₹199/mo'}`}
                        </Text>
                      </View>
                    </View>

                    {/* Description */}
                    {model.description ? (
                      <Text style={styles.pickerModelDesc} numberOfLines={2}>
                        {model.description}
                      </Text>
                    ) : null}

                    {/* Paid Notice / Free Active Indicator */}
                    {isFree ? (
                      <View style={styles.pickerFreeRow}>
                        <Icon
                          name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                          size={16}
                          color={isSelected ? Colors.primary : Colors.textTertiary}
                          style={{marginRight: 6}}
                        />
                        <Text
                          style={[
                            styles.pickerFreeText,
                            isSelected && {color: Colors.primary, fontWeight: '700'},
                          ]}>
                          {isSelected ? 'Active & Currently Selected' : 'Free Tier • Tap to select'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.pickerPaidNoticeBox}>
                        <View style={styles.pickerPaidNoticeLeft}>
                          <Icon name="lock" size={13} color="#D97706" style={{marginRight: 4}} />
                          <Text style={styles.pickerPaidNoticeText}>
                            Temporarily not available • Tap to view tier details & benefits
                          </Text>
                        </View>
                        <Icon name="chevron-right" size={16} color="#D97706" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  headerTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },

  // Scroll
  scroll: {flex: 1},
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing['4xl'],
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
    marginLeft: Spacing.sm,
  },
  sectionHeader: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // Settings group
  settingsGroup: {
    overflow: 'hidden',
  },

  // Profile row
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  googleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#16A34A',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    opacity: 1,
  },
  googleBadgeText: {
    fontSize: FontSize.xs,
    color: '#14532D',
    fontWeight: '700',
  },

  // Setting row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  settingRowFirst: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  settingRowLast: {
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  settingRowInfo: {
    opacity: 1,
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.base + 36 + Spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  settingIconDestructive: {
    backgroundColor: Colors.errorLight,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  settingLabelDestructive: {
    color: Colors.error,
  },
  settingValue: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
    opacity: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Footer & Bottom Actions
  bottomActionsSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    gap: 8,
  },
  logoutButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#DC2626',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 10,
    gap: 6,
  },
  deleteAccountButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#DC2626',
  },
  actionButtonIcon: {
    marginRight: 2,
  },
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  footerLogo: {
    width: 140,
    height: 44,
    opacity: 0.85,
  },
  footerTagline: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginTop: 4,
  },

  // ── AI Model Picker Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    ...(Shadow.lg as object),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: Spacing.md,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderIconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalHeaderSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F1F5F9',
  },
  modalScrollView: {
    marginTop: 4,
  },
  modelPickerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  modelPickerCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F5F3FF',
  },
  modelPickerCardPaid: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  pickerModelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pickerModelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  pickerProviderTag: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: 8,
  },
  pickerProviderTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  pickerModelName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  pickerTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  pickerTierBadgeFree: {
    backgroundColor: '#DCFCE7',
  },
  pickerTierBadgePaid: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pickerTierBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pickerTierBadgeTextFree: {
    color: '#15803D',
  },
  pickerTierBadgeTextPaid: {
    color: '#B45309',
  },
  pickerModelDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  pickerFreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  pickerFreeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  pickerPaidNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(254, 240, 138, 0.35)',
    borderRadius: BorderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pickerPaidNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  pickerPaidNoticeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
});

function formatLastSync(
  timestamp: string | null,
  status: string,
  result?: {newlyDiscovered: number; processed: number; failed: number},
): string {
  if (!timestamp) return 'Never checked';
  try {
    const d = new Date(timestamp);
    const timeStr = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    if (result && result.processed > 0) {
      return `${timeStr} (${result.processed} processed)`;
    }
    return `${timeStr} (${status})`;
  } catch {
    return timestamp;
  }
}

export default SettingsScreen;
