// TeleCaller AI — Recording Types (Phase 3)

export type DiscoverySource = 'media_store' | 'filesystem' | 'saf';

export type DiscoveredCallType = 'incoming' | 'outgoing' | 'unknown';

export interface DiscoveredRecording {
  id: string;
  fileName: string;
  filePath: string;
  fileUri: string;
  duration: number; // in seconds
  fileSizeBytes: number;
  timestamp: number; // epoch ms
  createdAt: string; // ISO 8601
  mimeType: string;
  discoverySource: DiscoverySource;
  phoneNumber?: string;
  contactName?: string;
  callType?: DiscoveredCallType;
  from?: string;
  to?: string;
  matchedWithCallLog?: boolean;
}

export interface CommonFolderInfo {
  name: string;
  path: string;
  exists: boolean;
  canRead: boolean;
  audioFilesCount: number;
}

export interface SelectedFolder {
  uri: string;
  name: string;
}

export type ScanStatus = 'idle' | 'scanning' | 'success' | 'empty' | 'error';

export interface RecordingScanState {
  status: ScanStatus;
  recordings: DiscoveredRecording[];
  selectedFolder: SelectedFolder | null;
  lastScannedAt: string | null;
  errorMessage: string | null;
}

