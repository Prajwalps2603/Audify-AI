// TeleCaller AI — useAudioPlayer Hook (Phase 6)
// Provides complete playback state, progress scrubbing, and play/pause controls.

import {useState, useEffect, useCallback, useRef} from 'react';
import {AudioPlayerService} from '../services/audio/AudioPlayerService';
import {PlaybackStatusType} from '../types/player';

interface UseAudioPlayerOptions {
  uri?: string | null;
  initialDurationSec?: number;
}

export function useAudioPlayer(options?: UseAudioPlayerOptions) {
  const targetUri = options?.uri ?? null;
  const initialDurationMs = (options?.initialDurationSec ?? 0) * 1000;

  const [status, setStatus] = useState<PlaybackStatusType>('idle');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [positionMs, setPositionMs] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(initialDurationMs);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (initialDurationMs > 0 && durationMs === 0) {
      setDurationMs(initialDurationMs);
    }

    // Subscribe to native progress events
    const progressSub = AudioPlayerService.onProgress(event => {
      if (!isMounted.current) return;
      setPositionMs(event.positionMs);
      if (event.durationMs > 0) {
        setDurationMs(event.durationMs);
      }
      setIsPlaying(event.isPlaying);
    });

    // Subscribe to status updates
    const statusSub = AudioPlayerService.onStatus(event => {
      if (!isMounted.current) return;
      setStatus(event.status);

      if (event.status === 'playing') {
        setIsPlaying(true);
        setErrorMessage(null);
      } else if (event.status === 'paused') {
        setIsPlaying(false);
      } else if (event.status === 'completed') {
        setIsPlaying(false);
        setPositionMs(0);
      } else if (event.status === 'error') {
        setIsPlaying(false);
        setErrorMessage(event.error || 'Playback error occurred.');
      } else if (event.status === 'idle') {
        setIsPlaying(false);
      }
    });

    return () => {
      isMounted.current = false;
      progressSub.remove();
      statusSub.remove();
    };
  }, [initialDurationMs]);

  // Play or resume
  const play = useCallback(
    async (uriToPlay?: string) => {
      const uri = uriToPlay || targetUri;
      if (!uri) {
        setErrorMessage('No audio recording URI available to play.');
        return;
      }

      setErrorMessage(null);
      try {
        await AudioPlayerService.play(uri);
      } catch (err: any) {
        setErrorMessage(err?.message ?? 'Failed to start playback.');
        setStatus('error');
      }
    },
    [targetUri],
  );

  // Pause
  const pause = useCallback(async () => {
    try {
      await AudioPlayerService.pause();
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Failed to pause.');
    }
  }, []);

  // Toggle play/pause
  const togglePlay = useCallback(
    async (uriToPlay?: string) => {
      if (isPlaying) {
        await pause();
      } else {
        await play(uriToPlay);
      }
    },
    [isPlaying, pause, play],
  );

  // Seek to ratio (0.0 to 1.0)
  const seekToRatio = useCallback(
    async (ratio: number) => {
      const clampedRatio = Math.max(0, Math.min(1, ratio));
      const targetPos = Math.round(clampedRatio * durationMs);
      setPositionMs(targetPos);
      try {
        await AudioPlayerService.seekTo(targetPos);
      } catch (err: any) {
        setErrorMessage(err?.message ?? 'Failed to seek.');
      }
    },
    [durationMs],
  );

  // Seek to milliseconds directly (for jumping from transcript timestamps)
  const seekToMs = useCallback(async (ms: number) => {
    const clampedMs = Math.max(0, Math.min(ms, durationMs || ms));
    setPositionMs(clampedMs);
    try {
      await AudioPlayerService.seekTo(clampedMs);
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Failed to seek.');
    }
  }, [durationMs]);

  // Stop
  const stop = useCallback(async () => {
    try {
      await AudioPlayerService.stop();
      setPositionMs(0);
      setIsPlaying(false);
      setStatus('idle');
    } catch {}
  }, []);

  const progressRatio = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const formattedPosition = AudioPlayerService.formatTime(positionMs);
  const formattedDuration = AudioPlayerService.formatTime(
    durationMs > 0 ? durationMs : initialDurationMs,
  );

  return {
    status,
    isPlaying,
    positionMs,
    durationMs,
    progressRatio,
    formattedPosition,
    formattedDuration,
    errorMessage,
    play,
    pause,
    togglePlay,
    seekToRatio,
    seekToMs,
    stop,
  };
}
