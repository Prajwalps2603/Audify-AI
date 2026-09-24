import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import Avatar from '../../components/Avatar';
import Card from '../../components/Card';
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

// ─────────────────────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{title: string}> = ({title}) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

// ─────────────────────────────────────────────────────────────
// Settings Row
// ─────────────────────────────────────────────────────────────
interface SettingRowProps {
  icon: string;
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

const SettingRow: React.FC<SettingRowProps> = ({
  icon,
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
        ]}>
        <Text style={styles.settingIconText}>{icon}</Text>
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
        <Text style={styles.chevron}>›</Text>
      )}
      {badge && (
        <View style={[styles.badge, {backgroundColor: badgeColor ?? Colors.successLight}]}>
          <Text style={[styles.badgeText, {color: badgeColor ? Colors.textInverse : Colors.success}]}>
            {badge}
          </Text>
        </View>
      )}
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
    Alert.alert(
      'Background Check Frequency',
      'Select how often TeleCaller AI inspects storage for new call recordings in the background:',
      [
        {
          text: `Every 5 Minutes ${bgSettings.intervalMinutes === 5 ? '✓' : ''}`,
          onPress: () =>
            BackgroundProcessingService.updateSettings({intervalMinutes: 5}),
        },
        {
          text: `Every 15 Minutes ${bgSettings.intervalMinutes === 15 ? '✓' : ''}`,
          onPress: () =>
            BackgroundProcessingService.updateSettings({intervalMinutes: 15}),
        },
        {
          text: `Every 30 Minutes ${bgSettings.intervalMinutes === 30 ? '✓' : ''}`,
          onPress: () =>
            BackgroundProcessingService.updateSettings({intervalMinutes: 30}),
        },
        {
          text: `Every 60 Minutes ${bgSettings.intervalMinutes === 60 ? '✓' : ''}`,
          onPress: () =>
            BackgroundProcessingService.updateSettings({intervalMinutes: 60}),
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    );
  };

  const handleBatteryOptimization = async () => {
    if (bgSettings.batteryOptimizationsIgnored) {
      Alert.alert(
        'Battery Optimization',
        'TeleCaller AI is already exempted from Android battery optimizations. Background tasks can run reliably without being killed by Doze mode.',
        [{text: 'OK'}],
      );
      return;
    }

    Alert.alert(
      'Exempt from Battery Saver',
      'Android OEM task killers (MIUI, OneUI, ColorOS) terminate background monitors when screen is locked.\n\nWould you like to exempt TeleCaller AI from battery optimization to ensure recordings are immediately processed?',
      [
        {text: 'Later', style: 'cancel'},
        {
          text: 'Allow Exemption',
          onPress: async () => {
            await BackgroundProcessingService.requestIgnoreBatteryOptimizations();
          },
        },
      ],
    );
  };

  const handleTriggerManualBackgroundSync = async () => {
    setIsTriggeringSync(true);
    try {
      const res =
        await BackgroundProcessingService.checkAndProcessNewRecordings(true);
      Alert.alert(
        'Background Sync',
        `Sync executed successfully!\n\n• Discovered: ${res.discovered}\n• Processed: ${res.processed}\n• Failed: ${res.failed}`,
        [{text: 'OK'}],
      );
    } catch (e: any) {
      Alert.alert(
        'Sync Error',
        e?.message || 'Failed to complete background sync.',
      );
    } finally {
      setIsTriggeringSync(false);
    }
  };

  const handleDriveDetails = async () => {
    if (driveStatus !== 'connected') {
      Alert.alert(
        'Google Drive',
        'Google Drive is not connected. Please ensure you are signed in with a Google account that has Drive permissions enabled.',
        [{text: 'OK'}],
      );
      return;
    }

    Alert.alert(
      'Google Drive Connected',
      `Account: ${displayEmail}\n\nFolder Hierarchy:\n• TeleCaller AI/\n  • Recordings/\n    • YYYY/MM/DD/\n  • Call Records/\n\nDuplicate Protection: Active\n\nWould you like to verify and ensure the Drive folder structure now?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Verify Folders',
          onPress: async () => {
            try {
              const res = await GoogleDriveService.ensureFolderHierarchy();
              Alert.alert(
                'Folders Ready',
                `Google Drive folder structure verified successfully!\n\nRoot ID: ${res.rootFolderId}\nRecordings: ${res.recordingsFolderId}`,
                [{text: 'OK'}],
              );
            } catch (e: any) {
              Alert.alert(
                'Folder Verification Failed',
                e?.message || 'Could not verify folders.',
              );
            }
          },
        },
      ],
    );
  };

  const handleSheetsDetails = async () => {
    if (sheetsStatus !== 'connected') {
      Alert.alert(
        'Google Sheets',
        'Google Sheets is not connected. Please ensure you are signed in with a Google account that has Sheets permissions enabled.',
        [{text: 'OK'}],
      );
      return;
    }

    Alert.alert(
      'Google Sheets Connected',
      `Account: ${displayEmail}\n\nSpreadsheet: TeleCaller AI - Call Records\nSheet: Call Records\nColumns: A (Call ID) to N (Processed At)\n\n• Automatic row insertion upon recording processing\n• Duplicate check active\n• Strictly no manual sync button`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Verify / Open Sheet',
          onPress: async () => {
            try {
              const sheetInfo = await GoogleSheetsService.getOrCreateSpreadsheet();
              Alert.alert(
                'Sheet Ready',
                `Spreadsheet verified and ready!\n\nTitle: ${sheetInfo.title}\nID: ${sheetInfo.spreadsheetId}\n\nWould you like to open it now?`,
                [
                  {text: 'Done', style: 'cancel'},
                  {
                    text: 'Open Sheet ↗',
                    onPress: () => {
                      if (sheetInfo.spreadsheetUrl) {
                        Linking.openURL(sheetInfo.spreadsheetUrl);
                      }
                    },
                  },
                ],
              );
            } catch (e: any) {
              Alert.alert(
                'Sheet Verification Failed',
                e?.message || 'Could not verify sheet.',
              );
            }
          },
        },
      ],
    );
  };

  const handleSelectProvider = () => {
    Alert.alert(
      'Speech-to-Text Provider',
      'Select your AI transcription provider for call recordings:\n\n• Google Cloud: v2 Chirp Indian regional languages\n• OpenAI: Whisper-1 robust multilingual\n• Deepgram: Nova-2 conversational telephony diarization',
      [
        {
          text: `Google Cloud STT ${selectedProvider === 'GOOGLE' ? '✓' : ''}`,
          onPress: async () => {
            await TranscriptionService.setSelectedProvider('GOOGLE');
            setSelectedProvider('GOOGLE');
          },
        },
        {
          text: `OpenAI Whisper ${selectedProvider === 'OPENAI' ? '✓' : ''}`,
          onPress: async () => {
            await TranscriptionService.setSelectedProvider('OPENAI');
            setSelectedProvider('OPENAI');
          },
        },
        {
          text: `Deepgram Nova-2 ${selectedProvider === 'DEEPGRAM' ? '✓' : ''}`,
          onPress: async () => {
            await TranscriptionService.setSelectedProvider('DEEPGRAM');
            setSelectedProvider('DEEPGRAM');
          },
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Sign out from TeleCaller AI?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            // AuthContext will update authState to SIGNED_OUT
            // AppNavigator automatically shows Login screen
          },
        },
      ],
    );
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
      Alert.alert(
        'Recording Scanner',
        `Scan complete. Discovered ${recordings.length} recording(s) across MediaStore and OEM folders.`,
        [{text: 'OK'}],
      );
    } catch (e: any) {
      Alert.alert('Scanner', e?.message || 'Failed to scan recordings.', [{text: 'OK'}]);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const folder = await selectFolder();
      Alert.alert(
        'Folder Configured',
        `Access granted and persisted for "${folder.name}".`,
        [{text: 'OK'}],
      );
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('cancel')) return;
      Alert.alert(
        'Folder Picker',
        e?.message || 'Failed to select recording folder.',
        [{text: 'OK'}],
      );
    }
  };

  const handleFolderDetails = () => {
    if (!selectedFolder) {
      handleSelectFolder();
      return;
    }
    Alert.alert(
      'Recording Folder',
      `Current folder: "${selectedFolder.name}"`,
      [
        {text: 'Change Folder', onPress: handleSelectFolder},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await clearSelectedFolder();
            Alert.alert('Folder Removed', 'Persisted folder access cleared.');
          },
        },
        {text: 'Close', style: 'cancel'},
      ],
    );
  };

  const handleComingSoon = (feature: string) => {
    Alert.alert(
      'Coming Soon',
      `"${feature}" will be implemented in a later phase.`,
      [{text: 'OK'}],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Phase 2 — no more mock notice, auth is real */}

        {/* ── ACCOUNT ── */}
        <SectionHeader title="ACCOUNT" />
        <Card variant="elevated" padding={0} style={styles.settingsGroup}>
          {/* Profile card — real user */}
          <View style={styles.profileRow}>
            <Avatar name={displayName} photoUrl={displayPhoto} size={52} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileEmail}>{displayEmail}</Text>
              <View style={styles.googleBadge}>
                <Text style={styles.googleBadgeText}>✓ Google Account</Text>
              </View>
            </View>
          </View>
          <View style={styles.settingDivider} />
          <SettingRow
            icon="👤"
            label="Profile"
            value="View profile"
            onPress={() => handleComingSoon('Profile')}
            isFirst={false}
            isLast={false}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="🚪"
            label="Sign Out"
            type="navigate"
            onPress={handleSignOut}
            isDestructive={true}
            isLast={true}
          />
        </Card>

        {/* ── RECORDINGS ── */}
        <SectionHeader title="RECORDINGS" />
        <Card variant="elevated" padding={0} style={styles.settingsGroup}>
          <SettingRow
            icon="📁"
            label="Recording Folder"
            value={selectedFolder ? selectedFolder.name : 'Not configured'}
            onPress={handleFolderDetails}
            isFirst={true}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="🔄"
            label="Change Recording Folder"
            onPress={handleSelectFolder}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="🔍"
            label="Scan Recordings"
            value={
              scanStatus === 'scanning'
                ? 'Scanning...'
                : recordings.length > 0
                ? `${recordings.length} found`
                : 'Tap to scan'
            }
            onPress={handleScanRecordings}
            isLast={true}
          />
        </Card>

        {/* ── BACKGROUND & AUTOMATION (Phase 12) ── */}
        <SectionHeader title="BACKGROUND & AUTOMATION" />
        <Card variant="elevated" padding={0} style={styles.settingsGroup}>
          <SettingRow
            icon="🤖"
            label="Background Monitoring"
            type="toggle"
            toggleValue={bgSettings.enabled}
            onToggle={val =>
              BackgroundProcessingService.updateSettings({enabled: val})
            }
            isFirst={true}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="🔔"
            label="Persistent Notification"
            type="toggle"
            toggleValue={bgSettings.foregroundServiceEnabled}
            onToggle={val =>
              BackgroundProcessingService.updateSettings({
                foregroundServiceEnabled: val,
              })
            }
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="⏱️"
            label="Scan Frequency"
            value={`Every ${bgSettings.intervalMinutes} min`}
            type="navigate"
            onPress={handleSelectInterval}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="⚙️"
            label="Auto-Process Pipeline"
            type="toggle"
            toggleValue={bgSettings.autoProcess}
            onToggle={val =>
              BackgroundProcessingService.updateSettings({autoProcess: val})
            }
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="☁️"
            label="Auto Google Drive Upload"
            type="toggle"
            toggleValue={bgSettings.autoUpload}
            onToggle={val =>
              BackgroundProcessingService.updateSettings({autoUpload: val})
            }
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="📝"
            label="Auto AI Transcription"
            type="toggle"
            toggleValue={bgSettings.autoTranscribe}
            onToggle={val =>
              BackgroundProcessingService.updateSettings({autoTranscribe: val})
            }
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="📶"
            label="Wi-Fi Only Sync"
            type="toggle"
            toggleValue={bgSettings.wifiOnly}
            onToggle={val =>
              BackgroundProcessingService.updateSettings({wifiOnly: val})
            }
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="🔋"
            label="Battery Optimization"
            badge={
              bgSettings.batteryOptimizationsIgnored
                ? 'Exempted ✓'
                : 'Tap to Exempt'
            }
            badgeColor={
              bgSettings.batteryOptimizationsIgnored
                ? Colors.successLight
                : Colors.warningLight
            }
            onPress={handleBatteryOptimization}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="🔄"
            label="Trigger Background Scan"
            value={
              isTriggeringSync || bgSettings.lastSyncStatus === 'running'
                ? 'Scanning...'
                : 'Run Now'
            }
            onPress={handleTriggerManualBackgroundSync}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="🕒"
            label="Last Background Check"
            value={formatLastSync(
              bgSettings.lastSyncTimestamp,
              bgSettings.lastSyncStatus,
              bgSettings.lastSyncResult,
            )}
            type="info"
            isLast={true}
          />
        </Card>

        {/* ── GOOGLE ── */}
        <SectionHeader title="GOOGLE" />
        <Card variant="elevated" padding={0} style={styles.settingsGroup}>
          <SettingRow
            icon="🗄️"
            label="Google Drive"
            badge={driveStatus === 'connected' ? 'Connected' : 'Not Connected'}
            badgeColor={
              driveStatus === 'connected'
                ? Colors.successLight
                : Colors.warningLight
            }
            onPress={handleDriveDetails}
            isFirst={true}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="📊"
            label="Google Sheets"
            badge={sheetsStatus === 'connected' ? 'Connected' : 'Not Connected'}
            badgeColor={
              sheetsStatus === 'connected'
                ? Colors.successLight
                : Colors.warningLight
            }
            onPress={handleSheetsDetails}
            isLast={true}
          />
        </Card>

        {/* ── TRANSCRIPTION ── */}
        <SectionHeader title="TRANSCRIPTION" />
        <Card variant="elevated" padding={0} style={styles.settingsGroup}>
          <SettingRow
            icon="🎙️"
            label="Speech-to-Text Provider"
            value={SUPPORTED_PROVIDERS[selectedProvider]?.name || 'Google Cloud STT'}
            badge={selectedProvider}
            badgeColor={Colors.primaryLight}
            onPress={handleSelectProvider}
            isFirst={true}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="🌐"
            label="Language Detection"
            type="toggle"
            toggleValue={langDetection}
            onToggle={setLangDetection}
            isLast={true}
          />
        </Card>

        {/* ── PRIVACY (Phase 14) ── */}
        <SectionHeader title="PRIVACY & SECURITY" />
        <Card variant="elevated" padding={0} style={styles.settingsGroup}>
          <SettingRow
            icon="🛡️"
            label="Privacy & Consent"
            value="Local-first architecture"
            onPress={() => setPrivacyModalVisible(true)}
            isFirst={true}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="🔒"
            label="Security & Privacy Audit"
            value="Hardware KeyStore & TLS"
            badge="Verified ✓"
            badgeColor={Colors.successLight}
            onPress={() => setSecurityModalVisible(true)}
            isLast={true}
          />
        </Card>

        {/* ── ABOUT ── */}
        <SectionHeader title="ABOUT" />
        <Card variant="elevated" padding={0} style={styles.settingsGroup}>
          <SettingRow
            icon="ℹ️"
            label="Version"
            value="1.0.0 (Phase 14 - Audited)"
            type="info"
            isFirst={true}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="📱"
            label="About TeleCaller AI"
            onPress={() => handleComingSoon('About')}
            isLast={true}
          />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>TeleCaller AI</Text>
          <Text style={styles.footerTagline}>
            Record • Transcribe • Organize
          </Text>
        </View>
      </ScrollView>

      {/* Phase 14: Privacy & Security Modals */}
      <PrivacyConsentModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
      />
      <SecurityAuditModal
        visible={securityModalVisible}
        onClose={() => setSecurityModalVisible(false)}
      />
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
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...(Shadow.sm as object),
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
  sectionHeader: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
    marginLeft: Spacing.sm,
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
    alignSelf: 'flex-start',
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  googleBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
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
    opacity: 0.8,
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
  settingIconText: {
    fontSize: 18,
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
  chevron: {
    fontSize: FontSize.xl,
    color: Colors.textTertiary,
    fontWeight: '300',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.xl,
  },
  footerText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: -0.5,
  },
  footerTagline: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginTop: 4,
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
