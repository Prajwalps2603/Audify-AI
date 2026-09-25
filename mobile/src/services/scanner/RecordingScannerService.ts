// TeleCaller AI — Recording Scanner Service
// Interfaces with Android native MediaStore & OEM folder scanning.

import {NativeModules, PermissionsAndroid, Platform} from 'react-native';
import {
  DiscoveredRecording,
  CommonFolderInfo,
  SelectedFolder,
} from '../../types/recordings';
import {CallRecord} from '../../types';

const {RecordingScanner} = NativeModules;

export class RecordingScannerService {
  /**
   * Check whether audio / external storage permissions are granted.
   */
  static async checkPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      if (RecordingScanner?.checkStoragePermission) {
        return await RecordingScanner.checkStoragePermission();
      }

      // Fallback to PermissionsAndroid
      if (Platform.Version >= 33) {
        return await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        );
      } else {
        return await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        );
      }
    } catch {
      return false;
    }
  }

  /**
   * Request necessary audio / storage permissions with user dialog.
   */
  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
          {
            title: 'Audio Recording Access',
            message:
              'Audify AI needs access to your device audio files to automatically discover and organize call recordings.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Access Permission',
            message:
              'Audify AI needs storage access to find call recordings saved on your phone.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch {
      return false;
    }
  }

  /**
   * Get list of known OEM call recording folders and their existence.
   */
  static async getCommonFolders(): Promise<CommonFolderInfo[]> {
    if (Platform.OS !== 'android' || !RecordingScanner?.getCommonFolders) {
      return [];
    }

    try {
      return await RecordingScanner.getCommonFolders();
    } catch {
      return [];
    }
  }

  /**
   * Run full discovery scan across MediaStore and standard OEM directories.
   */
  static async scanRecordings(): Promise<DiscoveredRecording[]> {
    if (Platform.OS !== 'android') {
      return [];
    }

    const hasPerm = await this.checkPermissions();
    if (!hasPerm) {
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error('Storage permission is required to scan call recordings.');
      }
    }

    if (!RecordingScanner?.scanRecordings) {
      throw new Error(
        'RecordingScanner native module is not available on this platform.',
      );
    }

    try {
      const results: DiscoveredRecording[] =
        await RecordingScanner.scanRecordings(null);
      return results;
    } catch (error: any) {
      throw new Error(
        error?.message ?? 'Failed to scan device for call recordings.',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Storage Access Framework Folder Picker & Persistence
  // ─────────────────────────────────────────────────────────────

  /**
   * Launch Android Storage Access Framework folder picker and persist permission.
   */
  static async openFolderPicker(): Promise<SelectedFolder> {
    if (Platform.OS !== 'android' || !RecordingScanner?.openFolderPicker) {
      throw new Error('Folder picker is only available on Android devices.');
    }

    try {
      const folder: SelectedFolder = await RecordingScanner.openFolderPicker();
      return folder;
    } catch (error: any) {
      throw new Error(error?.message ?? 'Failed to select recording folder.');
    }
  }

  /**
   * Retrieve the persisted SAF folder URI and name.
   */
  static async getPersistedFolder(): Promise<SelectedFolder | null> {
    if (Platform.OS !== 'android' || !RecordingScanner?.getPersistedFolder) {
      return null;
    }

    try {
      const folder = await RecordingScanner.getPersistedFolder();
      return folder || null;
    } catch {
      return null;
    }
  }

  /**
   * Release and clear persisted folder permissions.
   */
  static async clearPersistedFolder(): Promise<boolean> {
    if (Platform.OS !== 'android' || !RecordingScanner?.clearPersistedFolder) {
      return true;
    }

    try {
      return await RecordingScanner.clearPersistedFolder();
    } catch {
      return false;
    }
  }

  /**
   * Scan recordings directly inside a user-selected SAF folder URI.
   */
  static async scanFolderUri(treeUri: string): Promise<DiscoveredRecording[]> {
    if (Platform.OS !== 'android' || !RecordingScanner?.scanFolderUri) {
      return [];
    }

    try {
      const results: DiscoveredRecording[] =
        await RecordingScanner.scanFolderUri(treeUri);
      return results;
    } catch (error: any) {
      throw new Error(
        error?.message ?? 'Failed to scan the selected recording folder.',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Device Call Log Permissions
  // ─────────────────────────────────────────────────────────────

  /**
   * Check whether READ_CALL_LOG permission is granted.
   */
  static async checkCallLogPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      if (RecordingScanner?.checkCallLogPermission) {
        return await RecordingScanner.checkCallLogPermission();
      }
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      );
    } catch {
      return false;
    }
  }

  /**
   * Request device READ_CALL_LOG permission to enrich recordings with contact info.
   */
  static async requestCallLogPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        {
          title: 'Device Call Log Access',
          message:
            'Audify AI uses device call logs to automatically associate caller names, phone numbers, and call direction with your audio recordings.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  /**
   * Helper to format seconds into mm:ss or hh:mm:ss.
   */
  static formatDuration(seconds: number): string {
    const totalSecs = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const hours = Math.floor(mins / 60);

    if (hours > 0) {
      const remainingMins = mins % 60;
      return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Convert a DiscoveredRecording into a full CallRecord object with CallLog matched metadata.
   */
  static discoveredToCallRecord(r: DiscoveredRecording): CallRecord {
    const isIncoming = r.callType === 'incoming';
    const fallbackCaller = isIncoming
      ? r.contactName || r.phoneNumber || 'Caller'
      : 'Telecaller';
    const fallbackReceiver = isIncoming
      ? 'Telecaller'
      : r.contactName || r.phoneNumber || 'Customer';

    return {
      id: r.id,
      name: r.contactName || r.phoneNumber || r.fileName,
      phoneNumber: r.phoneNumber || 'Unknown Number',
      date: r.createdAt.split('T')[0],
      time: new Date(r.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      from: r.from || fallbackCaller,
      to: r.to || fallbackReceiver,
      callType:
        isIncoming
          ? 'Incoming'
          : r.callType === 'outgoing'
          ? 'Outgoing'
          : 'Unknown',
      duration: this.formatDuration(r.duration),
      durationSeconds: Math.round(r.duration),
      language: 'Pending Detection',
      transcript: null,
      transcriptPreview: 'Audio recording discovered. Ready for transcription.',
      driveUrl: null,
      driveFileId: null,
      recordingUri: r.fileUri,
      recordingFileName: r.fileName,
      status: 'DISCOVERED',
      createdAt: r.createdAt,
      processedAt: null,
      sheetRowId: null,
      recordingHash: null,
      fileSizeBytes: r.fileSizeBytes,
      fileModifiedAt: new Date(r.timestamp).toISOString(),
      matchedWithCallLog: r.matchedWithCallLog ?? false,
    };
  }
}
