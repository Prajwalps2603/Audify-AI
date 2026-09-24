import React, {useState, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import {MOCK_CALLS, MOCK_STATS} from '../../mock/mockData';
import {CallRecord, DashboardStats} from '../../types';
import Avatar from '../../components/Avatar';
import StatusBadge from '../../components/StatusBadge';
import Card from '../../components/Card';
import {useAuth} from '../../context/AuthContext';
import {useRecordings} from '../../context/RecordingContext';
import {RecordingScannerService} from '../../services/scanner/RecordingScannerService';
import {PipelineService} from '../../services/pipeline/PipelineService';
import {PipelineJob} from '../../types/pipeline';
import {BackgroundProcessingService} from '../../services/background/BackgroundProcessingService';
import {BackgroundSettings} from '../../types/background';

const {width} = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.xl * 2 - Spacing.md) / 2;

// ─────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  color: string;
  bgColor: string;
  icon: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  color,
  bgColor,
  icon,
}) => (
  <View style={[styles.statCard, {backgroundColor: Colors.surface}]}>
    <View style={[styles.statIconBox, {backgroundColor: bgColor}]}>
      <Text style={styles.statIcon}>{icon}</Text>
    </View>
    <Text style={[styles.statValue, {color}]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {subtitle ? (
      <Text style={[styles.statSubtitle, {color: Colors.success}]}>
        {subtitle}
      </Text>
    ) : null}
  </View>
);

// ─────────────────────────────────────────────────────────────
// Recent Call Row
// ─────────────────────────────────────────────────────────────
interface RecentCallRowProps {
  call: CallRecord;
  onPress: () => void;
}

const RecentCallRow: React.FC<RecentCallRowProps> = ({call, onPress}) => {
  const isIncoming = call.callType === 'Incoming';
  return (
    <TouchableOpacity
      style={styles.recentRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Call from ${call.name}`}
      accessibilityRole="button">
      <Avatar name={call.name} size={46} />
      <View style={styles.recentInfo}>
        <Text style={styles.recentName} numberOfLines={1}>
          {call.name}
        </Text>
        <Text style={styles.recentPhone} numberOfLines={1}>
          {call.phoneNumber}
        </Text>
      </View>
      <View style={styles.recentRight}>
        <Text style={styles.recentTime}>{call.time}</Text>
        <View style={styles.recentMeta}>
          <Text
            style={[
              styles.callTypeArrow,
              {color: isIncoming ? Colors.success : Colors.primary},
            ]}>
            {isIncoming ? '↙' : '↗'}
          </Text>
          <Text style={styles.recentDuration}>{call.duration}</Text>
        </View>
        <StatusBadge status={call.status} size="sm" />
      </View>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────
// Scan Progress Banner
// ─────────────────────────────────────────────────────────────
interface ScanBannerProps {
  scanning: boolean;
  totalFound: number;
  onPress: () => void;
}

const ScanBanner: React.FC<ScanBannerProps> = ({
  scanning,
  totalFound,
  onPress,
}) => (
  <TouchableOpacity
    style={[styles.scanButton, scanning && styles.scanButtonActive]}
    onPress={onPress}
    disabled={scanning}
    activeOpacity={0.85}
    accessibilityLabel={scanning ? 'Scanning...' : 'Scan for new recordings'}
    accessibilityRole="button">
    <Text style={styles.scanIcon}>{scanning ? '⟳' : '🔍'}</Text>
    <View style={styles.scanContent}>
      <Text style={styles.scanTitle}>
        {scanning
          ? 'Scanning for recordings...'
          : totalFound > 0
          ? `Discovered ${totalFound} Recordings`
          : 'Scan Device for Recordings'}
      </Text>
      <Text style={styles.scanSubtitle}>
        {scanning
          ? 'Searching MediaStore & OEM recording folders...'
          : totalFound > 0
          ? 'Tap to re-scan for new call audio files'
          : 'Tap to scan MediaStore & known system folders'}
      </Text>
    </View>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────
// Home Screen
// ─────────────────────────────────────────────────────────────
const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);

  const {authState} = useAuth();
  const {
    recordings,
    status: scanStatus,
    scanRecordings,
  } = useRecordings();

  const isScanning = scanStatus === 'scanning';
  const totalDiscovered = recordings.length;
  const hasDiscoveredRecordings = totalDiscovered > 0;

  // Real auth user
  const realUser =
    authState.status === 'SIGNED_IN' ? authState.session.user : null;
  const displayName = realUser?.name ?? realUser?.givenName ?? 'User';
  const displayPhotoUrl = realUser?.photo ?? undefined;

  const [pipelineJobs, setPipelineJobs] = useState<
    Record<string, PipelineJob>
  >({});
  const [isProcessingPipeline, setIsProcessingPipeline] = useState(false);
  const [pipelineProgressText, setPipelineProgressText] = useState('');
  const [bgSettings, setBgSettings] = useState<BackgroundSettings>(
    BackgroundProcessingService.getSettings(),
  );

  useEffect(() => {
    const unsubPipeline = PipelineService.subscribe(jobs => {
      setPipelineJobs(jobs);
    });
    const unsubBg = BackgroundProcessingService.subscribe(setBgSettings);
    return () => {
      unsubPipeline();
      unsubBg();
    };
  }, []);

  // Real stats if recordings are discovered, otherwise mock stats
  const stats = useMemo(() => {
    if (hasDiscoveredRecordings) {
      const todayStr = new Date().toDateString();
      const todayCount = recordings.filter(
        r => new Date(r.timestamp).toDateString() === todayStr,
      ).length;

      let completed = 0;
      let failed = 0;
      let inProgress = 0;

      recordings.forEach(rec => {
        const job = pipelineJobs[rec.id];
        if (job) {
          if (job.stage === 'COMPLETED') completed++;
          else if (job.stage === 'FAILED') failed++;
          else inProgress++;
        }
      });

      const pending = Math.max(
        0,
        totalDiscovered - completed - inProgress - failed,
      );

      return {
        totalCalls: totalDiscovered,
        totalGrowthPercent: 100,
        todayCalls: todayCount,
        processedCalls: completed,
        pendingCalls: pending,
        failedCalls: failed,
      };
    }
    return MOCK_STATS;
  }, [hasDiscoveredRecordings, totalDiscovered, recordings, pipelineJobs]);

  const handleRunPipeline = async () => {
    if (recordings.length === 0) {
      Alert.alert('Pipeline', 'Please scan for recordings first.');
      return;
    }
    setIsProcessingPipeline(true);
    setPipelineProgressText('Starting end-to-end processing pipeline...');
    try {
      await PipelineService.processAllPending(recordings, (done, total) => {
        setPipelineProgressText(`Processing calls: ${done}/${total} complete`);
      });
      Alert.alert(
        'Pipeline Complete',
        'Successfully processed pending recordings through Google Drive, AI Transcription, and Google Sheets!',
        [{text: 'OK'}],
      );
    } catch (e: any) {
      Alert.alert('Pipeline Error', e?.message || 'Error executing pipeline.');
    } finally {
      setIsProcessingPipeline(false);
      setPipelineProgressText('');
    }
  };

  // Display calls: real discovered recordings if available, otherwise mock
  const recentCalls: CallRecord[] = useMemo(() => {
    if (hasDiscoveredRecordings) {
      return recordings
        .slice(0, 4)
        .map(r => RecordingScannerService.discoveredToCallRecord(r));
    }
    return MOCK_CALLS.slice(0, 4);
  }, [hasDiscoveredRecordings, recordings]);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await scanRecordings();
    } catch {
      // Ignored in pull-to-refresh
    }
    setRefreshing(false);
  };

  const handleScan = async () => {
    try {
      await scanRecordings();
    } catch (e: any) {
      Alert.alert(
        'Recording Scanner',
        e?.message || 'Could not scan for call recordings.',
        [{text: 'OK'}],
      );
    }
  };

  const handleCallPress = (callId: string) => {
    navigation.navigate('Calls', {
      screen: 'CallDetails',
      params: {callId},
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }>
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName.split(' ')[0]} 👋
            </Text>
            <Text style={styles.headerSubtitle}>
              Your calls. Transcribed. Organized.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel="Open profile settings"
            accessibilityRole="button">
            <Avatar name={displayName} photoUrl={displayPhotoUrl} size={50} />
          </TouchableOpacity>
        </View>

        {/* ── Discovery / Phase Status Notice ── */}
        {hasDiscoveredRecordings ? (
          <View style={styles.discoveredNotice}>
            <Text style={styles.discoveredNoticeText}>
              ✓ Found {totalDiscovered} call recording{totalDiscovered > 1 ? 's' : ''} on device (Phase 3 Scanner)
            </Text>
          </View>
        ) : (
          <View style={styles.mockNotice}>
            <Text style={styles.mockNoticeText}>
              ⚡ Phase 3: Tap "Scan Device" to discover call recordings
            </Text>
          </View>
        )}

        {/* ── Summary Cards ── */}
        <Text style={styles.sectionTitle}>Today's Summary</Text>
        <View style={styles.statsGrid}>
          <StatCard
            label="Total Calls"
            value={stats.totalCalls}
            subtitle={`+${stats.totalGrowthPercent}%`}
            color={Colors.primary}
            bgColor={Colors.surfaceSecondary}
            icon="📞"
          />
          <StatCard
            label="Today"
            value={stats.todayCalls}
            color={Colors.secondary}
            bgColor={Colors.surfacePurple}
            icon="📅"
          />
          <StatCard
            label="Processed"
            value={stats.processedCalls}
            color={Colors.success}
            bgColor={Colors.successLight}
            icon="✅"
          />
          <StatCard
            label="Pending"
            value={stats.pendingCalls}
            color={Colors.warning}
            bgColor={Colors.warningLight}
            icon="⏳"
          />
        </View>

        {/* ── Scan Button ── */}
        <ScanBanner
          scanning={isScanning}
          totalFound={totalDiscovered}
          onPress={handleScan}
        />

        {/* ── Background Processing Status Pill (Phase 12) ── */}
        <TouchableOpacity
          style={styles.bgStatusPill}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.8}
          accessibilityLabel="Background monitoring status"
          accessibilityRole="button">
          <View
            style={[
              styles.bgStatusDot,
              bgSettings.enabled
                ? styles.bgStatusDotActive
                : styles.bgStatusDotPaused,
            ]}
          />
          <Text style={styles.bgStatusText}>
            {bgSettings.enabled
              ? `Background Monitor: Active (${bgSettings.intervalMinutes}m • ${
                  bgSettings.lastSyncStatus === 'running'
                    ? 'Syncing now...'
                    : bgSettings.batteryOptimizationsIgnored
                    ? 'Doze Exempt ✓'
                    : 'Doze Mode'
                })`
              : 'Background Monitor: Paused (Tap to configure)'}
          </Text>
          <Text style={styles.bgStatusArrow}>›</Text>
        </TouchableOpacity>

        {/* ── Pipeline Action Banner (Phase 11) ── */}
        {hasDiscoveredRecordings && (
          <View style={styles.pipelineCard}>
            <View style={styles.pipelineHeader}>
              <View style={styles.pipelineTitleRow}>
                <Text style={styles.pipelineIcon}>⚡</Text>
                <Text style={styles.pipelineTitle}>Auto-Pipeline Automation</Text>
              </View>
              {isProcessingPipeline ? (
                <View style={styles.pipelineActiveBadge}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.pipelineActiveText}>Running...</Text>
                </View>
              ) : stats.pendingCalls > 0 ? (
                <View style={styles.pipelinePendingBadge}>
                  <Text style={styles.pipelinePendingText}>
                    {stats.pendingCalls} Pending
                  </Text>
                </View>
              ) : (
                <View style={styles.pipelineCompletedBadge}>
                  <Text style={styles.pipelineCompletedText}>✓ All Synced</Text>
                </View>
              )}
            </View>

            <Text style={styles.pipelineDesc}>
              {isProcessingPipeline
                ? pipelineProgressText
                : 'Automated 4-stage pipeline: Device Call Match → Google Drive Backup → Multi-Provider Speech Diarization → Google Sheets Row Insertion.'}
            </Text>

            {!isProcessingPipeline && stats.pendingCalls > 0 && (
              <TouchableOpacity
                style={styles.runPipelineBtn}
                onPress={handleRunPipeline}
                activeOpacity={0.8}
                accessibilityLabel="Process all pending calls"
                accessibilityRole="button">
                <Text style={styles.runPipelineBtnText}>
                  ⚡ Process All Pending Calls ({stats.pendingCalls})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Recent Calls ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Calls</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Calls')}
            accessibilityLabel="View all calls"
            accessibilityRole="button">
            <Text style={styles.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>

        <Card variant="elevated" padding={0} style={styles.recentCard}>
          {recentCalls.map((call, index) => (
            <View key={call.id}>
              <RecentCallRow
                call={call}
                onPress={() => handleCallPress(call.id)}
              />
              {index < recentCalls.length - 1 && (
                <View style={styles.divider} />
              )}
            </View>
          ))}
        </Card>

        {/* ── Failed calls alert ── */}
        {stats.failedCalls > 0 && (
          <View style={styles.failedAlert}>
            <Text style={styles.failedAlertText}>
              ⚠️ {stats.failedCalls} recordings failed to process.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Calls')}
              accessibilityRole="button">
              <Text style={styles.failedAlertAction}>View →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing['4xl'],
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  userName: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // Mock notice
  mockNotice: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  mockNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Discovered notice
  discoveredNotice: {
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  discoveredNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
    textAlign: 'center',
  },
  scanContent: {
    flex: 1,
  },

  // Section titles
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  seeAll: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: CARD_WIDTH,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    ...(Shadow.md as object),
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  statIcon: {
    fontSize: 18,
  },
  statValue: {
    fontSize: FontSize['3xl'],
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  statSubtitle: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },

  // Scan button
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
    ...(Shadow.lg as object),
  },
  scanButtonActive: {
    backgroundColor: Colors.primaryDark,
  },
  scanIcon: {
    fontSize: 28,
  },
  scanTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  scanSubtitle: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  // Recent calls
  recentCard: {
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  recentInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  recentName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  recentPhone: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  recentRight: {
    alignItems: 'flex-end',
    minWidth: 90,
  },
  recentTime: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  recentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  callTypeArrow: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  recentDuration: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.base + 46 + Spacing.md,
  },

  // Failed alert
  failedAlert: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  failedAlertText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '500',
  },
  failedAlertAction: {
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '700',
  },

  // Pipeline Card Styles (Phase 11)
  pipelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...(Shadow.sm as object),
  },
  pipelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  pipelineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pipelineIcon: {
    fontSize: 16,
  },
  pipelineTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pipelineActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  pipelineActiveText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
  pipelinePendingBadge: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  pipelinePendingText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: '700',
  },
  pipelineCompletedBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  pipelineCompletedText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '700',
  },
  pipelineDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  runPipelineBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
    ...(Shadow.sm as object),
  },
  runPipelineBtnText: {
    color: Colors.textInverse,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  // Background Status Pill (Phase 12)
  bgStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    ...(Shadow.sm as object),
  },
  bgStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  bgStatusDotActive: {
    backgroundColor: Colors.success,
  },
  bgStatusDotPaused: {
    backgroundColor: Colors.warning,
  },
  bgStatusText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  bgStatusArrow: {
    fontSize: FontSize.base,
    color: Colors.textTertiary,
    marginLeft: Spacing.xs,
  },
});

export default HomeScreen;
