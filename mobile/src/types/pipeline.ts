// TeleCaller AI — Pipeline Types (Phase 11: Automatic End-to-End Pipeline)

export type PipelineStage =
  | 'QUEUED'
  | 'MATCH'
  | 'DRIVE'
  | 'TRANSCRIPTION'
  | 'SHEETS'
  | 'COMPLETED'
  | 'FAILED';

export interface PipelineJob {
  callId: string;
  recordingFileName: string;
  recordingUri: string;
  stage: PipelineStage;
  progressPercent: number;
  statusText: string;
  driveUrl?: string;
  driveFileId?: string;
  transcriptPreview?: string;
  language?: string;
  sheetRowId?: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface PipelineStats {
  total: number;
  completed: number;
  inProgress: number;
  failed: number;
  pending: number;
}

export interface PipelineConfig {
  autoProcess: boolean;
  autoUpload: boolean;
  autoTranscribe: boolean;
  wifiOnly: boolean;
}
