// TeleCaller AI — Audio Player Types (Phase 6)

export type PlaybackStatusType =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'error';

export interface PlaybackProgress {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
}

export interface PlaybackState {
  status: PlaybackStatusType;
  currentUri: string | null;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  errorMessage: string | null;
}
