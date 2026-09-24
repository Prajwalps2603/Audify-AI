// TeleCaller AI — Recording Scanner Service Unit Tests (Phase 15)
// Tests audio metadata transformation, duration formatting,
// permission checks, and CallLog correlation fallback.

import {RecordingScannerService} from '../src/services/scanner/RecordingScannerService';
import {DiscoveredRecording} from '../src/types/recordings';

describe('RecordingScannerService', () => {
  it('formats audio seconds into mm:ss accurately', () => {
    expect(RecordingScannerService.formatDuration(0)).toBe('0:00');
    expect(RecordingScannerService.formatDuration(45)).toBe('0:45');
    expect(RecordingScannerService.formatDuration(125)).toBe('2:05');
    expect(RecordingScannerService.formatDuration(3600)).toBe('1:00:00');
    expect(RecordingScannerService.formatDuration(3665)).toBe('1:01:05');
  });

  it('converts DiscoveredRecording into a complete CallRecord with caller attribution', () => {
    const discovered: DiscoveredRecording = {
      id: 'audio_probe_42',
      fileName: 'Call_recording_Rahul_20260924.m4a',
      fileUri: 'content://media/external/audio/media/42',
      filePath: '/storage/emulated/0/Recordings/Call_recording_Rahul_20260924.m4a',
      fileSizeBytes: 2048500,
      duration: 185,
      timestamp: 1790234000000,
      createdAt: '2026-09-24T10:15:00.000Z',
      mimeType: 'audio/mp4',
      discoverySource: 'media_store',
      phoneNumber: '+91 91234 56789',
      contactName: 'Rahul Verma',
      callType: 'incoming',
      matchedWithCallLog: true,
    };

    const callRecord = RecordingScannerService.discoveredToCallRecord(discovered);

    expect(callRecord.id).toBe('audio_probe_42');
    expect(callRecord.name).toBe('Rahul Verma');
    expect(callRecord.phoneNumber).toBe('+91 91234 56789');
    expect(callRecord.callType).toBe('Incoming');
    expect(callRecord.from).toBe('Rahul Verma');
    expect(callRecord.to).toBe('Telecaller');
    expect(callRecord.duration).toBe('3:05');
    expect(callRecord.durationSeconds).toBe(185);
    expect(callRecord.status).toBe('DISCOVERED');
    expect(callRecord.matchedWithCallLog).toBe(true);
    expect(callRecord.recordingFileName).toBe('Call_recording_Rahul_20260924.m4a');
  });

  it('handles recordings with missing contact name or call log info safely', () => {
    const unnamed: DiscoveredRecording = {
      id: 'audio_probe_43',
      fileName: 'rec_999.wav',
      fileUri: 'content://media/external/audio/media/43',
      filePath: '/storage/emulated/0/Recordings/rec_999.wav',
      fileSizeBytes: 500000,
      duration: 30,
      timestamp: 1790235000000,
      createdAt: '2026-09-24T11:00:00.000Z',
      mimeType: 'audio/wav',
      discoverySource: 'saf',
    };

    const callRecord = RecordingScannerService.discoveredToCallRecord(unnamed);

    expect(callRecord.name).toBe('rec_999.wav');
    expect(callRecord.phoneNumber).toBe('Unknown Number');
    expect(callRecord.callType).toBe('Unknown');
    expect(callRecord.duration).toBe('0:30');
    expect(callRecord.matchedWithCallLog).toBe(false);
  });

  it('checks audio and call log permissions via NativeModules', async () => {
    const audioPerm = await RecordingScannerService.checkPermissions();
    const callLogPerm = await RecordingScannerService.checkCallLogPermission();

    expect(typeof audioPerm).toBe('boolean');
    expect(typeof callLogPerm).toBe('boolean');
  });
});
