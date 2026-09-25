// TeleCaller AI — Premium Audio Player Component
// Play/Pause, seekable progress bar (drag + tap), skip buttons, and Drive link.

import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Linking,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../theme';
import {useAudioPlayer} from '../hooks/useAudioPlayer';
import {toast} from './Toast';

interface AudioPlayerProps {
  recordingUri?: string | null;
  recordingFileName?: string | null;
  durationSeconds?: number;
  driveUrl?: string | null;
  onSeek?: (positionMs: number) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  recordingUri,
  recordingFileName,
  durationSeconds = 0,
  driveUrl,
}) => {
  const trackWidth = useRef(0);
  const isSeeking = useRef(false);
  const [seekRatioOverride, setSeekRatioOverride] = useState<number | null>(null);
  const thumbScale = useRef(new Animated.Value(1)).current;

  const {
    status,
    isPlaying,
    durationMs,
    progressRatio,
    formattedPosition,
    formattedDuration,
    errorMessage,
    togglePlay,
    seekToRatio,
    seekToMs,
  } = useAudioPlayer({
    uri: recordingUri,
    initialDurationSec: durationSeconds,
  });

  const isLoading = status === 'loading';

  // The displayed ratio: while dragging use the override, otherwise live ratio
  const displayRatio =
    seekRatioOverride !== null ? seekRatioOverride : progressRatio;
  const progressPercent = `${Math.min(100, Math.max(0, displayRatio * 100))}%`;

  const animateThumb = (toScale: number) => {
    Animated.spring(thumbScale, {
      toValue: toScale,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  // ── PanResponder for drag-to-seek ──────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: evt => {
        isSeeking.current = true;
        animateThumb(1.4);
        const ratio = Math.max(
          0,
          Math.min(1, evt.nativeEvent.locationX / Math.max(1, trackWidth.current)),
        );
        setSeekRatioOverride(ratio);
      },

      onPanResponderMove: evt => {
        if (!isSeeking.current) return;
        const ratio = Math.max(
          0,
          Math.min(1, evt.nativeEvent.locationX / Math.max(1, trackWidth.current)),
        );
        setSeekRatioOverride(ratio);
      },

      onPanResponderRelease: evt => {
        animateThumb(1);
        isSeeking.current = false;
        const ratio = Math.max(
          0,
          Math.min(1, evt.nativeEvent.locationX / Math.max(1, trackWidth.current)),
        );
        setSeekRatioOverride(null);
        seekToRatio(ratio);
      },

      onPanResponderTerminate: () => {
        animateThumb(1);
        isSeeking.current = false;
        setSeekRatioOverride(null);
      },
    }),
  ).current;

  const handleSkip = (deltaSeconds: number) => {
    const currentMs = progressRatio * durationMs;
    const newMs = Math.max(0, Math.min(durationMs, currentMs + deltaSeconds * 1000));
    seekToMs(newMs);
  };

  const handleOpenDrive = async () => {
    if (driveUrl) {
      try {
        const supported = await Linking.canOpenURL(driveUrl);
        if (supported) {
          await Linking.openURL(driveUrl);
          return;
        }
      } catch {}
      toast.info('Google Drive', `Recording link: ${driveUrl}`);
    } else {
      toast.info(
        'Not Yet Uploaded',
        'This recording has not been backed up to Google Drive yet.',
      );
    }
  };

  const handleMainButtonPress = () => {
    if (!recordingUri) {
      toast.warning(
        'No Audio File',
        'No local audio file path is available for this recording.',
      );
      return;
    }
    togglePlay();
  };

  return (
    <View style={styles.container}>
      {/* ── File Name Subtitle ── */}
      {recordingFileName && (
        <View style={styles.headerRow}>
          <Icon name="music-note" size={14} color={Colors.textSecondary} />
          <Text style={styles.fileNameText} numberOfLines={1}>
            {recordingFileName}
          </Text>
        </View>
      )}

      {/* ── Scrubber Row: 00:00 ━━━━●━━━━ 05:32 ── */}
      <View style={styles.scrubberRow}>
        <Text style={styles.timeText}>{formattedPosition}</Text>

        {/* Draggable Track */}
        <View
          style={styles.trackContainer}
          onLayout={e => {
            trackWidth.current = e.nativeEvent.layout.width;
          }}
          {...panResponder.panHandlers}>
          <View style={styles.trackBackground}>
            <View style={[styles.trackFill, {width: progressPercent as any}]} />
          </View>
          <Animated.View
            style={[
              styles.trackThumb,
              {
                left: `${Math.min(96, Math.max(0, displayRatio * 100))}%` as any,
                transform: [{scale: thumbScale}],
              },
            ]}
          />
        </View>

        <Text style={styles.timeText}>{formattedDuration}</Text>
      </View>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={14} color={Colors.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* ── Control Buttons Row ── */}
      <View style={styles.buttonRow}>
        {/* −10s skip */}
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => handleSkip(-10)}
          activeOpacity={0.7}
          accessibilityLabel="Skip back 10 seconds"
          accessibilityRole="button">
          <Icon name="rewind-10" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Play / Pause */}
        <TouchableOpacity
          style={[
            styles.primaryPlayBtn,
            isPlaying && styles.primaryPauseBtn,
            isLoading && styles.btnDisabled,
          ]}
          onPress={handleMainButtonPress}
          disabled={isLoading}
          activeOpacity={0.8}
          accessibilityLabel={isPlaying ? 'Pause Recording' : 'Play Recording'}
          accessibilityRole="button">
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.textInverse} />
          ) : (
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color={Colors.textInverse}
            />
          )}
          <Text style={styles.primaryPlayBtnText}>
            {isLoading
              ? 'Loading...'
              : isPlaying
              ? 'Pause'
              : 'Play Recording'}
          </Text>
        </TouchableOpacity>

        {/* +10s skip */}
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => handleSkip(10)}
          activeOpacity={0.7}
          accessibilityLabel="Skip forward 10 seconds"
          accessibilityRole="button">
          <Icon name="fast-forward-10" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Drive */}
        <TouchableOpacity
          style={[styles.driveBtn, !driveUrl && styles.driveBtnMuted]}
          onPress={handleOpenDrive}
          activeOpacity={0.8}
          accessibilityLabel="Open in Google Drive"
          accessibilityRole="button">
          <Icon name="cloud-outline" size={16} color={Colors.textPrimary} />
          <Text style={styles.driveBtnText}>Drive</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: 2,
  },
  fileNameText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },

  // 00:00 ━━━━●━━━━ 05:32
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  timeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 42,
    textAlign: 'center',
  },
  trackContainer: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBackground: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  trackFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  trackThumb: {
    position: 'absolute',
    top: 7,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    borderWidth: 2.5,
    borderColor: Colors.surface,
    marginLeft: -9,
    ...(Shadow.sm as object),
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    fontWeight: '600',
    flex: 1,
  },

  // Controls Row
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  skipBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryPlayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    ...(Shadow.md as object),
  },
  primaryPauseBtn: {
    backgroundColor: Colors.primaryDark,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryPlayBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textInverse,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  driveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  driveBtnMuted: {
    opacity: 0.7,
  },
  driveBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});

export default AudioPlayer;
