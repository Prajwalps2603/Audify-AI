// TeleCaller AI — Calls Screen
// Comprehensive call list with multi-dimensional filtering, search, and recording discovery.

import React, {useState, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ListRenderItem,
  RefreshControl,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import {
  CallRecord,
  DateFilter,
  CallTypeFilter,
  DurationFilter,
  StatusFilter,
} from '../../types';
import Avatar from '../../components/Avatar';
import StatusBadge from '../../components/StatusBadge';
import BrandHeader from '../../components/BrandHeader';
import {useRecordings} from '../../context/RecordingContext';
import {RecordingScannerService} from '../../services/scanner/RecordingScannerService';
import {PipelineService} from '../../services/pipeline/PipelineService';
import {PipelineJob} from '../../types/pipeline';
import {toast} from '../../components/Toast';
import {showAlert} from '../../components/AppModal';

// ─────────────────────────────────────────────────────────────
// Filter chips
// ─────────────────────────────────────────────────────────────
const DATE_FILTERS: DateFilter[] = [
  'All',
  'Today',
  'Yesterday',
  'This Week',
  'This Month',
];
const TYPE_FILTERS: CallTypeFilter[] = ['All', 'Incoming', 'Outgoing', 'Missed'];
const DURATION_FILTERS: DurationFilter[] = [
  'All',
  '< 1 min',
  '1-5 min',
  '> 5 min',
];
const STATUS_FILTERS: StatusFilter[] = [
  'All',
  'Completed',
  'Pending',
  'Failed',
];

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  iconName?: string;
}

const FilterChip: React.FC<FilterChipProps> = ({
  label,
  isActive,
  onPress,
  iconName,
}) => (
  <TouchableOpacity
    style={[styles.chip, isActive && styles.chipActive]}
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityLabel={`Filter by ${label}`}
    accessibilityRole="button">
    {iconName && (
      <Icon
        name={iconName}
        size={14}
        color={isActive ? Colors.textInverse : Colors.textSecondary}
        style={styles.chipIcon}
      />
    )}
    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────
// Call Card
// ─────────────────────────────────────────────────────────────
interface CallCardProps {
  call: CallRecord;
  pipelineJob?: PipelineJob;
  matchingSnippet?: string | null;
  onPress: () => void;
}

const CallCard: React.FC<CallCardProps> = ({
  call,
  pipelineJob,
  matchingSnippet,
  onPress,
}) => {
  const isIncoming = call.callType === 'Incoming';
  const isMissed = call.callType === 'Missed';

  const typeIconName = isMissed
    ? 'phone-missed'
    : isIncoming
    ? 'phone-incoming'
    : 'phone-outgoing';

  const typeColor = isMissed
    ? Colors.error
    : isIncoming
    ? Colors.success
    : Colors.primary;

  return (
    <TouchableOpacity
      style={styles.callCard}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${call.callType} call from ${call.name}, ${call.date} at ${call.time}, duration ${call.duration}`}
      accessibilityRole="button">
      <View style={styles.callCardMainRow}>
        {/* Avatar */}
        <View style={styles.callCardLeft}>
          <Avatar name={call.name} size={50} />
          {/* Call type indicator dot */}
          <View style={[styles.callTypeDot, {backgroundColor: typeColor}]} />
        </View>

        {/* Info */}
        <View style={styles.callCardInfo}>
          <Text style={styles.callName} numberOfLines={1}>
            {call.name}
          </Text>
          <Text style={styles.callPhone} numberOfLines={1}>
            {call.phoneNumber}
          </Text>
          <Text style={styles.callDate}>
            {formatDate(call.date)} • {call.time}
          </Text>
        </View>

        {/* Right side */}
        <View style={styles.callCardRight}>
          <View style={styles.callTypeRow}>
            <Icon name={typeIconName} size={15} color={typeColor} />
            <Text style={styles.callDuration}>{call.duration}</Text>
          </View>
          {/* Call Log Badge & Active Pipeline Indicator */}
          {pipelineJob &&
          pipelineJob.stage !== 'QUEUED' &&
          pipelineJob.stage !== 'COMPLETED' ? (
            <View style={styles.pipelineBadge}>
              <Icon
                name={
                  pipelineJob.stage === 'DRIVE'
                    ? 'cloud-upload-outline'
                    : pipelineJob.stage === 'TRANSCRIPTION'
                    ? 'waveform'
                    : pipelineJob.stage === 'SHEETS'
                    ? 'table'
                    : 'lightning-bolt'
                }
                size={12}
                color={Colors.primary}
              />
              <Text style={styles.pipelineBadgeText}>
                {pipelineJob.stage === 'DRIVE'
                  ? `${pipelineJob.progressPercent}%`
                  : pipelineJob.stage === 'TRANSCRIPTION'
                  ? 'Diarizing'
                  : pipelineJob.stage === 'SHEETS'
                  ? 'Logging'
                  : 'Matching'}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.callLogBadge,
                {
                  backgroundColor: isIncoming
                    ? '#DCFCE7'
                    : isMissed
                    ? '#FEE2E2'
                    : '#EFF6FF',
                  borderColor: isIncoming
                    ? '#86EFAC'
                    : isMissed
                    ? '#FECACA'
                    : '#BFDBFE',
                },
              ]}>
              <Icon
                name={typeIconName}
                size={11}
                color={typeColor}
              />
              <Text
                style={[
                  styles.callLogBadgeText,
                  {
                    color: isIncoming
                      ? '#166534'
                      : isMissed
                      ? '#991B1B'
                      : '#1E40AF',
                  },
                ]}>
                {call.callType} Call Log
              </Text>
            </View>
          )}

          {call.language ? (
            <Text style={styles.callLanguage}>{call.language}</Text>
          ) : null}
        </View>
      </View>

      {/* Matched Transcript Snippet */}
      {matchingSnippet ? (
        <View style={styles.snippetContainer}>
          <Icon
            name="comment-text-outline"
            size={14}
            color={Colors.textTertiary}
            style={styles.snippetIcon}
          />
          <Text style={styles.snippetText} numberOfLines={2}>
            {matchingSnippet}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

function matchesDateFilter(dateStr: string, filter: DateFilter): boolean {
  if (filter === 'All') return true;
  try {
    const callDate = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const itemDay = new Date(
      callDate.getFullYear(),
      callDate.getMonth(),
      callDate.getDate(),
    );

    if (filter === 'Today') {
      return itemDay.getTime() === today.getTime();
    }
    if (filter === 'Yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return itemDay.getTime() === yesterday.getTime();
    }
    if (filter === 'This Week') {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return itemDay.getTime() >= sevenDaysAgo.getTime();
    }
    if (filter === 'This Month') {
      return (
        callDate.getMonth() === now.getMonth() &&
        callDate.getFullYear() === now.getFullYear()
      );
    }
    return true;
  } catch {
    return true;
  }
}

function matchesDurationFilter(
  seconds: number,
  filter: DurationFilter,
): boolean {
  if (filter === 'All') return true;
  if (filter === '< 1 min') return seconds < 60;
  if (filter === '1-5 min') return seconds >= 60 && seconds <= 300;
  if (filter === '> 5 min') return seconds > 300;
  return true;
}

function matchesStatusFilter(
  status: string,
  pipelineStage: string | undefined,
  filter: StatusFilter,
): boolean {
  if (filter === 'All') return true;
  const effective = pipelineStage === 'COMPLETED' ? 'COMPLETED' : status;
  if (filter === 'Completed') return effective === 'COMPLETED';
  if (filter === 'Pending') {
    return (
      effective === 'PENDING' ||
      effective === 'PROCESSING' ||
      effective === 'DISCOVERED'
    );
  }
  if (filter === 'Failed') return effective === 'FAILED';
  return true;
}

function extractMatchingSnippet(call: CallRecord, query: string): string | null {
  if (!query || query.length < 2) return null;
  const q = query.toLowerCase();

  if (call.transcriptPreview) {
    const previewLower = call.transcriptPreview.toLowerCase();
    const idx = previewLower.indexOf(q);
    if (idx >= 0) {
      const start = Math.max(0, idx - 25);
      const end = Math.min(
        call.transcriptPreview.length,
        idx + query.length + 30,
      );
      const prefix = start > 0 ? '...' : '';
      const suffix = end < call.transcriptPreview.length ? '...' : '';
      return `${prefix}${call.transcriptPreview.substring(start, end).trim()}${suffix}`;
    }
  }

  if (call.transcript && Array.isArray(call.transcript)) {
    for (const seg of call.transcript) {
      const textLower = seg.text.toLowerCase();
      const idx = textLower.indexOf(q);
      if (idx >= 0) {
        const start = Math.max(0, idx - 20);
        const end = Math.min(seg.text.length, idx + query.length + 25);
        const prefix = start > 0 ? '...' : '';
        const suffix = end < seg.text.length ? '...' : '';
        return `${seg.speakerLabel}: "${prefix}${seg.text.substring(start, end).trim()}${suffix}"`;
      }
    }
  }

  return null;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────
interface EmptyStateProps {
  query: string;
  isScanning: boolean;
  selectedFolderName?: string;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  onScan: () => void;
  onSelectFolder: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  query,
  isScanning,
  selectedFolderName,
  hasActiveFilters,
  onResetFilters,
  onScan,
  onSelectFolder,
}) => {
  if (hasActiveFilters) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconCircle}>
          <Icon name="magnify" size={36} color={Colors.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>No Matching Calls</Text>
        <Text style={styles.emptySubtitle}>
          {query
            ? `No recordings or transcripts match "${query}".`
            : 'No call recordings match your selected filter criteria.'}
        </Text>
        <View style={styles.emptyActions}>
          <TouchableOpacity
            style={styles.selectFolderBtn}
            onPress={onResetFilters}
            activeOpacity={0.8}
            accessibilityLabel="Clear all filters"
            accessibilityRole="button">
            <Icon name="filter-remove-outline" size={18} color={Colors.textInverse} style={styles.btnIcon} />
            <Text style={styles.selectFolderBtnText}>Clear All Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Icon name="folder-music-outline" size={40} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>
        {query ? 'No Calls Found' : 'No Call Recordings'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {query
          ? `No calls match "${query}"`
          : selectedFolderName
          ? `No audio recordings found in "${selectedFolderName}". Select another folder or scan again.`
          : 'Automatic discovery searched Android media folders but found no recordings.'}
      </Text>
      {!query && (
        <View style={styles.emptyActions}>
          <TouchableOpacity
            style={styles.selectFolderBtn}
            onPress={onSelectFolder}
            activeOpacity={0.8}
            accessibilityLabel="Select Recording Folder"
            accessibilityRole="button">
            <Icon name="folder-search-outline" size={18} color={Colors.textInverse} style={styles.btnIcon} />
            <Text style={styles.selectFolderBtnText}>
              {selectedFolderName
                ? 'Change Recording Folder'
                : 'Select Recording Folder'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rescanBtn, isScanning && styles.rescanBtnDisabled]}
            onPress={onScan}
            disabled={isScanning}
            activeOpacity={0.8}
            accessibilityLabel="Scan device for recordings"
            accessibilityRole="button">
            <Icon
              name="refresh"
              size={18}
              color={Colors.primary}
              style={[styles.btnIcon, isScanning && styles.rotatingIcon]}
            />
            <Text style={styles.rescanBtnText}>
              {isScanning ? 'Scanning...' : 'Scan Again'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Calls Screen
// ─────────────────────────────────────────────────────────────
const CallsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('All');
  const [typeFilter, setTypeFilter] = useState<CallTypeFilter>('All');
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [matchedOnlyFilter, setMatchedOnlyFilter] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [pipelineJobs, setPipelineJobs] = useState<
    Record<string, PipelineJob>
  >({});

  useEffect(() => {
    const unsub = PipelineService.subscribe(setPipelineJobs);
    return unsub;
  }, []);

  const {
    recordings,
    status: scanStatus,
    scanRecordings,
    selectFolder,
    selectedFolder,
  } = useRecordings();

  const isScanning = scanStatus === 'scanning';
  const hasDiscoveredRecordings = recordings.length > 0;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await scanRecordings();
      toast.info('Refreshed', 'Call records loaded.');
    } catch {
      // Ignored in pull-to-refresh
    } finally {
      setIsRefreshing(false);
    }
  };

  // Real discovered recordings in CallRecord format
  const allCalls: CallRecord[] = useMemo(() => {
    if (hasDiscoveredRecordings) {
      return recordings.map(r =>
        RecordingScannerService.discoveredToCallRecord(r),
      );
    }
    return [];
  }, [hasDiscoveredRecordings, recordings]);

  // Active filter count
  const activeFilterCount =
    (dateFilter !== 'All' ? 1 : 0) +
    (typeFilter !== 'All' ? 1 : 0) +
    (durationFilter !== 'All' ? 1 : 0) +
    (statusFilter !== 'All' ? 1 : 0) +
    (matchedOnlyFilter ? 1 : 0) +
    (searchQuery.trim().length > 0 ? 1 : 0);

  const handleResetFilters = () => {
    setSearchQuery('');
    setDateFilter('All');
    setTypeFilter('All');
    setDurationFilter('All');
    setStatusFilter('All');
    setMatchedOnlyFilter(false);
  };

  // Full-Text Search and Multi-Dimensional Filter Engine
  const filteredCalls = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const searchMapped = allCalls.map(c => {
      let matchesSearch = true;
      let snippet: string | null = null;

      if (q) {
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phoneNumber.toLowerCase().includes(q);
        const matchesFile = c.recordingFileName?.toLowerCase().includes(q);
        snippet = extractMatchingSnippet(c, q);
        matchesSearch =
          matchesName ||
          matchesPhone ||
          Boolean(matchesFile) ||
          Boolean(snippet);
      }

      return {
        ...c,
        _matchingSnippet: snippet,
        _matchesSearch: matchesSearch,
      };
    });

    let results = searchMapped.filter(item => item._matchesSearch);

    if (dateFilter !== 'All') {
      results = results.filter(c => matchesDateFilter(c.date, dateFilter));
    }

    if (typeFilter !== 'All') {
      results = results.filter(c => c.callType === typeFilter);
    }

    if (durationFilter !== 'All') {
      results = results.filter(c =>
        matchesDurationFilter(c.durationSeconds, durationFilter),
      );
    }

    if (statusFilter !== 'All') {
      results = results.filter(c => {
        const job = pipelineJobs[c.id];
        return matchesStatusFilter(c.status, job?.stage, statusFilter);
      });
    }

    if (matchedOnlyFilter) {
      results = results.filter(c => Boolean(c.matchedWithCallLog));
    }

    return results;
  }, [
    allCalls,
    searchQuery,
    dateFilter,
    typeFilter,
    durationFilter,
    statusFilter,
    matchedOnlyFilter,
    pipelineJobs,
  ]);

  const handleScan = async () => {
    try {
      await scanRecordings();
      toast.success('Scanner', 'Scan completed successfully');
    } catch (e: any) {
      showAlert({
        title: 'Recording Scanner',
        message: e?.message || 'Could not scan for recordings.',
        variant: 'error',
        buttons: [{text: 'OK'}],
      });
    }
  };

  const handleSelectFolder = async () => {
    try {
      const folder = await selectFolder();
      showAlert({
        title: 'Folder Configured',
        message: `Access granted and saved for "${folder.name}". Scanning for call recordings...`,
        variant: 'success',
        buttons: [{text: 'OK'}],
      });
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('cancel')) return;
      showAlert({
        title: 'Folder Selection',
        message: e?.message || 'Could not access the selected folder.',
        variant: 'error',
        buttons: [{text: 'OK'}],
      });
    }
  };

  const handleCallPress = (callId: string) => {
    navigation.navigate('CallDetails', {callId});
  };

  const renderItem: ListRenderItem<
    CallRecord & {_matchingSnippet?: string | null}
  > = ({item}) => (
    <CallCard
      call={item}
      pipelineJob={pipelineJobs[item.id]}
      matchingSnippet={item._matchingSnippet}
      onPress={() => handleCallPress(item.id)}
    />
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {/* Selected SAF Folder Notice */}
      {selectedFolder && (
        <View style={styles.folderNotice}>
          <Icon
            name="folder-check-outline"
            size={16}
            color={Colors.primary}
            style={styles.noticeIcon}
          />
          <Text style={styles.folderNoticeText} numberOfLines={1}>
            {selectedFolder.name}
          </Text>
          <TouchableOpacity
            onPress={handleSelectFolder}
            accessibilityLabel="Change recording folder"
            accessibilityRole="button">
            <Text style={styles.folderChangeLink}>Change</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Control Header */}
      <View style={styles.filterHeaderRow}>
        <View style={styles.filterTitleRow}>
          <Text style={styles.filterHeading}>Filters</Text>
          {activeFilterCount > 0 && (
            <View style={styles.activeFilterBadge}>
              <Text style={styles.activeFilterBadgeText}>
                {activeFilterCount} active
              </Text>
            </View>
          )}
        </View>
        <View style={styles.filterControlsRow}>
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={styles.resetFilterBtn}
              onPress={handleResetFilters}
              activeOpacity={0.7}
              accessibilityLabel="Reset all filters"
              accessibilityRole="button">
              <Icon name="close" size={12} color={Colors.textSecondary} style={{marginRight: 2}} />
              <Text style={styles.resetFilterBtnText}>Reset</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.advancedFilterToggle,
              showAdvancedFilters && styles.advancedFilterToggleActive,
            ]}
            onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
            activeOpacity={0.7}
            accessibilityLabel="Toggle advanced filters"
            accessibilityRole="button">
            <Icon
              name={showAdvancedFilters ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={showAdvancedFilters ? Colors.primary : Colors.textSecondary}
              style={{marginRight: 3}}
            />
            <Text
              style={[
                styles.advancedFilterToggleText,
                showAdvancedFilters && styles.advancedFilterToggleTextActive,
              ]}>
              {showAdvancedFilters ? 'Fewer' : 'More Filters'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Filters (Horizontal Scroll) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}>
        {DATE_FILTERS.map(f => (
          <FilterChip
            key={f}
            label={f}
            isActive={dateFilter === f}
            onPress={() => setDateFilter(f)}
          />
        ))}
      </ScrollView>

      {/* Type Filters (Horizontal Scroll) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}>
        {TYPE_FILTERS.map(f => (
          <FilterChip
            key={f}
            label={f}
            isActive={typeFilter === f}
            onPress={() => setTypeFilter(f)}
          />
        ))}
      </ScrollView>

      {/* Expandable Advanced Filters */}
      {showAdvancedFilters && (
        <View style={styles.advancedFiltersBox}>
          {/* Duration Filters */}
          <Text style={styles.subFilterHeading}>CALL DURATION</Text>
          <View style={styles.subFilterRow}>
            {DURATION_FILTERS.map(df => (
              <FilterChip
                key={df}
                label={df}
                isActive={durationFilter === df}
                onPress={() => setDurationFilter(df)}
              />
            ))}
          </View>

          {/* Status Filters */}
          <Text style={styles.subFilterHeading}>PROCESSING STATUS</Text>
          <View style={styles.subFilterRow}>
            {STATUS_FILTERS.map(sf => (
              <FilterChip
                key={sf}
                label={sf}
                isActive={statusFilter === sf}
                onPress={() => setStatusFilter(sf)}
              />
            ))}
          </View>

          {/* Matched Only Toggle */}
          <Text style={styles.subFilterHeading}>VERIFICATION</Text>
          <View style={styles.subFilterRow}>
            <FilterChip
              label="Call Log Matched"
              iconName="check-decagram-outline"
              isActive={matchedOnlyFilter}
              onPress={() => setMatchedOnlyFilter(!matchedOnlyFilter)}
            />
          </View>
        </View>
      )}

      {/* Results Count & Summary */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {filteredCalls.length} of {allCalls.length} recording
          {allCalls.length !== 1 ? 's' : ''}
        </Text>
        {activeFilterCount > 0 && (
          <Text style={styles.filteredLabel}>Filtered Results</Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* ── Brand Header ── */}
      <BrandHeader
        rightAction={
          <TouchableOpacity
            style={[
              styles.headerScanBtn,
              isScanning && styles.headerScanBtnActive,
            ]}
            onPress={handleScan}
            disabled={isScanning}
            accessibilityLabel="Scan for recordings"
            accessibilityRole="button">
            <Icon
              name="refresh"
              size={15}
              color={Colors.primary}
              style={{marginRight: 4}}
            />
            <Text style={styles.headerScanBtnText}>
              {isScanning ? 'Scanning...' : 'Scan'}
            </Text>
          </TouchableOpacity>
        }
      />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Call Recordings</Text>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Icon
            name="magnify"
            size={20}
            color={Colors.textTertiary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, or transcript..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search calls"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              accessibilityLabel="Clear search"
              accessibilityRole="button">
              <Icon name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Call List ── */}
      <FlatList
        data={filteredCalls}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyState
            query={searchQuery}
            isScanning={isScanning}
            selectedFolderName={selectedFolder?.name}
            hasActiveFilters={activeFilterCount > 0}
            onResetFilters={handleResetFilters}
            onScan={handleScan}
            onSelectFolder={handleSelectFolder}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  headerScanBtnActive: {
    opacity: 0.6,
  },
  headerScanBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: FontSize.sm,
  },
  noticeIcon: {
    marginRight: Spacing.xs,
  },
  folderNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  folderNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
    flex: 1,
  },
  folderChangeLink: {
    fontSize: FontSize.xs,
    color: Colors.primaryDark,
    fontWeight: '800',
    textDecorationLine: 'underline',
    marginLeft: Spacing.sm,
  },
  discoveredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  discoveredNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
  },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    padding: 0,
  },

  // List
  listContent: {
    padding: Spacing.xl,
    paddingTop: 0,
    paddingBottom: Spacing['4xl'],
  },
  listHeader: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },

  // Filters
  filterScroll: {
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipIcon: {
    marginRight: 4,
  },
  chipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.textInverse,
    fontWeight: '700',
  },

  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  filterHeading: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeFilterBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  activeFilterBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  resetFilterBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  advancedFilterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  advancedFilterToggleActive: {
    backgroundColor: Colors.primaryLight,
  },
  advancedFilterToggleText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  advancedFilterToggleTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  advancedFiltersBox: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subFilterHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  subFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  countText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  filteredLabel: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Call Card
  callCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...(Shadow.sm as object),
  },
  callCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callCardLeft: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  callTypeDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  callCardInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  callName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  callPhone: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  callDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  callCardRight: {
    alignItems: 'flex-end',
    minWidth: 90,
    gap: 4,
  },
  callTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  callDuration: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  callLanguage: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  callLogBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  callLogBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pipelineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-end',
  },
  pipelineBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
  snippetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  snippetIcon: {
    marginRight: Spacing.xs,
  },
  snippetText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },

  // Separator
  separator: {
    height: Spacing.sm,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing['4xl'],
    paddingHorizontal: Spacing['2xl'],
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyActions: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  btnIcon: {
    marginRight: Spacing.sm,
  },
  rotatingIcon: {
    // animated or indicator
  },
  selectFolderBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    ...(Shadow.md as object),
  },
  selectFolderBtnText: {
    color: Colors.textInverse,
    fontSize: FontSize.base,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rescanBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  rescanBtnDisabled: {
    opacity: 0.5,
  },
  rescanBtnText: {
    color: Colors.primary,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});

export default CallsScreen;
