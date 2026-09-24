// TeleCaller AI — Google Drive Types (Phase 7)

export type DriveConnectionStatus = 'connected' | 'not_connected' | 'checking';

export type DriveUploadStatus =
  | 'idle'
  | 'checking'
  | 'creating_folders'
  | 'uploading'
  | 'completed'
  | 'skipped'
  | 'error';

export interface DriveFolderInfo {
  id: string;
  name: string;
  parentId?: string;
}

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingFileId?: string;
  existingUrl?: string;
  reason?: string;
}

export interface DriveUploadProgress {
  recordingId: string;
  status: DriveUploadStatus;
  progressPercent: number;
  result?: DriveUploadResult;
  errorMessage?: string;
}

export interface DriveUploadRecord {
  recordingId: string;
  fileHash: string;
  fileName: string;
  fileSizeBytes: number;
  fileModifiedAt: string;
  driveFileId: string;
  driveUrl: string;
  uploadedAt: string;
}
