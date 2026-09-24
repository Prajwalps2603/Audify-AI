// TeleCaller AI — Automatic Pipeline Service (Phase 11)
// Coordinates the complete automated end-to-end processing pipeline:
// 1. DISCOVERY / MATCH: Match audio recording with Android Call Log & Contacts
// 2. DRIVE UPLOAD: Stream resumable upload to Google Drive (with duplicate check)
// 3. TRANSCRIPTION: Diarize conversation, extract timestamps & detect language
// 4. SHEETS SYNC: Automatically log complete record into Google Sheets
// 5. COMPLETED: Persist finalized status and notify UI listeners

import AsyncStorage from '@react-native-async-storage/async-storage';
import {DiscoveredRecording} from '../../types/recordings';
import {CallRecord} from '../../types';
import {PipelineJob, PipelineStats, PipelineStage} from '../../types/pipeline';
import {RecordingScannerService} from '../scanner/RecordingScannerService';
import {GoogleDriveService} from '../drive/GoogleDriveService';
import {TranscriptionService} from '../transcription/TranscriptionService';
import {GoogleSheetsService} from '../sheets/GoogleSheetsService';

const PIPELINE_JOBS_KEY = 'telecaller_pipeline_jobs';

type PipelineListener = (jobs: Record<string, PipelineJob>) => void;

export class PipelineService {
  private static listeners: Set<PipelineListener> = new Set();
  private static activeJobs: Record<string, PipelineJob> = {};
  private static isInitialized = false;

  /**
   * Subscribe to pipeline job updates.
   */
  static subscribe(listener: PipelineListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current jobs
    this.getJobs().then(jobs => listener(jobs));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(jobs: Record<string, PipelineJob>): void {
    this.listeners.forEach(fn => {
      try {
        fn(jobs);
      } catch {}
    });
  }

  /**
   * Retrieve all saved pipeline jobs from storage.
   */
  static async getJobs(): Promise<Record<string, PipelineJob>> {
    if (!this.isInitialized) {
      try {
        const stored = await AsyncStorage.getItem(PIPELINE_JOBS_KEY);
        if (stored) {
          this.activeJobs = JSON.parse(stored);
        }
      } catch {}
      this.isInitialized = true;
    }
    return {...this.activeJobs};
  }

  /**
   * Retrieve single job by call/recording ID.
   */
  static async getJob(callId: string): Promise<PipelineJob | null> {
    const jobs = await this.getJobs();
    return jobs[callId] || null;
  }

  /**
   * Update and persist a pipeline job.
   */
  static async updateJob(
    callId: string,
    update: Partial<PipelineJob>,
  ): Promise<PipelineJob> {
    const jobs = await this.getJobs();
    const existing = jobs[callId] || {
      callId,
      recordingFileName: '',
      recordingUri: '',
      stage: 'QUEUED' as PipelineStage,
      progressPercent: 0,
      statusText: 'Queued',
      startedAt: new Date().toISOString(),
    };

    const updatedJob: PipelineJob = {
      ...existing,
      ...update,
    };

    this.activeJobs[callId] = updatedJob;
    await AsyncStorage.setItem(
      PIPELINE_JOBS_KEY,
      JSON.stringify(this.activeJobs),
    );
    this.notifyListeners(this.activeJobs);
    return updatedJob;
  }

  /**
   * Compute live pipeline statistics across all discovered recordings.
   */
  static async getStats(
    allRecordings: (DiscoveredRecording | CallRecord)[],
  ): Promise<PipelineStats> {
    const jobs = await this.getJobs();
    let completed = 0;
    let inProgress = 0;
    let failed = 0;

    allRecordings.forEach(rec => {
      const job = jobs[rec.id];
      if (job) {
        if (job.stage === 'COMPLETED') completed++;
        else if (job.stage === 'FAILED') failed++;
        else inProgress++;
      }
    });

    const total = allRecordings.length;
    const pending = Math.max(0, total - completed - inProgress - failed);

    return {
      total,
      completed,
      inProgress,
      failed,
      pending,
    };
  }

  /**
   * Execute the complete end-to-end pipeline for a single call or recording.
   * STAGE 1: Call Log & Contacts Metadata Matching
   * STAGE 2: Google Drive Resumable Streaming Upload
   * STAGE 3: Multi-Provider Speech-to-Text Transcription & Diarization
   * STAGE 4: Automated Google Sheets Row Logging
   * STAGE 5: Finalized Status & Local Cache Update
   */
  static async processCall(
    item: DiscoveredRecording | CallRecord,
  ): Promise<PipelineJob> {
    const callId = item.id;
    const fileName =
      ('recordingFileName' in item && item.recordingFileName) ||
      ('fileName' in item && (item as any).fileName) ||
      `recording_${callId}.m4a`;

    const fileUri =
      ('recordingUri' in item && item.recordingUri) ||
      ('fileUri' in item && (item as any).fileUri) ||
      ('filePath' in item && (item as any).filePath) ||
      '';

    let job = await this.updateJob(callId, {
      recordingFileName: fileName,
      recordingUri: fileUri,
      stage: 'MATCH',
      progressPercent: 10,
      statusText: 'Matching with Call Log...',
      startedAt: new Date().toISOString(),
      error: undefined,
    });

    try {
      // ─────────────────────────────────────────────────────────
      // STAGE 1: Call Metadata Matching
      // ─────────────────────────────────────────────────────────
      let callRecord: CallRecord;
      if ('matchedWithCallLog' in item && item.matchedWithCallLog) {
        callRecord = item as CallRecord;
      } else if ('discoverySource' in item) {
        callRecord = RecordingScannerService.discoveredToCallRecord(
          item as DiscoveredRecording,
        );
      } else {
        callRecord = item as CallRecord;
      }

      job = await this.updateJob(callId, {
        stage: 'DRIVE',
        progressPercent: 25,
        statusText: 'Backing up to Google Drive...',
      });

      // ─────────────────────────────────────────────────────────
      // STAGE 2: Google Drive Resumable Streaming Upload
      // ─────────────────────────────────────────────────────────
      let driveUrl = callRecord.driveUrl || job.driveUrl || '';
      let driveFileId = callRecord.driveFileId || job.driveFileId || '';

      if (!driveUrl && fileUri) {
        try {
          const driveResult = await GoogleDriveService.uploadRecording(
            callRecord,
            percent => {
              const driveProgress = 25 + Math.round((percent / 100) * 35); // 25% -> 60%
              this.updateJob(callId, {
                progressPercent: driveProgress,
                statusText: `Uploading to Drive (${percent}%)...`,
              });
            },
          );
          driveUrl = driveResult.webViewLink;
          driveFileId = driveResult.fileId;
        } catch (driveErr: any) {
          console.warn('Drive upload step encountered error:', driveErr);
        }
      }

      job = await this.updateJob(callId, {
        driveUrl,
        driveFileId,
        stage: 'TRANSCRIPTION',
        progressPercent: 65,
        statusText: 'Transcribing speech with AI...',
      });

      // ─────────────────────────────────────────────────────────
      // STAGE 3: Multi-Provider Speech-to-Text & Diarization
      // ─────────────────────────────────────────────────────────
      let transcriptPreview =
        callRecord.transcriptPreview || job.transcriptPreview || '';
      let detectedLang = callRecord.language || job.language || 'English';

      try {
        const transcriptResult = await TranscriptionService.transcribeCall(
          callRecord,
          prog => {
            const sttProgress = 65 + Math.round((prog.progressPercent / 100) * 20); // 65% -> 85%
            this.updateJob(callId, {
              progressPercent: sttProgress,
              statusText: `Transcribing (${prog.status})...`,
            });
          },
        );
        transcriptPreview = transcriptResult.transcriptPreview;
        detectedLang = transcriptResult.language;
        callRecord.transcript = transcriptResult.segments;
        callRecord.transcriptPreview = transcriptPreview;
        callRecord.language = detectedLang;
      } catch (sttErr) {
        console.warn('STT transcription step error:', sttErr);
      }

      job = await this.updateJob(callId, {
        transcriptPreview,
        language: detectedLang,
        stage: 'SHEETS',
        progressPercent: 88,
        statusText: 'Logging to Google Sheets...',
      });

      // ─────────────────────────────────────────────────────────
      // STAGE 4: Automated Google Sheets Row Insertion
      // ─────────────────────────────────────────────────────────
      let sheetRowId = job.sheetRowId;
      try {
        const sheetRes = await GoogleSheetsService.appendCallRecord(
          {
            ...callRecord,
            driveUrl: driveUrl || callRecord.driveUrl,
            transcriptPreview,
            language: detectedLang,
          },
          driveUrl || undefined,
        );
        sheetRowId = sheetRes.rowNumber;
      } catch (sheetErr) {
        console.warn('Sheets sync step error:', sheetErr);
      }

      // ─────────────────────────────────────────────────────────
      // STAGE 5: Pipeline Completed
      // ─────────────────────────────────────────────────────────
      const completedJob = await this.updateJob(callId, {
        driveUrl,
        driveFileId,
        transcriptPreview,
        language: detectedLang,
        sheetRowId,
        stage: 'COMPLETED',
        progressPercent: 100,
        statusText: 'Completed',
        completedAt: new Date().toISOString(),
      });

      return completedJob;
    } catch (err: any) {
      const failedJob = await this.updateJob(callId, {
        stage: 'FAILED',
        error: err?.message || 'Pipeline processing failed.',
        statusText: 'Processing Failed',
      });
      return failedJob;
    }
  }

  /**
   * Process all pending or unprocessed recordings sequentially.
   */
  static async processAllPending(
    recordings: DiscoveredRecording[],
    onProgress?: (completedCount: number, totalCount: number) => void,
  ): Promise<void> {
    const jobs = await this.getJobs();
    const pendingList = recordings.filter(r => {
      const job = jobs[r.id];
      return !job || (job.stage !== 'COMPLETED' && job.stage !== 'FAILED');
    });

    let done = 0;
    for (const rec of pendingList) {
      await this.processCall(rec);
      done++;
      onProgress?.(done, pendingList.length);
    }
  }
}
