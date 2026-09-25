// TeleCaller AI — Audio Player Service
// Interfaces with Android native MediaPlayer via AudioPlayerModule.

import {NativeModules, NativeEventEmitter, Platform} from 'react-native';
import {PlaybackProgress, PlaybackState, PlaybackStatusType} from '../../types/player';

const {AudioPlayer} = NativeModules;

// Safely create EventEmitter if AudioPlayer is available
const playerEmitter = AudioPlayer ? new NativeEventEmitter(AudioPlayer) : null;

export class AudioPlayerService {
  /**
   * Play an audio file or content URI.
   * If already prepared with the same URI, resumes playback.
   */
  static async play(uriOrPath: string): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }
    if (!AudioPlayer?.play) {
      throw new Error('Native AudioPlayer module is not available.');
    }

    try {
      await AudioPlayer.play(uriOrPath);
    } catch (error: any) {
      throw new Error(error?.message ?? 'Failed to play audio recording.');
    }
  }

  /**
   * Pause current playback.
   */
  static async pause(): Promise<void> {
    if (Platform.OS !== 'android' || !AudioPlayer?.pause) return;
    try {
      await AudioPlayer.pause();
    } catch (error: any) {
      throw new Error(error?.message ?? 'Failed to pause audio.');
    }
  }

  /**
   * Resume paused playback.
   */
  static async resume(): Promise<void> {
    if (Platform.OS !== 'android' || !AudioPlayer?.resume) return;
    try {
      await AudioPlayer.resume();
    } catch (error: any) {
      throw new Error(error?.message ?? 'Failed to resume audio.');
    }
  }

  /**
   * Seek to specific position in milliseconds.
   */
  static async seekTo(positionMs: number): Promise<void> {
    if (Platform.OS !== 'android' || !AudioPlayer?.seekTo) return;
    try {
      await AudioPlayer.seekTo(positionMs);
    } catch (error: any) {
      throw new Error(error?.message ?? 'Failed to seek audio.');
    }
  }

  /**
   * Stop playback and release player.
   */
  static async stop(): Promise<void> {
    if (Platform.OS !== 'android' || !AudioPlayer?.stop) return;
    try {
      await AudioPlayer.stop();
    } catch (error: any) {
      throw new Error(error?.message ?? 'Failed to stop audio.');
    }
  }

  /**
   * Get current playback state snapshot.
   */
  static async getStatus(): Promise<PlaybackState> {
    if (Platform.OS !== 'android' || !AudioPlayer?.getStatus) {
      return {
        status: 'idle',
        currentUri: null,
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
        errorMessage: null,
      };
    }

    try {
      const res = await AudioPlayer.getStatus();
      return {
        status: (res.status as PlaybackStatusType) || 'idle',
        currentUri: res.currentUri || null,
        positionMs: res.positionMs || 0,
        durationMs: res.durationMs || 0,
        isPlaying: Boolean(res.isPlaying),
        errorMessage: null,
      };
    } catch {
      return {
        status: 'idle',
        currentUri: null,
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
        errorMessage: null,
      };
    }
  }

  /**
   * Subscribe to periodic playback progress events.
   */
  static onProgress(callback: (progress: PlaybackProgress) => void) {
    if (!playerEmitter) return {remove: () => {}};
    return playerEmitter.addListener('onPlaybackProgress', (data: any) => {
      callback(data as PlaybackProgress);
    });
  }

  /**
   * Subscribe to playback status updates (loading, playing, paused, completed, error).
   */
  static onStatus(callback: (event: {status: PlaybackStatusType; currentUri: string; error?: string}) => void) {
    if (!playerEmitter) return {remove: () => {}};
    return playerEmitter.addListener('onPlaybackStatus', (data: any) => {
      callback(data);
    });
  }

  /**
   * Helper to format milliseconds into "mm:ss" or "hh:mm:ss".
   */
  static formatTime(ms: number): string {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }
}
