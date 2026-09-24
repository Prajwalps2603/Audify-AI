// TeleCaller AI — Modern Audio Player Component (Phase 6)
// Meets Section 22 and Phase 6 specification:
// Play button, 00:00 ━━━━━●━━━━ 05:32 progress track, seek, pause, resume, progress, duration.
// Buttons: [ Play Recording ] / [ Pause Recording ], [ Open in Drive ]. NO sync button.

import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../theme';
import {useAudioPlayer} from '../hooks/useAudioPlayer';

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
  const [trackWidth, setTrackWidth] = useState<number>(0);

  const {
    status,
    isPlaying,
    progressRatio,
    formattedPosition,
    formattedDuration,
    errorMessage,
    togglePlay,
    seekToRatio,
  } = useAudioPlayer({
    uri: recordingUri,
    initialDurationSec: durationSeconds,
  });

  const isLoading = status === 'loading';

  // Handle tap or scrub on the progress track to seek
  const handleTrackPress = (e: GestureResponderEvent) => {
    if (trackWidth <= 0) return;
    const locationX = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
    seekToRatio(ratio);
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
      Alert.alert('Google Drive', `Recording Drive link: ${driveUrl}`);
    } else {
      Alert.alert(
        'Google Drive',
        'This recording has not yet been uploaded to Google Drive. Drive backup occurs in Phase 7.',
        [{text: 'OK'}],
      );
    }
  };

  const handleMainButtonPress = () => {
    if (!recordingUri) {
      Alert.alert(
        'Audio File',
        'No local audio file path is available for this recording.',
        [{text: 'OK'}],
      );
      return;
    }
    togglePlay();
  };

  const progressPercent = `${Math.min(100, Math.max(0, progressRatio * 100))}%`;

  return (
    <View style={styles.container}>
      {/* ── File Name Subtitle ── */}
      {recordingFileName && (
        <View style={styles.headerRow}>
          <Text style={styles.fileIcon}>🎵</Text>
          <Text style={styles.fileNameText} numberOfLines={1}>
            {recordingFileName}
          </Text>
        </View>
      )}

      {/* ── Main Progress Row: 00:00 ━━━━━●━━━━ 05:32 ── */}
      <View style={styles.scrubberRow}>
        <Text style={styles.timeText}>{formattedPosition}</Text>

        <TouchableOpacity
          activeOpacity={1}
          style={styles.trackContainer}
          onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
          onPress={handleTrackPress}>
          <View style={styles.trackBackground}>
            <View style={[styles.trackFill, {width: progressPercent as any}]} />
          </View>
          <View
            style={[
              styles.trackThumb,
              {left: `${Math.min(96, Math.max(0, progressRatio * 100))}%` as any},
            ]}
          />
        </TouchableOpacity>

        <Text style={styles.timeText}>{formattedDuration}</Text>
      </View>

      {/* ── Error Banner if any ── */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
        </View>
      )}

      {/* ── Action Buttons Row ── */}
      <View style={styles.buttonRow}>
        {/* [ Play Recording ] / [ Pause Recording ] */}
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
            <Text style={styles.playBtnIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          )}
          <Text style={styles.primaryPlayBtnText}>
            {isLoading
              ? 'Loading...'
              : isPlaying
              ? 'Pause Recording'
              : 'Play Recording'}
          </Text>
        </TouchableOpacity>

        {/* [ Open in Drive ] */}
        <TouchableOpacity
          style={[styles.driveBtn, !driveUrl && styles.driveBtnMuted]}
          onPress={handleOpenDrive}
          activeOpacity={0.8}
          accessibilityLabel="Open in Google Drive"
          accessibilityRole="button">
          <Text style={styles.driveBtnIcon}>☁️</Text>
          <Text style={styles.driveBtnText}>Open in Drive</Text>
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
  fileIcon: {
    fontSize: 14,
  },
  fileNameText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },

  // 00:00 ━━━━━●━━━━ 05:32
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
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
    height: 28,
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
    top: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.surface,
    marginLeft: -9,
    ...(Shadow.sm as object),
  },

  // Error
  errorBox: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    fontWeight: '600',
  },

  // Action Buttons
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
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
  playBtnIcon: {
    fontSize: 16,
    color: Colors.textInverse,
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
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  driveBtnMuted: {
    opacity: 0.7,
  },
  driveBtnIcon: {
    fontSize: 16,
  },
  driveBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});

export default AudioPlayer;
