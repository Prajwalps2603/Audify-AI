// TeleCaller AI — Google Sheets Service
// Manages Google Sheets OAuth authentication, spreadsheet discovery/creation,
// duplicate protection, and automated row appending.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {getTokens} from '../auth/AuthService';
import {GoogleDriveService} from '../drive/GoogleDriveService';
import {
  SheetsConnectionStatus,
  SheetRecord,
  SheetSyncResult,
  SpreadsheetInfo,
  SHEETS_CONFIG,
} from '../../types/sheets';
import {CallRecord} from '../../types';

const SHEETS_REGISTRY_KEY = 'telecaller_sheets_sync_registry';
const SPREADSHEET_CACHE_KEY = 'telecaller_sheets_spreadsheet_cache';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export class GoogleSheetsService {
  /**
   * Get valid OAuth access token for Google Sheets API calls.
   */
  static async getAccessToken(): Promise<string> {
    try {
      const storedTokens = await getTokens();
      if (storedTokens?.accessToken) {
        return storedTokens.accessToken;
      }
      const freshTokens = await GoogleSignin.getTokens();
      return freshTokens.accessToken;
    } catch {
      throw new Error(
        'Google Sheets authorization missing. Please sign in with Google first.',
      );
    }
  }

  /**
   * Verify whether the app can connect to Google Sheets with the current account.
   */
  static async checkSheetsConnection(): Promise<SheetsConnectionStatus> {
    try {
      const token = await this.getAccessToken();
      // Test connectivity by querying Google Drive for spreadsheet files
      const q = `mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
      const res = await fetch(
        `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&pageSize=1&fields=files(id)`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      if (res.ok) {
        return 'connected';
      }
      return 'not_connected';
    } catch {
      return 'not_connected';
    }
  }

  /**
   * Discovers existing "TeleCaller AI - Call Records" spreadsheet or creates it.
   * Ensures the header row (Columns A through N) is initialized and formatted.
   */
  static async getOrCreateSpreadsheet(): Promise<SpreadsheetInfo> {
    const token = await this.getAccessToken();

    // 1. Check local cache first
    try {
      const cached = await AsyncStorage.getItem(SPREADSHEET_CACHE_KEY);
      if (cached) {
        const info: SpreadsheetInfo = JSON.parse(cached);
        // Verify spreadsheet still exists
        const verifyRes = await fetch(`${SHEETS_API_BASE}/${info.spreadsheetId}?fields=spreadsheetId,properties/title`, {
          headers: {Authorization: `Bearer ${token}`},
        });
        if (verifyRes.ok) {
          return info;
        }
      }
    } catch {}

    // 2. Search Google Drive for existing spreadsheet by title
    const searchQ = `name = '${SHEETS_CONFIG.SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    const searchRes = await fetch(
      `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
        searchQ,
      )}&fields=files(id,name,webViewLink)&spaces=drive`,
      {
        headers: {Authorization: `Bearer ${token}`},
      },
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const file = searchData.files[0];
        const info: SpreadsheetInfo = {
          spreadsheetId: file.id,
          spreadsheetUrl:
            file.webViewLink ||
            `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
          title: SHEETS_CONFIG.SPREADSHEET_TITLE,
          sheetName: SHEETS_CONFIG.SHEET_NAME,
        };
        await AsyncStorage.setItem(SPREADSHEET_CACHE_KEY, JSON.stringify(info));
        return info;
      }
    }

    // 3. Create new spreadsheet if not found
    const createRes = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: SHEETS_CONFIG.SPREADSHEET_TITLE,
        },
        sheets: [
          {
            properties: {
              title: SHEETS_CONFIG.SHEET_NAME,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create Google Spreadsheet: ${err}`);
    }

    const createdSheet = await createRes.json();
    const spreadsheetId: string = createdSheet.spreadsheetId;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // 4. Move spreadsheet into Google Drive "Audify AI/Call Records" folder if available
    try {
      const driveHierarchy = await GoogleDriveService.ensureFolderHierarchy();
      if (driveHierarchy?.callRecordsFolderId) {
        await fetch(
          `${DRIVE_API_BASE}/files/${spreadsheetId}?addParents=${driveHierarchy.callRecordsFolderId}&fields=id,parents`,
          {
            method: 'PATCH',
            headers: {Authorization: `Bearer ${token}`},
          },
        );
      }
    } catch {}

    // 5. Initialize Header Row (A1:N1)
    await this.initializeHeaders(spreadsheetId, token);

    const result: SpreadsheetInfo = {
      spreadsheetId,
      spreadsheetUrl,
      title: SHEETS_CONFIG.SPREADSHEET_TITLE,
      sheetName: SHEETS_CONFIG.SHEET_NAME,
    };

    await AsyncStorage.setItem(SPREADSHEET_CACHE_KEY, JSON.stringify(result));
    return result;
  }

  /**
   * Initializes header row with styled labels and formatting in Google Sheets.
   */
  private static async initializeHeaders(
    spreadsheetId: string,
    token: string,
  ): Promise<void> {
    const range = `${encodeURIComponent(SHEETS_CONFIG.SHEET_NAME)}!A1:N1`;
    const updateUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

    await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${SHEETS_CONFIG.SHEET_NAME}!A1:N1`,
        majorDimension: 'ROWS',
        values: [SHEETS_CONFIG.HEADERS],
      }),
    });

    // Apply header style formatting (Bold, Blue Background, White Text)
    try {
      await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 14,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {red: 0.145, green: 0.388, blue: 0.922}, // #2563EB
                    textFormat: {
                      bold: true,
                      foregroundColor: {red: 1.0, green: 1.0, blue: 1.0},
                    },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
              },
            },
          ],
        }),
      });
    } catch {}
  }

  /**
   * Duplicate Protection: Checks if the call record was already recorded in Google Sheets.
   * Performs a double-check against local registry and remote Column A (Call IDs).
   */
  static async checkDuplicateRecord(
    callId: string,
    spreadsheetId?: string,
  ): Promise<{
    isDuplicate: boolean;
    rowNumber?: number;
    spreadsheetId?: string;
    spreadsheetUrl?: string;
  }> {
    // 1. Check local registry
    const registry = await this.getSyncRegistry();
    if (registry[callId]) {
      const match = registry[callId];
      return {
        isDuplicate: true,
        rowNumber: match.rowNumber,
        spreadsheetId: match.spreadsheetId,
        spreadsheetUrl: match.spreadsheetUrl,
      };
    }

    // 2. Check remote Google Sheet Column A (Call ID column)
    if (spreadsheetId) {
      try {
        const token = await this.getAccessToken();
        const range = `${encodeURIComponent(SHEETS_CONFIG.SHEET_NAME)}!A:A`;
        const res = await fetch(
          `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`,
          {
            headers: {Authorization: `Bearer ${token}`},
          },
        );

        if (res.ok) {
          const data = await res.json();
          if (data.values && Array.isArray(data.values)) {
            // Find index of matching call ID
            const index = data.values.findIndex(
              (row: string[]) => row && row[0] === callId,
            );
            if (index !== -1) {
              const rowNumber = index + 1;
              const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
              // Cache match locally
              await this.saveToRegistry({
                callId,
                spreadsheetId,
                spreadsheetUrl,
                rowNumber,
                syncedAt: new Date().toISOString(),
              });
              return {
                isDuplicate: true,
                rowNumber,
                spreadsheetId,
                spreadsheetUrl,
              };
            }
          }
        }
      } catch {}
    }

    return {isDuplicate: false};
  }

  /**
   * Extracts clean transcript text from CallRecord.
   */
  private static getTranscriptText(call: CallRecord): string {
    if (call.transcript && call.transcript.length > 0) {
      return call.transcript
        .map(
          seg =>
            `[${seg.timestamp || '00:00'}] ${seg.speakerLabel}: ${seg.text}`,
        )
        .join('\n');
    }
    return call.transcriptPreview || 'Transcript not available';
  }

  /**
   * Automatically append a CallRecord as a new row in Google Sheets.
   * Strict Rule: Automatic insertion upon recording processing completion.
   * Duplicate Protection: Checks both local registry and remote Column A.
   */
  static async appendCallRecord(
    call: CallRecord,
    driveUrlOverride?: string,
  ): Promise<SheetSyncResult> {
    const spreadsheet = await this.getOrCreateSpreadsheet();
    const spreadsheetId = spreadsheet.spreadsheetId;
    const spreadsheetUrl = spreadsheet.spreadsheetUrl;

    // Duplicate Check
    const dupCheck = await this.checkDuplicateRecord(call.id, spreadsheetId);
    if (dupCheck.isDuplicate && dupCheck.rowNumber) {
      return {
        spreadsheetId,
        spreadsheetUrl,
        rowNumber: dupCheck.rowNumber,
        isDuplicate: true,
        syncedAt: new Date().toISOString(),
      };
    }

    const token = await this.getAccessToken();

    // Map exact columns A through N:
    // A - Call ID
    // B - Name
    // C - Phone Number
    // D - Date
    // E - Time
    // F - From
    // G - To
    // H - Call Type
    // I - Duration
    // J - Language
    // K - Google Drive URL
    // L - Transcript
    // M - Processing Status
    // N - Processed At
    const rowValues = [
      call.id,
      call.name,
      call.phoneNumber,
      call.date,
      call.time,
      call.from,
      call.to,
      call.callType,
      call.duration,
      call.language,
      driveUrlOverride || call.driveUrl || '',
      this.getTranscriptText(call),
      call.status,
      call.processedAt || new Date().toISOString(),
    ];

    const range = `${encodeURIComponent(SHEETS_CONFIG.SHEET_NAME)}!A:N`;
    const appendUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to append call record to Google Sheet: ${err}`);
    }

    const appendData = await res.json();
    let rowNumber = 2; // Default to row 2 if single data row

    // Parse updatedRange e.g. "Call Records!A2:N2"
    if (appendData.updates && appendData.updates.updatedRange) {
      const match = appendData.updates.updatedRange.match(/!A(\d+):/);
      if (match && match[1]) {
        rowNumber = parseInt(match[1], 10);
      }
    }

    const now = new Date().toISOString();
    const result: SheetSyncResult = {
      spreadsheetId,
      spreadsheetUrl,
      rowNumber,
      isDuplicate: false,
      syncedAt: now,
    };

    // Save to local sync registry
    await this.saveToRegistry({
      callId: call.id,
      recordingId: call.id,
      spreadsheetId,
      spreadsheetUrl,
      rowNumber,
      syncedAt: now,
    });

    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Local Registry Helpers
  // ─────────────────────────────────────────────────────────────

  static async getSyncRegistry(): Promise<Record<string, SheetRecord>> {
    try {
      const data = await AsyncStorage.getItem(SHEETS_REGISTRY_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  static async saveToRegistry(record: SheetRecord): Promise<void> {
    try {
      const registry = await this.getSyncRegistry();
      registry[record.callId] = record;
      if (record.recordingId) {
        registry[record.recordingId] = record;
      }
      await AsyncStorage.setItem(
        SHEETS_REGISTRY_KEY,
        JSON.stringify(registry),
      );
    } catch {}
  }

  static async isCallSynced(callId: string): Promise<boolean> {
    const registry = await this.getSyncRegistry();
    return Boolean(registry[callId]);
  }

  static async getSyncedRecord(callId: string): Promise<SheetRecord | null> {
    const registry = await this.getSyncRegistry();
    return registry[callId] || null;
  }
}
