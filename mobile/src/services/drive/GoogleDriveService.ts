// TeleCaller AI — Google Drive Service (Phase 7)
// Manages Google Drive OAuth authentication, folder structure,
// duplicate prevention, and audio recording upload.

import {NativeModules, NativeEventEmitter} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {getTokens} from '../auth/AuthService';
import {
  DriveConnectionStatus,
  DriveUploadResult,
  DuplicateCheckResult,
  DriveUploadRecord,
} from '../../types/drive';
import {DiscoveredRecording} from '../../types/recordings';
import {CallRecord} from '../../types';

const {DriveUploader} = NativeModules;
const driveEmitter = DriveUploader ? new NativeEventEmitter(DriveUploader) : null;

const DRIVE_REGISTRY_STORAGE_KEY = 'telecaller_drive_upload_registry';
const FOLDER_CACHE_KEY = 'telecaller_drive_folder_cache';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export class GoogleDriveService {
  /**
   * Get valid OAuth access token for Google Drive API calls.
   */
  static async getAccessToken(): Promise<string> {
    try {
      const storedTokens = await getTokens();
      if (storedTokens?.accessToken) {
        return storedTokens.accessToken;
      }
      const freshTokens = await GoogleSignin.getTokens();
      return freshTokens.accessToken;
    } catch (error: any) {
      throw new Error(
        'Google Drive authorization missing. Please sign in with Google first.',
      );
    }
  }

  /**
   * Verify whether the app can connect to Google Drive with the current account.
   */
  static async checkDriveConnection(): Promise<DriveConnectionStatus> {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`${DRIVE_API_BASE}/about?fields=user`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        return 'connected';
      }
      return 'not_connected';
    } catch {
      return 'not_connected';
    }
  }

  /**
   * Helper to safely extract recording file name across DiscoveredRecording and CallRecord.
   */
  static getRecordingFileName(
    recording: DiscoveredRecording | CallRecord,
  ): string {
    if ('recordingFileName' in recording && recording.recordingFileName) {
      return recording.recordingFileName;
    }
    if ('fileName' in recording && (recording as any).fileName) {
      return (recording as any).fileName;
    }
    return `recording_${recording.id}.m4a`;
  }

  /**
   * Compute a reliable fingerprint/hash for duplicate prevention.
   */
  static getRecordingFingerprint(
    recording: DiscoveredRecording | CallRecord,
  ): string {
    const name = this.getRecordingFileName(recording);
    const size =
      ('fileSizeBytes' in recording ? recording.fileSizeBytes : null) || 0;
    const date = ('createdAt' in recording ? recording.createdAt : null) || '';
    return `${name}_${size}_${date}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Retrieve or create a folder in Google Drive.
   * If a folder with the same name already exists in parent, reuses it (never duplicates).
   */
  static async getOrCreateFolder(
    folderName: string,
    parentId?: string,
  ): Promise<string> {
    const token = await this.getAccessToken();

    // 1. Search for existing folder
    const parentQuery = parentId ? `'${parentId}' in parents` : `'root' in parents`;
    const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${parentQuery}`;
    const searchUrl = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
      query,
    )}&fields=files(id,name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: {Authorization: `Bearer ${token}`},
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // 2. Create folder if not found
    const createRes = await fetch(`${DRIVE_API_BASE}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create Drive folder "${folderName}": ${err}`);
    }

    const created = await createRes.json();
    return created.id;
  }

  /**
   * Ensures the mandatory folder structure:
   * TeleCaller AI/
   *   Recordings/
   *     YYYY/
   *       MM/
   *         DD/
   *   Call Records/
   */
  static async ensureFolderHierarchy(
    targetDate: Date = new Date(),
  ): Promise<{
    rootFolderId: string;
    recordingsFolderId: string;
    dateFolderId: string;
    callRecordsFolderId: string;
  }> {
    // 1. Root folder: "TeleCaller AI"
    const rootFolderId = await this.getOrCreateFolder('TeleCaller AI');

    // 2. "Call Records" folder
    const callRecordsFolderId = await this.getOrCreateFolder(
      'Call Records',
      rootFolderId,
    );

    // 3. "Recordings" folder
    const recordingsFolderId = await this.getOrCreateFolder(
      'Recordings',
      rootFolderId,
    );

    // 4. Date-based hierarchy: YYYY / MM / DD
    const yearStr = targetDate.getFullYear().toString();
    const monthStr = (targetDate.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = targetDate.getDate().toString().padStart(2, '0');

    const yearFolderId = await this.getOrCreateFolder(
      yearStr,
      recordingsFolderId,
    );
    const monthFolderId = await this.getOrCreateFolder(
      monthStr,
      yearFolderId,
    );
    const dateFolderId = await this.getOrCreateFolder(
      dayStr,
      monthFolderId,
    );

    return {
      rootFolderId,
      recordingsFolderId,
      dateFolderId,
      callRecordsFolderId,
    };
  }

  /**
   * Duplicate Prevention:
   * Checks both local registry and remote Drive target folder to ensure
   * a recording is NEVER uploaded twice.
   */
  static async checkDuplicate(
    recording: DiscoveredRecording | CallRecord,
    targetFolderId?: string,
  ): Promise<DuplicateCheckResult> {
    const fingerprint = this.getRecordingFingerprint(recording);

    // 1. Check local upload registry
    const registry = await this.getUploadRegistry();
    if (registry[fingerprint] || registry[recording.id]) {
      const match = registry[fingerprint] || registry[recording.id];
      return {
        isDuplicate: true,
        existingFileId: match.driveFileId,
        existingUrl: match.driveUrl,
        reason: 'Recording was previously uploaded to Google Drive.',
      };
    }

    // 2. Check remote Google Drive target folder if folder ID provided
    if (targetFolderId) {
      try {
        const token = await this.getAccessToken();
        const fileName = this.getRecordingFileName(recording);
        if (fileName) {
          const query = `name = '${fileName}' and '${targetFolderId}' in parents and trashed = false`;
          const checkUrl = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
            query,
          )}&fields=files(id,name,webViewLink)`;
          const res = await fetch(checkUrl, {
            headers: {Authorization: `Bearer ${token}`},
          });
          if (res.ok) {
            const data = await res.json();
            if (data.files && data.files.length > 0) {
              const file = data.files[0];
              return {
                isDuplicate: true,
                existingFileId: file.id,
                existingUrl: file.webViewLink,
                reason: 'File already exists in Google Drive target folder.',
              };
            }
          }
        }
      } catch {}
    }

    return {isDuplicate: false};
  }

  /**
   * Upload an audio recording to Google Drive.
   * Automatically handles:
   * - Duplicate detection & prevention
   * - Folder creation & hierarchy
   * - Streaming upload
   * - Local registry update
   */
  static async uploadRecording(
    recording: DiscoveredRecording | CallRecord,
    onProgress?: (percent: number) => void,
  ): Promise<DriveUploadResult> {
    const fileUri =
      ('recordingUri' in recording ? recording.recordingUri : null) ||
      ('fileUri' in recording ? (recording as any).fileUri : null) ||
      ('filePath' in recording ? (recording as any).filePath : null);

    const fileName = this.getRecordingFileName(recording);

    const mimeType =
      ('mimeType' in recording ? (recording as any).mimeType : null) ||
      'audio/m4a';

    if (!fileUri) {
      throw new Error('Recording file URI is missing.');
    }

    const token = await this.getAccessToken();

    // 1. Ensure Folder Hierarchy
    let recordingDate = new Date();
    if ('createdAt' in recording && recording.createdAt) {
      try {
        recordingDate = new Date(recording.createdAt);
      } catch {}
    }
    const {dateFolderId} = await this.ensureFolderHierarchy(recordingDate);

    // 2. Duplicate Prevention Check
    const dupCheck = await this.checkDuplicate(recording, dateFolderId);
    if (dupCheck.isDuplicate && dupCheck.existingFileId && dupCheck.existingUrl) {
      const fingerprint = this.getRecordingFingerprint(recording);
      // Ensure it is cached in local registry
      await this.saveToRegistry({
        recordingId: recording.id,
        fileHash: fingerprint,
        fileName,
        fileSizeBytes: ('fileSizeBytes' in recording ? recording.fileSizeBytes : 0) || 0,
        fileModifiedAt: recordingDate.toISOString(),
        driveFileId: dupCheck.existingFileId,
        driveUrl: dupCheck.existingUrl,
        uploadedAt: new Date().toISOString(),
      });

      return {
        fileId: dupCheck.existingFileId,
        fileName,
        webViewLink: dupCheck.existingUrl,
        sizeBytes: ('fileSizeBytes' in recording ? recording.fileSizeBytes : 0) || 0,
        uploadedAt: new Date().toISOString(),
      };
    }

    // 3. Setup Progress Listener
    let progressSub: any = null;
    if (onProgress && driveEmitter) {
      progressSub = driveEmitter.addListener(
        'onDriveUploadProgress',
        (event: any) => {
          if (event.fileName === fileName && typeof event.progressPercent === 'number') {
            onProgress(event.progressPercent);
          }
        },
      );
    }

    try {
      // 4. Perform Upload via Native Streaming Module
      if (!DriveUploader?.uploadFileToDrive) {
        throw new Error('Native DriveUploader module is not available.');
      }

      const uploadResult = await DriveUploader.uploadFileToDrive(
        fileUri,
        fileName,
        dateFolderId,
        token,
        mimeType,
      );

      const result: DriveUploadResult = {
        fileId: uploadResult.fileId,
        fileName: uploadResult.fileName,
        webViewLink: uploadResult.webViewLink,
        sizeBytes: uploadResult.sizeBytes || 0,
        uploadedAt: new Date().toISOString(),
      };

      // 5. Store in Duplicate Registry
      const fingerprint = this.getRecordingFingerprint(recording);
      await this.saveToRegistry({
        recordingId: recording.id,
        fileHash: fingerprint,
        fileName,
        fileSizeBytes: result.sizeBytes,
        fileModifiedAt: recordingDate.toISOString(),
        driveFileId: result.fileId,
        driveUrl: result.webViewLink,
        uploadedAt: result.uploadedAt,
      });

      return result;
    } finally {
      progressSub?.remove();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Duplicate Registry Helpers
  // ─────────────────────────────────────────────────────────────

  static async getUploadRegistry(): Promise<Record<string, DriveUploadRecord>> {
    try {
      const data = await AsyncStorage.getItem(DRIVE_REGISTRY_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  static async saveToRegistry(record: DriveUploadRecord): Promise<void> {
    try {
      const registry = await this.getUploadRegistry();
      registry[record.fileHash] = record;
      registry[record.recordingId] = record;
      await AsyncStorage.setItem(
        DRIVE_REGISTRY_STORAGE_KEY,
        JSON.stringify(registry),
      );
    } catch {}
  }

  static async isRecordingUploaded(recordingId: string): Promise<boolean> {
    const registry = await this.getUploadRegistry();
    return Boolean(registry[recordingId]);
  }

  static async getUploadedRecord(
    recordingId: string,
  ): Promise<DriveUploadRecord | null> {
    const registry = await this.getUploadRegistry();
    return registry[recordingId] || null;
  }
}
