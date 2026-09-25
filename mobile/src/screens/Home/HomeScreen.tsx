// TeleCaller AI — Home Screen
// Premium dashboard with gradient hero, animated stat cards, and pipeline controls.

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
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import {CallRecord, DashboardStats} from '../../types';
import Avatar from '../../components/Avatar';
import StatusBadge from '../../components/StatusBadge';
import Card from '../../components/Card';
import BrandHeader from '../../components/BrandHeader';
import {useAuth} from '../../context/AuthContext';
import {useRecordings} from '../../context/RecordingContext';
import {RecordingScannerService} from '../../services/scanner/RecordingScannerService';
import {PipelineService} from '../../services/pipeline/PipelineService';
import {PipelineJob} from '../../types/pipeline';
import {BackgroundProcessingService} from '../../services/background/BackgroundProcessingService';
import {BackgroundSettings} from '../../types/background';
import {toast} from '../../components/Toast';
import {showAlert} from '../../components/AppModal';

const {width} = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.xl * 2 - Spacing.md) / 2;

// ─────────────────────────────────────────────────────────────
// Stat Card (Premium)
// ─────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  color: string;
  bgColor: string;
  iconName: string;
}

const getCardTag = (label: string): string => {
  switch (label.toLowerCase()) {
    case 'total calls':
      return 'All recordings';
    case 'today':
      return 'Activity today';
    case 'processed':
      return 'Uploaded & transcribed';
    case 'pending':
      return 'Awaiting action';
    default:
      return 'Live metrics';
  }
};

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  color,
  bgColor,
  iconName,
}) => {
  const numVal = typeof value === 'number' ? value : parseInt(value, 10) || 0;
  const fillPercent =
    numVal > 0 ? (numVal > 10 ? '90%' : `${Math.max(30, numVal * 10)}%`) : '18%';

  return (
    <View style={[styles.statCard, {borderColor: color + '35'}]}>
      {/* ── Top row: Icon on left + Count right next to it ── */}
      <View style={styles.statTopRow}>
        <View style={styles.statIconAndCount}>
          <View style={[styles.statIconBox, {backgroundColor: bgColor}]}>
            <Icon name={iconName} size={18} color={color} />
          </View>
          <Text style={[styles.statValue, {color}]}>{value}</Text>
        </View>

        {subtitle ? (
          <View style={styles.statTrendBadge}>
            <Text style={styles.statTrendText}>{subtitle}</Text>
          </View>
        ) : (
          <View style={[styles.statPulseDot, {backgroundColor: color + '25'}]}>
            <View style={[styles.statPulseDotInner, {backgroundColor: color}]} />
          </View>
        )}
      </View>

      {/* ── Below that: Label ── */}
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>

      {/* ── Creative bottom micro-accent (No unwanted empty space) ── */}
      <View style={styles.statBottomSection}>
        <Text style={styles.statTagText} numberOfLines={1}>
          {getCardTag(label)}
        </Text>
        <View style={[styles.statTrackBar, {backgroundColor: color + '18'}]}>
          <View
            style={[
              styles.statFillBar,
              {backgroundColor: color, width: fillPercent},
            ]}
          />
        </View>
      </View>
    </View>
  );
};

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
          <Icon
            name={isIncoming ? 'phone-incoming' : 'phone-outgoing'}
            size={14}
            color={isIncoming ? Colors.success : Colors.primary}
          />
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
    <View style={styles.scanIconContainer}>
      {scanning ? (
        <ActivityIndicator size="small" color={Colors.textInverse} />
      ) : (
        <Icon name={totalFound > 0 ? 'refresh' : 'magnify'} size={24} color={Colors.textInverse} />
      )}
    </View>
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
          ? 'Searching device storage for call audio files...'
          : totalFound > 0
          ? 'Tap to re-scan for new call audio files'
          : 'Tap to scan device storage for recordings'}
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

  // Auto-sync recordings on first launch
  useEffect(() => {
    let cancelled = false;
    const autoSync = async () => {
      try {
        await scanRecordings();
      } catch {
        // silently ignore auto-sync errors on launch
      }
    };
    autoSync();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show toast when scan finishes
  const prevScanStatus = React.useRef<string>(scanStatus);
  useEffect(() => {
    if (prevScanStatus.current === 'scanning' && scanStatus === 'idle') {
      if (recordings.length > 0) {
        toast.info(
          'Recordings Synced',
          `Found ${recordings.length} call recording${recordings.length !== 1 ? 's' : ''} on device`,
        );
      }
    }
    prevScanStatus.current = scanStatus;
  }, [scanStatus, recordings.length]);

  // Compute stats from real discovered recordings
  const stats: DashboardStats = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayCount = hasDiscoveredRecordings
      ? recordings.filter(
          r => new Date(r.timestamp).toDateString() === todayStr,
        ).length
      : 0;

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
      totalGrowthPercent: totalDiscovered > 0 ? 100 : 0,
      todayCalls: todayCount,
      processedCalls: completed,
      pendingCalls: pending,
      failedCalls: failed,
    };
  }, [hasDiscoveredRecordings, totalDiscovered, recordings, pipelineJobs]);

  const handleRunPipeline = async () => {
    if (recordings.length === 0) {
      toast.warning('No Recordings', 'Please scan for recordings first.');
      return;
    }
    setIsProcessingPipeline(true);
    setPipelineProgressText('Starting end-to-end processing pipeline...');
    try {
      await PipelineService.processAllPending(recordings, (done, total) => {
        setPipelineProgressText(`Processing calls: ${done}/${total} complete`);
      });
      toast.success(
        'Pipeline Complete',
        'All recordings processed through Drive, AI Transcription, and Sheets.',
      );
    } catch (e: any) {
      toast.error('Pipeline Error', e?.message || 'Error executing pipeline.');
    } finally {
      setIsProcessingPipeline(false);
      setPipelineProgressText('');
    }
  };

  // Display calls from real discovered recordings
  const recentCalls: CallRecord[] = useMemo(() => {
    if (hasDiscoveredRecordings) {
      return recordings
        .slice(0, 4)
        .map(r => RecordingScannerService.discoveredToCallRecord(r));
    }
    return [];
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
      toast.error(
        'Scan Failed',
        e?.message || 'Could not scan for call recordings.',
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
      <BrandHeader
        rightAction={
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel="Open profile settings"
            accessibilityRole="button">
            <Avatar name={displayName} photoUrl={displayPhotoUrl} size={36} />
          </TouchableOpacity>
        }
      />
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
        {/* ── Hero Header ── */}
        <LinearGradient
          colors={['#EFF6FF', '#F5F3FF', '#F7F9FC']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.heroGradient}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.userName} numberOfLines={1}>
                {displayName.split(' ')[0]}
              </Text>
              <Text style={styles.headerSubtitle}>
                Your calls. Transcribed. Organized.
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Summary Cards ── */}
        <Text style={styles.sectionTitle}>Today's Summary</Text>
        <View style={styles.statsGrid}>
          <StatCard
            label="Total Calls"
            value={stats.totalCalls}
            subtitle={stats.totalCalls > 0 ? `+${stats.totalGrowthPercent}%` : undefined}
            color={Colors.primary}
            bgColor={Colors.surfaceSecondary}
            iconName="phone-in-talk"
          />
          <StatCard
            label="Today"
            value={stats.todayCalls}
            color={Colors.secondary}
            bgColor={Colors.surfacePurple}
            iconName="calendar-today"
          />
          <StatCard
            label="Processed"
            value={stats.processedCalls}
            color={Colors.success}
            bgColor={Colors.successLight}
            iconName="check-circle-outline"
          />
          <StatCard
            label="Pending"
            value={stats.pendingCalls}
            color={Colors.warning}
            bgColor={Colors.warningLight}
            iconName="clock-outline"
          />
        </View>

        {/* ── Scan Button ── */}
        <ScanBanner
          scanning={isScanning}
          totalFound={totalDiscovered}
          onPress={handleScan}
        />

        {/* ── Background Monitor Status ── */}
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
              ? `Background Monitor: Active (${bgSettings.intervalMinutes}m${
                  bgSettings.batteryOptimizationsIgnored
                    ? ' • Doze Exempt'
                    : ''
                })`
              : 'Background Monitor: Paused'}
          </Text>
          <Icon name="chevron-right" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>

        {/* ── Pipeline Automation Card ── */}
        {hasDiscoveredRecordings && (
          <View style={styles.pipelineCard}>
            <View style={styles.pipelineHeader}>
              <View style={styles.pipelineTitleRow}>
                <Icon name="lightning-bolt" size={18} color={Colors.primary} />
                <Text style={styles.pipelineTitle}>Auto-Pipeline</Text>
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
                  <Icon name="check" size={12} color={Colors.success} />
                  <Text style={styles.pipelineCompletedText}>All Synced</Text>
                </View>
              )}
            </View>

            <Text style={styles.pipelineDesc}>
              {isProcessingPipeline
                ? pipelineProgressText
                : 'Call Match → Drive Backup → AI Transcription → Sheets CRM Sync'}
            </Text>

            {!isProcessingPipeline && stats.pendingCalls > 0 && (
              <TouchableOpacity
                style={styles.runPipelineBtn}
                onPress={handleRunPipeline}
                activeOpacity={0.8}
                accessibilityLabel="Process all pending calls"
                accessibilityRole="button">
                <Icon name="lightning-bolt" size={16} color={Colors.textInverse} />
                <Text style={styles.runPipelineBtnText}>
                  Process All ({stats.pendingCalls})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Recent Calls ── */}
        {recentCalls.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Calls</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Calls')}
                accessibilityLabel="View all calls"
                accessibilityRole="button">
                <Text style={styles.seeAll}>See All</Text>
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
          </>
        )}

        {/* ── Empty State ── */}
        {!hasDiscoveredRecordings && !isScanning && (
          <View style={styles.emptyState}>
            <Icon name="phone-missed" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyStateTitle}>No Recordings Yet</Text>
            <Text style={styles.emptyStateDesc}>
              Tap the scan button above to discover call recordings on your device.
            </Text>
          </View>
        )}

        {/* ── Failed calls alert ── */}
        {stats.failedCalls > 0 && (
          <View style={styles.failedAlert}>
            <Icon name="alert-circle" size={16} color={Colors.error} />
            <Text style={styles.failedAlertText}>
              {stats.failedCalls} recordings failed to process.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Calls')}
              accessibilityRole="button">
              <Text style={styles.failedAlertAction}>View</Text>
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
    paddingBottom: Spacing['4xl'],
  },

  // Hero gradient header
  heroGradient: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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

  // Status notices
  discoveredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  discoveredNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
  },
  emptyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '600',
  },

  // Section titles
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
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
    paddingHorizontal: Spacing.xl,
  },
  statCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    ...(Shadow.sm as object),
  },
  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  statIconAndCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statTrendBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statTrendText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  statPulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statPulseDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  statBottomSection: {
    marginTop: 2,
  },
  statTagText: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '500',
    marginBottom: 4,
  },
  statTrackBar: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  statFillBar: {
    height: '100%',
    borderRadius: 2,
  },

  // Scan button
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
    ...(Shadow.lg as object),
  },
  scanButtonActive: {
    backgroundColor: Colors.primaryDark,
  },
  scanIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanContent: {
    flex: 1,
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
    marginHorizontal: Spacing.xl,
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

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
  },
  emptyStateTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  emptyStateDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Failed alert
  failedAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error + '30',
    marginHorizontal: Spacing.xl,
  },
  failedAlertText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '500',
  },
  failedAlertAction: {
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '700',
  },

  // Pipeline Card
  pipelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
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
  pipelineTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pipelineActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight + '40',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    ...(Shadow.sm as object),
  },
  runPipelineBtnText: {
    color: Colors.textInverse,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  // Background Status Pill
  bgStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.xl,
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
});

export default HomeScreen;
