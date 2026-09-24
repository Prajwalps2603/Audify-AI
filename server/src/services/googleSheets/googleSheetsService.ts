// TeleCaller AI — Server Google Sheets Service (Phase 8)
// Backend service for handling Google Sheets creation, duplicate verification,
// header formatting, and automated row insertion.

export interface ServerSheetRow {
  callId: string;
  name: string;
  phoneNumber: string;
  date: string;
  time: string;
  from: string;
  to: string;
  callType: string;
  duration: string;
  language: string;
  driveUrl?: string;
  transcript?: string;
  status: string;
  processedAt?: string;
}

export interface ServerSheetSyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowNumber: number;
  isDuplicate: boolean;
  syncedAt: string;
}

export const SERVER_SHEETS_CONFIG = {
  SPREADSHEET_TITLE: 'TeleCaller AI - Call Records',
  SHEET_NAME: 'Call Records',
  HEADERS: [
    'Call ID',           // Col A
    'Name',              // Col B
    'Phone Number',      // Col C
    'Date',              // Col D
    'Time',              // Col E
    'From',              // Col F
    'To',                // Col G
    'Call Type',         // Col H
    'Duration',          // Col I
    'Language',          // Col J
    'Google Drive URL',  // Col K
    'Transcript',        // Col L
    'Processing Status', // Col M
    'Processed At',      // Col N
  ],
};

export class ServerGoogleSheetsService {
  private static SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
  private static DRIVE_API = 'https://www.googleapis.com/drive/v3';

  /**
   * Search or create the "TeleCaller AI - Call Records" spreadsheet in Google Drive.
   */
  static async getOrCreateSpreadsheet(
    accessToken: string,
    parentFolderId?: string,
  ): Promise<{spreadsheetId: string; spreadsheetUrl: string}> {
    const parentQuery = parentFolderId
      ? `'${parentFolderId}' in parents and `
      : '';
    const q = `${parentQuery}name = '${SERVER_SHEETS_CONFIG.SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    const searchUrl = `${this.DRIVE_API}/files?q=${encodeURIComponent(
      q,
    )}&fields=files(id,name,webViewLink)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: {Authorization: `Bearer ${accessToken}`},
    });

    if (searchRes.ok) {
      const data: any = await searchRes.json();
      if (data.files && data.files.length > 0) {
        const file = data.files[0];
        return {
          spreadsheetId: file.id,
          spreadsheetUrl:
            file.webViewLink ||
            `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
        };
      }
    }

    // Create new spreadsheet
    const createRes = await fetch(this.SHEETS_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: SERVER_SHEETS_CONFIG.SPREADSHEET_TITLE,
        },
        sheets: [
          {
            properties: {
              title: SERVER_SHEETS_CONFIG.SHEET_NAME,
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

    const created: any = await createRes.json();
    const spreadsheetId: string = created.spreadsheetId;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // Move to parent folder if specified
    if (parentFolderId) {
      try {
        await fetch(
          `${this.DRIVE_API}/files/${spreadsheetId}?addParents=${parentFolderId}&fields=id,parents`,
          {
            method: 'PATCH',
            headers: {Authorization: `Bearer ${accessToken}`},
          },
        );
      } catch {}
    }

    // Initialize Header row
    await this.initializeHeaders(spreadsheetId, accessToken);

    return {spreadsheetId, spreadsheetUrl};
  }

  /**
   * Initializes header row with formatting.
   */
  static async initializeHeaders(
    spreadsheetId: string,
    accessToken: string,
  ): Promise<void> {
    const range = `${encodeURIComponent(SERVER_SHEETS_CONFIG.SHEET_NAME)}!A1:N1`;
    const updateUrl = `${this.SHEETS_API}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

    await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${SERVER_SHEETS_CONFIG.SHEET_NAME}!A1:N1`,
        majorDimension: 'ROWS',
        values: [SERVER_SHEETS_CONFIG.HEADERS],
      }),
    });

    // Format headers with styling
    try {
      await fetch(`${this.SHEETS_API}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
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
                    backgroundColor: {red: 0.145, green: 0.388, blue: 0.922},
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
   * Checks if Call ID already exists in Column A to prevent duplicates.
   */
  static async checkDuplicateRecord(
    spreadsheetId: string,
    callId: string,
    accessToken: string,
  ): Promise<{isDuplicate: boolean; rowNumber?: number}> {
    const range = `${encodeURIComponent(SERVER_SHEETS_CONFIG.SHEET_NAME)}!A:A`;
    const res = await fetch(
      `${this.SHEETS_API}/${spreadsheetId}/values/${range}`,
      {
        headers: {Authorization: `Bearer ${accessToken}`},
      },
    );

    if (res.ok) {
      const data: any = await res.json();
      if (data.values && Array.isArray(data.values)) {
        const index = data.values.findIndex(
          (row: string[]) => row && row[0] === callId,
        );
        if (index !== -1) {
          return {isDuplicate: true, rowNumber: index + 1};
        }
      }
    }

    return {isDuplicate: false};
  }

  /**
   * Appends call record row to Google Sheets.
   */
  static async appendCallRecord(
    spreadsheetId: string,
    record: ServerSheetRow,
    accessToken: string,
  ): Promise<ServerSheetSyncResult> {
    const dupCheck = await this.checkDuplicateRecord(
      spreadsheetId,
      record.callId,
      accessToken,
    );

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    if (dupCheck.isDuplicate && dupCheck.rowNumber) {
      return {
        spreadsheetId,
        spreadsheetUrl,
        rowNumber: dupCheck.rowNumber,
        isDuplicate: true,
        syncedAt: new Date().toISOString(),
      };
    }

    const rowValues = [
      record.callId,
      record.name,
      record.phoneNumber,
      record.date,
      record.time,
      record.from,
      record.to,
      record.callType,
      record.duration,
      record.language,
      record.driveUrl || '',
      record.transcript || '',
      record.status,
      record.processedAt || new Date().toISOString(),
    ];

    const range = `${encodeURIComponent(SERVER_SHEETS_CONFIG.SHEET_NAME)}!A:N`;
    const appendUrl = `${this.SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to append row to Google Sheet: ${err}`);
    }

    const appendData: any = await res.json();
    let rowNumber = 2;
    if (appendData.updates && appendData.updates.updatedRange) {
      const match = appendData.updates.updatedRange.match(/!A(\d+):/);
      if (match && match[1]) {
        rowNumber = parseInt(match[1], 10);
      }
    }

    return {
      spreadsheetId,
      spreadsheetUrl,
      rowNumber,
      isDuplicate: false,
      syncedAt: new Date().toISOString(),
    };
  }
}
