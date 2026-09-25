// TeleCaller AI — Google Sheets Types

export type SheetsConnectionStatus =
  | 'connected'
  | 'not_connected'
  | 'checking'
  | 'error';

export interface SheetRecord {
  callId: string;
  recordingId?: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowNumber: number;
  syncedAt: string;
}

export interface SheetSyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowNumber: number;
  isDuplicate: boolean;
  syncedAt: string;
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheetName: string;
  rowCount?: number;
}

export const SHEETS_CONFIG = {
  SPREADSHEET_TITLE: 'Audify AI - Call Records',
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
  ] as const,
};
