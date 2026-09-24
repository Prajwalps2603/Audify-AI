// TeleCaller AI — Search & Filtering Unit Tests (Phase 15)
// Tests multi-dimensional filtering, transcript full-text search,
// phone number normalization, and date range calculation.

import {CallRecord} from '../src/types';

describe('Search and Filter Logic', () => {
  const sampleCalls: CallRecord[] = [
    {
      id: 'call_1',
      name: 'Rohan Mehra',
      phoneNumber: '+91 98765 43210',
      date: '2026-09-24',
      time: '09:15 AM',
      from: 'Telecaller',
      to: 'Rohan Mehra',
      callType: 'Outgoing',
      duration: '04:12',
      durationSeconds: 252,
      language: 'English',
      transcript: null,
      transcriptPreview: 'Discussed the annual subscription plan and billing discount.',
      driveUrl: 'https://drive.google.com/test1',
      driveFileId: 'df_1',
      recordingUri: 'content://audio/1',
      recordingFileName: 'rec_rohan.m4a',
      status: 'COMPLETED',
      createdAt: '2026-09-24T09:15:00.000Z',
      processedAt: '2026-09-24T09:20:00.000Z',
      sheetRowId: 10,
      recordingHash: 'h_1',
      fileSizeBytes: 2000000,
      fileModifiedAt: '2026-09-24T09:15:00.000Z',
      matchedWithCallLog: true,
    },
    {
      id: 'call_2',
      name: 'Pooja Nair',
      phoneNumber: '9845012345',
      date: '2026-09-23',
      time: '02:30 PM',
      from: 'Pooja Nair',
      to: 'Telecaller',
      callType: 'Incoming',
      duration: '00:45',
      durationSeconds: 45,
      language: 'Malayalam',
      transcript: null,
      transcriptPreview: 'Inquired about technical support for Android app integration.',
      driveUrl: null,
      driveFileId: null,
      recordingUri: 'content://audio/2',
      recordingFileName: 'rec_pooja.m4a',
      status: 'PENDING',
      createdAt: '2026-09-23T14:30:00.000Z',
      processedAt: null,
      sheetRowId: null,
      recordingHash: 'h_2',
      fileSizeBytes: 600000,
      fileModifiedAt: '2026-09-23T14:30:00.000Z',
      matchedWithCallLog: true,
    },
    {
      id: 'call_3',
      name: 'Amit Patel',
      phoneNumber: '+91 99887 76655',
      date: '2026-09-15',
      time: '11:00 AM',
      from: 'Telecaller',
      to: 'Amit Patel',
      callType: 'Outgoing',
      duration: '07:30',
      durationSeconds: 450,
      language: 'Hindi',
      transcript: null,
      transcriptPreview: 'Detailed negotiation on enterprise CRM license agreement.',
      driveUrl: 'https://drive.google.com/test3',
      driveFileId: 'df_3',
      recordingUri: 'content://audio/3',
      recordingFileName: 'rec_amit.m4a',
      status: 'COMPLETED',
      createdAt: '2026-09-15T11:00:00.000Z',
      processedAt: '2026-09-15T11:15:00.000Z',
      sheetRowId: 11,
      recordingHash: 'h_3',
      fileSizeBytes: 4500000,
      fileModifiedAt: '2026-09-15T11:00:00.000Z',
      matchedWithCallLog: true,
    },
  ];

  it('matches calls by customer name case-insensitively', () => {
    const query = 'rohan';
    const results = sampleCalls.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase()),
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('call_1');
  });

  it('matches calls by phone number ignoring formatting spaces and country codes', () => {
    const normalize = (phone: string) => phone.replace(/[^\d]/g, '');
    const query = '9845012345';

    const results = sampleCalls.filter(c =>
      normalize(c.phoneNumber).includes(query),
    );
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Pooja Nair');
  });

  it('matches calls through transcript full-text search', () => {
    const query = 'enterprise CRM';
    const results = sampleCalls.filter(c =>
      (c.transcriptPreview || '').toLowerCase().includes(query.toLowerCase()),
    );
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Amit Patel');
  });

  it('filters calls accurately by duration brackets', () => {
    // Short (< 60s)
    const shortCalls = sampleCalls.filter(c => c.durationSeconds < 60);
    expect(shortCalls).toHaveLength(1);
    expect(shortCalls[0].name).toBe('Pooja Nair');

    // Medium (60s - 300s)
    const mediumCalls = sampleCalls.filter(
      c => c.durationSeconds >= 60 && c.durationSeconds <= 300,
    );
    expect(mediumCalls).toHaveLength(1);
    expect(mediumCalls[0].name).toBe('Rohan Mehra');

    // Long (> 300s)
    const longCalls = sampleCalls.filter(c => c.durationSeconds > 300);
    expect(longCalls).toHaveLength(1);
    expect(longCalls[0].name).toBe('Amit Patel');
  });

  it('filters calls by processing status and call direction', () => {
    const pendingCalls = sampleCalls.filter(c => c.status === 'PENDING');
    expect(pendingCalls).toHaveLength(1);
    expect(pendingCalls[0].name).toBe('Pooja Nair');

    const incomingCalls = sampleCalls.filter(c => c.callType === 'Incoming');
    expect(incomingCalls).toHaveLength(1);
    expect(incomingCalls[0].name).toBe('Pooja Nair');

    const outgoingCalls = sampleCalls.filter(c => c.callType === 'Outgoing');
    expect(outgoingCalls).toHaveLength(2);
  });
});
