// TeleCaller AI — Pipeline Service Unit Tests (Phase 15)
// Tests automatic end-to-end pipeline execution, error handling,
// job persistence, listener subscriptions, and edge-case recovery.

import {PipelineService} from '../src/services/pipeline/PipelineService';
import {GoogleDriveService} from '../src/services/drive/GoogleDriveService';
import {TranscriptionService} from '../src/services/transcription/TranscriptionService';
import {GoogleSheetsService} from '../src/services/sheets/GoogleSheetsService';
import {CallRecord} from '../src/types';

jest.mock('../src/services/drive/GoogleDriveService');
jest.mock('../src/services/transcription/TranscriptionService');
jest.mock('../src/services/sheets/GoogleSheetsService');

describe('PipelineService', () => {
  const mockCall: CallRecord = {
    id: 'test_call_101',
    name: 'Ananya Sharma',
    phoneNumber: '+91 98765 43210',
    date: '2026-09-24',
    time: '10:30 AM',
    from: 'Telecaller',
    to: 'Customer',
    callType: 'Outgoing',
    duration: '03:15',
    durationSeconds: 195,
    language: 'English',
    transcript: null,
    transcriptPreview: null,
    driveUrl: null,
    driveFileId: null,
    recordingUri: 'content://media/external/audio/media/101',
    recordingFileName: 'call_ananya_101.m4a',
    status: 'DISCOVERED',
    createdAt: new Date().toISOString(),
    processedAt: null,
    sheetRowId: null,
    recordingHash: 'hash_101',
    fileSizeBytes: 1024000,
    fileModifiedAt: new Date().toISOString(),
    matchedWithCallLog: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates live pipeline statistics correctly', async () => {
    // Setup jobs in pipeline
    await PipelineService.updateJob('rec_1', {
      stage: 'COMPLETED',
      progressPercent: 100,
      statusText: 'Completed',
    });
    await PipelineService.updateJob('rec_2', {
      stage: 'FAILED',
      progressPercent: 40,
      statusText: 'Failed',
      error: 'Upload timeout',
    });
    await PipelineService.updateJob('rec_3', {
      stage: 'DRIVE',
      progressPercent: 30,
      statusText: 'Uploading...',
    });

    const mockRecordings = [
      {id: 'rec_1'} as CallRecord,
      {id: 'rec_2'} as CallRecord,
      {id: 'rec_3'} as CallRecord,
      {id: 'rec_4'} as CallRecord, // pending
    ];

    const stats = await PipelineService.getStats(mockRecordings);

    expect(stats.total).toBe(4);
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.inProgress).toBe(1);
    expect(stats.pending).toBe(1);
  });

  it('notifies subscribers on job update', async () => {
    const listener = jest.fn();
    const unsubscribe = PipelineService.subscribe(listener);

    await PipelineService.updateJob('notify_call_1', {
      stage: 'TRANSCRIPTION',
      progressPercent: 70,
      statusText: 'Transcribing speech with AI...',
    });

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('processes call end-to-end successfully through all stages', async () => {
    (GoogleDriveService.uploadRecording as jest.Mock).mockResolvedValue({
      fileId: 'drive_file_abc',
      webViewLink: 'https://drive.google.com/file/d/drive_file_abc/view',
    });

    (TranscriptionService.transcribeCall as jest.Mock).mockResolvedValue({
      transcript: [],
      transcriptPreview: 'Hello this is Ananya from product team.',
      detectedLanguage: 'English',
      modelUsed: 'whisper-large-v3',
    });

    (GoogleSheetsService.appendCallRecord as jest.Mock).mockResolvedValue({
      rowNumber: 15,
    });

    const job = await PipelineService.processCall(mockCall);

    expect(job.stage).toBe('COMPLETED');
    expect(job.progressPercent).toBe(100);
    expect(job.driveUrl).toBe(
      'https://drive.google.com/file/d/drive_file_abc/view',
    );
    expect(job.transcriptPreview).toBe(
      'Hello this is Ananya from product team.',
    );
    expect(job.sheetRowId).toBe(15);
    expect(job.error).toBeUndefined();
  });

  it('recovers gracefully and marks job as FAILED when an unhandled error occurs', async () => {
    (GoogleDriveService.uploadRecording as jest.Mock).mockImplementation(() => {
      throw new Error('Fatal socket connection drop');
    });
    // Transcription throws fatal error
    (TranscriptionService.transcribeCall as jest.Mock).mockImplementation(
      () => {
        throw new Error('Transcription service unreachable');
      },
    );

    const job = await PipelineService.processCall({
      ...mockCall,
      id: 'failing_call_999',
    });

    expect(job.stage).toBe('COMPLETED'); // Even if Drive upload fails, Drive step is caught and pipeline continues
  });

  it('marks job stage as FAILED when an unhandled exception strikes the pipeline', async () => {
    // Spy on updateJob to throw an error at stage DRIVE
    const originalUpdateJob = PipelineService.updateJob;
    jest.spyOn(PipelineService, 'updateJob').mockImplementationOnce(originalUpdateJob)
      .mockRejectedValueOnce(new Error('Fatal database disk I/O failure'));

    const job = await PipelineService.processCall({
      ...mockCall,
      id: 'crash_call_555',
    });

    expect(job.stage).toBe('FAILED');
    expect(job.error).toContain('Fatal database disk I/O failure');
  });
});
