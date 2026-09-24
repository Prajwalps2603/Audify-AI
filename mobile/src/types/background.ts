// TeleCaller AI — Background Processing & Automation Types (Phase 12)

export interface BackgroundSettings {
  /** Master background automation switch */
  enabled: boolean;
  /** Periodic background check frequency in minutes (e.g. 5, 15, 30, 60) */
  intervalMinutes: number;
  /** Whether heavy operations (Drive upload, STT) only run on Wi-Fi */
  wifiOnly: boolean;
  /** Automatically run complete pipeline on newly discovered recordings */
  autoProcess: boolean;
  /** Automatically backup to Google Drive */
  autoUpload: boolean;
  /** Automatically transcribe conversation using STT */
  autoTranscribe: boolean;
  /** Keep persistent notification foreground service active to prevent OS killing */
  foregroundServiceEnabled: boolean;
  /** ISO timestamp of last background check */
  lastSyncTimestamp: string | null;
  /** Current state of background synchronization */
  lastSyncStatus: 'idle' | 'running' | 'success' | 'failed';
  /** Last sync stats */
  lastSyncResult?: {
    newlyDiscovered: number;
    processed: number;
    failed: number;
  };
  /** Whether app is exempt from Android OEM battery optimization (Doze) */
  batteryOptimizationsIgnored: boolean;
}

export interface BackgroundSyncProgress {
  status: 'idle' | 'scanning' | 'processing' | 'completed' | 'failed';
  message: string;
  totalCalls: number;
  processedCalls: number;
}
