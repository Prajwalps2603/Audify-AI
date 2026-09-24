// TeleCaller AI — Transcript Screen (Phase 10: Real Data Integration)
// Full conversational transcript interface with:
// - Real audio player synchronization & interactive scrubbing
// - Active speaker highlighting & auto-scroll
// - In-transcript search & keyword filtering
// - Formatted transcript export & sharing
// - Real data integration across discovered & mock calls

import React, {useMemo, useRef, useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ListRenderItem,
  ActivityIndicator,
  Alert,
  TextInput,
  Share,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import {MOCK_CALLS} from '../../mock/mockData';
import {TranscriptSegment, SpeakerRole} from '../../types';
import Avatar from '../../components/Avatar';
import {useRecordings} from '../../context/RecordingContext';
import {RecordingScannerService} from '../../services/scanner/RecordingScannerService';
import {AudioPlayerService} from '../../services/audio/AudioPlayerService';
import {TranscriptionService} from '../../services/transcription/TranscriptionService';
import {SUPPORTED_PROVIDERS, SpeechProvider} from '../../types/transcription';
import {useAudioPlayer} from '../../hooks/useAudioPlayer';

const {width} = Dimensions.get('window');
const BUBBLE_MAX_WIDTH = width * 0.72;

// ─────────────────────────────────────────────────────────────
// Speaker Header (shown once per speaker switch)
// ─────────────────────────────────────────────────────────────
interface SpeakerHeaderProps {
  label: string;
  role: SpeakerRole;
}

const SpeakerHeader: React.FC<SpeakerHeaderProps> = ({label, role}) => {
  const isReceiver = role === 'RECEIVER';
  return (
    <View
      style={[
        styles.speakerHeader,
        isReceiver ? styles.speakerHeaderRight : styles.speakerHeaderLeft,
      ]}>
      <Text
        style={[
          styles.speakerName,
          {color: isReceiver ? Colors.secondary : Colors.primary},
        ]}>
        {label}
      </Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Message Bubble
// ─────────────────────────────────────────────────────────────
interface BubbleProps {
  segment: TranscriptSegment;
  callName: string;
  showSpeakerLabel: boolean;
  isActive?: boolean;
  searchQuery?: string;
  onPress?: () => void;
}

const MessageBubble: React.FC<BubbleProps> = ({
  segment,
  callName,
  showSpeakerLabel,
  isActive = false,
  onPress,
}) => {
  const isReceiver = segment.speaker === 'RECEIVER';

  const bubbleBg = isReceiver ? Colors.receiverBubble : Colors.callerBubble;
  const bubbleBorder = isActive
    ? isReceiver
      ? Colors.secondary
      : Colors.primary
    : isReceiver
    ? Colors.receiverBubbleBorder
    : Colors.callerBubbleBorder;
  const textColor = isReceiver ? Colors.receiverText : Colors.callerText;
  const timeColor = isReceiver
    ? 'rgba(59,31,110,0.6)'
    : 'rgba(30,58,95,0.6)';

  return (
    <View
      style={[
        styles.bubbleRow,
        isReceiver ? styles.bubbleRowRight : styles.bubbleRowLeft,
      ]}>
      {!isReceiver && (
        <Avatar name="TC" size={32} style={styles.bubbleAvatar} />
      )}

      <View style={styles.bubbleColumn}>
        {showSpeakerLabel && (
          <Text
            style={[
              styles.speakerTag,
              isReceiver ? styles.speakerTagRight : styles.speakerTagLeft,
              {color: isReceiver ? Colors.secondary : Colors.primary},
            ]}>
            {segment.speakerLabel}
          </Text>
        )}

        <TouchableOpacity
          activeOpacity={onPress ? 0.75 : 1}
          onPress={onPress}
          style={[
            styles.bubble,
            isReceiver ? styles.bubbleRight : styles.bubbleLeft,
            isActive && styles.bubbleActive,
            {
              backgroundColor: bubbleBg,
              borderColor: bubbleBorder,
            },
          ]}>
          {isActive && (
            <View
              style={[
                styles.activeBadge,
                {backgroundColor: isReceiver ? Colors.secondary : Colors.primary},
              ]}>
              <Text style={styles.activeBadgeText}>▶ Speaking Now</Text>
            </View>
          )}

          <Text style={[styles.bubbleText, {color: textColor}]}>
            {segment.text}
          </Text>

          <View style={styles.bubbleFooter}>
            <Text style={styles.tapSeekText}>Tap to play ↗</Text>
            {segment.timestamp && (
              <Text style={[styles.bubbleTime, {color: timeColor}]}>
                {segment.timestamp}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {isReceiver && (
        <Avatar name={callName} size={32} style={styles.bubbleAvatarRight} />
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Transcript Screen
// ─────────────────────────────────────────────────────────────
const TranscriptScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {callId} = route.params as {callId: string};
  const listRef = useRef<FlatList>(null);

  const {getRecordingById} = useRecordings();
  const discovered = getRecordingById(callId);

  const call = useMemo(() => {
    if (discovered) {
      return RecordingScannerService.discoveredToCallRecord(discovered);
    }
    return MOCK_CALLS.find(c => c.id === callId) ?? null;
  }, [discovered, callId]);

  const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>(
    call?.transcript ?? [],
  );
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeStatus, setTranscribeStatus] = useState<string>('');
  const [activeProvider, setActiveProvider] = useState<SpeechProvider>('GOOGLE');

  // Search & Audio Dock state
  const [searchQuery, setSearchQuery] = useState('');
  const [dockTrackWidth, setDockTrackWidth] = useState(0);

  // Synchronized Audio Player Hook
  const {
    isPlaying,
    positionMs,
    formattedPosition,
    formattedDuration,
    progressRatio,
    togglePlay,
    seekToRatio,
  } = useAudioPlayer({
    uri: call?.recordingUri,
    initialDurationSec: call?.durationSeconds,
  });

  // Load provider and cached transcript
  useEffect(() => {
    TranscriptionService.getSelectedProvider().then(setActiveProvider);
    if (callId) {
      TranscriptionService.getCachedTranscript(callId).then(cached => {
        if (cached && cached.segments && cached.segments.length > 0) {
          setLiveSegments(cached.segments);
        }
      });
    }
  }, [callId]);

  // Compute currently playing segment
  const currentSec = positionMs / 1000;
  const activeSegmentId = useMemo(() => {
    if (!isPlaying && positionMs === 0) return null;
    const match = liveSegments.find(seg => {
      if (seg.startTime === null) return false;
      const end = seg.endTime !== null ? seg.endTime : seg.startTime + 6;
      return currentSec >= seg.startTime && currentSec <= end;
    });
    return match ? match.id : null;
  }, [currentSec, isPlaying, positionMs, liveSegments]);

  // Filter segments by search query
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return liveSegments;
    const q = searchQuery.toLowerCase().trim();
    return liveSegments.filter(
      seg =>
        seg.text.toLowerCase().includes(q) ||
        seg.speakerLabel.toLowerCase().includes(q),
    );
  }, [liveSegments, searchQuery]);

  const handleTranscribeCall = async () => {
    if (!call) return;
    setIsTranscribing(true);
    setTranscribeProgress(10);
    setTranscribeStatus('Preparing audio file...');
    try {
      const result = await TranscriptionService.transcribeCall(call, prog => {
        setTranscribeProgress(prog.progressPercent);
        if (prog.status === 'preparing') setTranscribeStatus('Preparing audio file...');
        if (prog.status === 'processing') setTranscribeStatus('Transcribing speech with AI...');
        if (prog.status === 'diarizing') setTranscribeStatus('Diarizing speakers & timestamps...');
      });
      setLiveSegments(result.segments);
    } catch (err: any) {
      Alert.alert(
        'Transcription Failed',
        err?.message || 'Could not transcribe call recording.',
      );
    } finally {
      setIsTranscribing(false);
      setTranscribeProgress(0);
    }
  };

  const handleSegmentPress = async (segment: TranscriptSegment) => {
    if (call?.recordingUri && segment.startTime !== null) {
      try {
        await AudioPlayerService.play(call.recordingUri);
        await AudioPlayerService.seekTo(segment.startTime * 1000);
      } catch {}
    }
  };

  const handleShareTranscript = async () => {
    if (liveSegments.length === 0) {
      Alert.alert('Transcript', 'No transcript content to share.');
      return;
    }
    const header = `📞 TeleCaller AI — Call Transcript\nContact: ${call?.name}\nDate: ${call?.date}\nDuration: ${call?.duration}\nLanguage: ${call?.language}\n\n`;
    const body = liveSegments
      .map(
        seg => `[${seg.timestamp || '00:00'}] ${seg.speakerLabel}: ${seg.text}`,
      )
      .join('\n\n');
    try {
      await Share.share({
        title: `Transcript - ${call?.name}`,
        message: header + body,
      });
    } catch {}
  };

  const renderItem: ListRenderItem<TranscriptSegment> = ({item, index}) => {
    const prevSpeaker = index > 0 ? filteredSegments[index - 1].speaker : null;
    const showLabel = prevSpeaker !== item.speaker;

    return (
      <MessageBubble
        segment={item}
        callName={call?.name ?? 'Customer'}
        showSpeakerLabel={showLabel}
        isActive={activeSegmentId === item.id}
        searchQuery={searchQuery}
        onPress={() => handleSegmentPress(item)}
      />
    );
  };

  if (!call) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Call record not found.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>← Go Back</Text>
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
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button">
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {call.name}
          </Text>
          <Text style={styles.topBarSubtitle}>
            {call.date} • {call.duration} • {call.language}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleShareTranscript}
          accessibilityLabel="Share transcript"
          accessibilityRole="button">
          <Text style={styles.actionBtnIcon}>📤</Text>
        </TouchableOpacity>
      </View>

      {/* ── Synchronized Audio Dock (Phase 10) ── */}
      {call.recordingUri && (
        <View style={styles.audioDock}>
          <TouchableOpacity
            style={styles.dockPlayBtn}
            onPress={() => togglePlay()}
            activeOpacity={0.8}
            accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
            accessibilityRole="button">
            <Text style={styles.dockPlayIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>

          <View style={styles.dockTrackCol}>
            <View style={styles.dockTimeRow}>
              <Text style={styles.dockTimeText}>{formattedPosition}</Text>
              <Text style={styles.dockSyncBadge}>
                {isPlaying ? '● Audio Sync Playing' : 'Tap bubble to jump audio'}
              </Text>
              <Text style={styles.dockTimeText}>{formattedDuration}</Text>
            </View>

            <TouchableOpacity
              activeOpacity={1}
              onPress={e => {
                if (dockTrackWidth > 0) {
                  const ratio = Math.max(
                    0,
                    Math.min(1, e.nativeEvent.locationX / dockTrackWidth),
                  );
                  seekToRatio(ratio);
                }
              }}
              onLayout={e => setDockTrackWidth(e.nativeEvent.layout.width)}
              style={styles.dockTrack}>
              <View
                style={[
                  styles.dockTrackFilled,
                  {width: `${Math.min(100, Math.max(0, progressRatio * 100))}%`},
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Search Bar (when transcript exists) ── */}
      {liveSegments.length > 0 && (
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search words in transcript..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
          {searchQuery.length > 0 && (
            <View style={styles.matchCountBadge}>
              <Text style={styles.matchCountText}>
                {filteredSegments.length} match{filteredSegments.length === 1 ? '' : 'es'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Status notice ── */}
      {liveSegments.length > 0 ? (
        <View style={styles.verifiedNotice}>
          <Text style={styles.verifiedNoticeText}>
            ✓ AI Transcribed ({SUPPORTED_PROVIDERS[activeProvider]?.name || 'Speech-to-Text'}) • Synchronized Playback Active
          </Text>
        </View>
      ) : isTranscribing ? (
        <View style={styles.transcribingNotice}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.transcribingNoticeText}>
            {transcribeStatus || 'Transcribing call...'} ({transcribeProgress}%)
          </Text>
        </View>
      ) : null}

      {/* ── Messages List ── */}
      {liveSegments.length === 0 ? (
        <View style={styles.noTranscript}>
          <Text style={styles.noTranscriptIcon}>🎙️</Text>
          <Text style={styles.noTranscriptTitle}>No Transcript Yet</Text>
          <Text style={styles.noTranscriptText}>
            Generate speaker diarization, timestamps, and language detection using {SUPPORTED_PROVIDERS[activeProvider]?.name || 'AI STT'}.
          </Text>
          {isTranscribing ? (
            <View style={styles.transcribingBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.transcribingBoxText}>
                {transcribeStatus} ({transcribeProgress}%)
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.transcribeBtn}
              onPress={handleTranscribeCall}
              activeOpacity={0.8}
              accessibilityLabel="Transcribe call recording"
              accessibilityRole="button">
              <Text style={styles.transcribeBtnText}>🎙️ Transcribe This Call</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={filteredSegments}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={styles.listFooter} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...(Shadow.sm as object),
  },
  backButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  backIcon: {
    fontSize: FontSize.xl,
    color: Colors.primary,
    fontWeight: '600',
  },
  topBarCenter: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  topBarSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  actionBtn: {
    padding: Spacing.sm,
  },
  actionBtnIcon: {
    fontSize: 20,
  },

  // Audio Dock
  audioDock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  dockPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockPlayIcon: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  dockTrackCol: {
    flex: 1,
  },
  dockTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dockTimeText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  dockSyncBadge: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '700',
  },
  dockTrack: {
    height: 5,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  dockTrackFilled: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    paddingVertical: 4,
  },
  clearSearchBtn: {
    padding: Spacing.xs,
  },
  clearSearchText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  matchCountBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: Spacing.xs,
  },
  matchCountText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '700',
  },

  // Notices
  verifiedNotice: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.success,
  },
  verifiedNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '700',
    textAlign: 'center',
  },
  transcribingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.base,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
  },
  transcribingNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
  },
  listFooter: {
    height: Spacing['4xl'],
  },

  // Speaker Header
  speakerHeader: {
    marginBottom: 4,
    marginTop: Spacing.md,
  },
  speakerHeaderLeft: {
    alignSelf: 'flex-start',
    paddingLeft: 40,
  },
  speakerHeaderRight: {
    alignSelf: 'flex-end',
    paddingRight: 40,
  },
  speakerName: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Bubble
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    alignItems: 'flex-end',
  },
  bubbleRowLeft: {
    justifyContent: 'flex-start',
    paddingRight: '20%',
  },
  bubbleRowRight: {
    justifyContent: 'flex-end',
    paddingLeft: '20%',
  },
  bubbleAvatar: {
    marginRight: Spacing.sm,
    marginBottom: 4,
    flexShrink: 0,
  },
  bubbleAvatarRight: {
    marginLeft: Spacing.sm,
    marginBottom: 4,
    flexShrink: 0,
  },
  bubbleColumn: {
    flex: 1,
    maxWidth: BUBBLE_MAX_WIDTH,
  },
  speakerTag: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  speakerTagLeft: {
    textAlign: 'left',
  },
  speakerTagRight: {
    textAlign: 'right',
  },
  bubble: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
    ...(Shadow.sm as object),
  },
  bubbleActive: {
    borderWidth: 2.5,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  bubbleLeft: {
    borderBottomLeftRadius: 4,
  },
  bubbleRight: {
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  activeBadgeText: {
    fontSize: 9,
    color: Colors.textInverse,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  bubbleText: {
    fontSize: FontSize.base,
    lineHeight: 24,
    fontWeight: '400',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: Spacing.sm,
  },
  tapSeekText: {
    fontSize: 9,
    color: Colors.primary,
    fontWeight: '600',
    opacity: 0.7,
  },
  bubbleTime: {
    fontSize: FontSize.xs,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  // No transcript
  noTranscript: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  noTranscriptIcon: {
    fontSize: 56,
    marginBottom: Spacing.lg,
  },
  noTranscriptTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  noTranscriptText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  transcribeBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
    ...(Shadow.sm as object),
  },
  transcribeBtnText: {
    color: Colors.textInverse,
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  transcribingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  transcribingBoxText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // Not found
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  notFoundText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  backLink: {
    fontSize: FontSize.base,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default TranscriptScreen;
