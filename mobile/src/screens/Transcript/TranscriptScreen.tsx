// TeleCaller AI — Transcript Screen
// Conversational transcript interface with synchronized audio scrubber, speaker highlighting, and text search.

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
  TextInput,
  Share,
  Modal,
  ScrollView as RNScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import {TranscriptSegment, SpeakerRole} from '../../types';
import Avatar from '../../components/Avatar';
import {useRecordings} from '../../context/RecordingContext';
import {RecordingScannerService} from '../../services/scanner/RecordingScannerService';
import {AudioPlayerService} from '../../services/audio/AudioPlayerService';
import {TranscriptionService} from '../../services/transcription/TranscriptionService';
import {SUPPORTED_PROVIDERS, SpeechProvider} from '../../types/transcription';
import {useAudioPlayer} from '../../hooks/useAudioPlayer';
import {toast} from '../../components/Toast';
import {showAlert} from '../../components/AppModal';

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
        <Avatar name="Agent" size={32} style={styles.bubbleAvatar} />
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
          activeOpacity={0.75}
          onPress={onPress}
          style={[
            styles.bubble,
            {backgroundColor: bubbleBg, borderColor: bubbleBorder},
            isReceiver ? styles.bubbleRight : styles.bubbleLeft,
            isActive && styles.bubbleActive,
          ]}
          accessibilityLabel={`${segment.speakerLabel}: ${segment.text}, at ${segment.timestamp || 'start'}`}
          accessibilityRole="button">
          {isActive && (
            <View
              style={[
                styles.activeBadge,
                {backgroundColor: isReceiver ? Colors.secondary : Colors.primary},
              ]}>
              <Text style={styles.activeBadgeText}>PLAYING NOW</Text>
            </View>
          )}

          <Text style={[styles.bubbleText, {color: textColor}]}>
            {segment.text}
          </Text>

          <View style={styles.bubbleFooter}>
            <View style={styles.tapSeekRow}>
              <Icon name="play-circle-outline" size={13} color={Colors.primary} style={{marginRight: 3}} />
              <Text style={styles.tapSeekText}>Tap to seek</Text>
            </View>
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
    return null;
  }, [discovered]);

  const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>(
    call?.transcript ?? [],
  );
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeStatus, setTranscribeStatus] = useState<string>('');
  const [activeProvider, setActiveProvider] = useState<SpeechProvider>('GOOGLE');

  // Language selector state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('English');
  const [langModalVisible, setLangModalVisible] = useState(false);

  const LANGUAGE_OPTIONS = [
    {code: 'English', label: 'English', flag: '🇬🇧'},
    {code: 'Hindi', label: 'हिंदी (Hindi)', flag: '🇮🇳'},
    {code: 'Malayalam', label: 'മലയാളം (Malayalam)', flag: '🇮🇳'},
    {code: 'Tamil', label: 'தமிழ் (Tamil)', flag: '🇮🇳'},
    {code: 'Telugu', label: 'తెలుగు (Telugu)', flag: '🇮🇳'},
    {code: 'Kannada', label: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳'},
    {code: 'Arabic', label: 'العربية (Arabic)', flag: '🇦🇪'},
    {code: 'French', label: 'Français (French)', flag: '🇫🇷'},
    {code: 'Spanish', label: 'Español (Spanish)', flag: '🇪🇸'},
  ];

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
      toast.success('Transcript Ready', 'Speech transcription complete');
    } catch (err: any) {
      showAlert({
        title: 'Transcription Failed',
        message: err?.message || 'Could not transcribe call recording.',
        variant: 'error',
        buttons: [{text: 'OK'}],
      });
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
      toast.info('Transcript', 'No transcript content to share.');
      return;
    }
    const header = `Audify AI — Call Transcript\nContact: ${call?.name}\nDate: ${call?.date}\nDuration: ${call?.duration}\nLanguage: ${call?.language}\n\n`;
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
          <Icon name="file-question-outline" size={56} color={Colors.textTertiary} />
          <Text style={styles.notFoundText}>Call record not found.</Text>
          <TouchableOpacity
            style={styles.backLinkBtn}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={16} color={Colors.primary} style={{marginRight: 4}} />
            <Text style={styles.backLink}>Go Back</Text>
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
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {call.name}
          </Text>
          <Text style={styles.topBarSubtitle}>
            {call.date} • {call.duration} • {call.language}
          </Text>
        </View>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setLangModalVisible(true)}
            accessibilityLabel="Change transcript language"
            accessibilityRole="button">
            <Icon name="translate" size={20} color={Colors.primary} />
            {selectedLanguage !== 'English' && (
              <View style={styles.langIndicatorDot} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleShareTranscript}
            accessibilityLabel="Share transcript"
            accessibilityRole="button">
            <Icon name="share-variant-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Synchronized Audio Dock ── */}
      {call.recordingUri && (
        <View style={styles.audioDock}>
          <TouchableOpacity
            style={styles.dockPlayBtn}
            onPress={() => togglePlay()}
            activeOpacity={0.8}
            accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
            accessibilityRole="button">
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color={Colors.textInverse}
            />
          </TouchableOpacity>

          <View style={styles.dockTrackCol}>
            <View style={styles.dockTimeRow}>
              <Text style={styles.dockTimeText}>{formattedPosition}</Text>
              <View style={styles.dockSyncRow}>
                <Icon
                  name={isPlaying ? 'record-circle-outline' : 'gesture-tap'}
                  size={12}
                  color={isPlaying ? Colors.primary : Colors.textTertiary}
                  style={{marginRight: 3}}
                />
                <Text style={styles.dockSyncBadge}>
                  {isPlaying ? 'Audio Sync Active' : 'Tap bubble to jump'}
                </Text>
              </View>
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
          <Icon name="magnify" size={18} color={Colors.textTertiary} style={styles.searchIcon} />
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
              <Icon name="close-circle" size={16} color={Colors.textTertiary} />
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

      {/* ── Active Translation Banner (only when non-English selected) ── */}
      {selectedLanguage !== 'English' && (
        <View style={styles.translatingBanner}>
          <Icon name="auto-fix" size={14} color="#7C3AED" style={{marginRight: 6}} />
          <Text style={styles.translatingBannerText}>
            Auto-translating to {selectedLanguage}
          </Text>
          <TouchableOpacity onPress={() => setSelectedLanguage('English')}>
            <Text style={styles.resetLangText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Status notice (transcribing spinner only) ── */}
      {isTranscribing ? (
        <View style={styles.transcribingNotice}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.transcribingNoticeText}>
            {transcribeStatus || 'Transcribing call...'} ({transcribeProgress}%)
          </Text>
        </View>
      ) : null}

      {/* ── Language Picker Modal ── */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLangModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Transcript Language</Text>
            <Text style={styles.modalSubtitle}>
              Transcript bubbles will be auto-translated to the selected language.
            </Text>
            <RNScrollView showsVerticalScrollIndicator={false}>
              {LANGUAGE_OPTIONS.map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langOption,
                    selectedLanguage === lang.code && styles.langOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedLanguage(lang.code);
                    setLangModalVisible(false);
                    toast.info(
                      'Language Changed',
                      lang.code === 'English'
                        ? 'Showing original transcript'
                        : `Translating to ${lang.code}`,
                    );
                  }}
                  activeOpacity={0.7}>
                  <Text style={styles.langOptionFlag}>{lang.flag}</Text>
                  <Text
                    style={[
                      styles.langOptionLabel,
                      selectedLanguage === lang.code && styles.langOptionLabelActive,
                    ]}>
                    {lang.label}
                  </Text>
                  {selectedLanguage === lang.code && (
                    <Icon name="check-circle" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </RNScrollView>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setLangModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Messages List ── */}
      {liveSegments.length === 0 ? (
        <View style={styles.noTranscript}>
          <View style={styles.noTranscriptIconCircle}>
            <Icon name="microphone-outline" size={44} color={Colors.primary} />
          </View>
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
              <Icon name="waveform" size={18} color={Colors.textInverse} style={{marginRight: 6}} />
              <Text style={styles.transcribeBtnText}>Transcribe This Call</Text>
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
    marginRight: Spacing.xs,
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
    color: Colors.textSecondary,
    marginTop: 1,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langIndicatorDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  translatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: Spacing.base,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD6FE',
  },
  translatingBannerText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: '#7C3AED',
  },
  resetLangText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
    textDecorationLine: 'underline',
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
    ...(Shadow.sm as object),
  },
  dockPlayBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Shadow.sm as object),
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
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  dockSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dockSyncBadge: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  dockTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
  },
  dockTrackFilled: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },

  // Search bar
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

  // Language selector
  langSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  langChipText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  translatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#C4B5FD',
  },
  translatingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },

  // Language Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: Spacing.xl,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: Spacing.base,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.base,
    lineHeight: 18,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  langOptionActive: {
    backgroundColor: Colors.primaryLight + '80',
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: -Spacing.sm,
  },
  langOptionFlag: {
    fontSize: 22,
  },
  langOptionLabel: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  langOptionLabelActive: {
    color: Colors.primary,
  },
  modalCloseBtn: {
    marginTop: Spacing.base,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textSecondary,
  },

  // Notices
  verifiedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  tapSeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tapSeekText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
    opacity: 0.8,
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
  noTranscriptIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
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
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  backLink: {
    fontSize: FontSize.base,
    color: Colors.primary,
    fontWeight: '700',
  },
});

export default TranscriptScreen;
