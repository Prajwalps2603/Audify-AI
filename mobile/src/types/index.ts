// TeleCaller AI — Core Types & Interfaces

// ─────────────────────────────────────────────────────────────
// Processing Status
// ─────────────────────────────────────────────────────────────

export type ProcessingStatus =
  | 'DISCOVERED'
  | 'PROCESSING'
  | 'UPLOADING'
  | 'TRANSCRIBING'
  | 'SAVING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PENDING';

export type CallType = 'Incoming' | 'Outgoing' | 'Missed' | 'Unknown';

// ─────────────────────────────────────────────────────────────
// Call Record
// ─────────────────────────────────────────────────────────────

export interface CallRecord {
  id: string;
  name: string;
  phoneNumber: string;
  date: string;          // ISO date string: "2026-09-24"
  time: string;          // "10:35 AM"
  from: string;          // "Telecaller"
  to: string;            // "Customer"
  callType: CallType;
  duration: string;      // "05:32"
  durationSeconds: number;
  language: string;      // "Malayalam"
  transcript: TranscriptSegment[] | null;
  transcriptPreview: string | null;
  driveUrl: string | null;
  driveFileId: string | null;
  recordingUri: string | null;
  recordingFileName: string | null;
  status: ProcessingStatus;
  createdAt: string;     // ISO datetime
  processedAt: string | null;
  sheetRowId: number | null;
  // Duplicate detection
  recordingHash: string | null;
  fileSizeBytes: number | null;
  fileModifiedAt: string | null;
  matchedWithCallLog?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Transcript
// ─────────────────────────────────────────────────────────────

export type SpeakerRole = 'CALLER' | 'RECEIVER' | 'UNKNOWN';

export interface TranscriptSegment {
  id: string;
  speaker: SpeakerRole;
  speakerLabel: string;  // "Caller", "Receiver", "Speaker 1"
  text: string;
  startTime: number | null;   // seconds offset from call start
  endTime: number | null;
  timestamp: string | null;   // "10:35:12"
}

// ─────────────────────────────────────────────────────────────
// User Profile
// ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  isAuthenticated: boolean;
}

// ─────────────────────────────────────────────────────────────
// Dashboard Summary
// ─────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalCalls: number;
  todayCalls: number;
  processedCalls: number;
  pendingCalls: number;
  failedCalls: number;
  totalGrowthPercent: number;
}

// ─────────────────────────────────────────────────────────────
// Filter Options
// ─────────────────────────────────────────────────────────────

export type DateFilter = 'All' | 'Today' | 'Yesterday' | 'This Week' | 'This Month';
export type StatusFilter = 'All' | 'Completed' | 'Pending' | 'Failed' | 'Processing';
export type CallTypeFilter = 'All' | 'Incoming' | 'Outgoing' | 'Missed';
export type DurationFilter = 'All' | '< 1 min' | '1-5 min' | '> 5 min';

export interface CallFilters {
  dateFilter: DateFilter;
  statusFilter: StatusFilter;
  callTypeFilter: CallTypeFilter;
  durationFilter: DurationFilter;
  searchQuery: string;
}

// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────

export interface AppSettings {
  recordingFolderUri: string | null;
  automaticProcessing: boolean;
  automaticUpload: boolean;
  automaticTranscription: boolean;
  wifiOnlyUpload: boolean;
  speechProvider: 'GOOGLE' | 'OPENAI' | 'DEEPGRAM' | 'NONE';
  languageDetection: boolean;
}

// ─────────────────────────────────────────────────────────────
// Navigation Params
// ─────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  OnboardingConsent: undefined;
  Main: undefined;
  Profile: undefined;
  AdminSettings: undefined;
  ModelTierDetails: {modelId: string};
};

export type MainTabParamList = {
  Home: undefined;
  Calls: undefined;
  Settings: undefined;
};

export type CallStackParamList = {
  CallsList: undefined;
  CallDetails: {callId: string};
  Transcript: {callId: string};
};

export * from './auth';
export * from './recordings';
export * from './player';
export * from './drive';
export * from './sheets';
export * from './transcription';
export * from './pipeline';
export * from './background';
export * from './security';

