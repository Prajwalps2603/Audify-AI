import React, {useMemo, useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import {MOCK_CALLS} from '../../mock/mockData';
import {CallRecord} from '../../types';
import Avatar from '../../components/Avatar';
import StatusBadge from '../../components/StatusBadge';
import Card from '../../components/Card';
import AudioPlayer from '../../components/AudioPlayer';
import {useRecordings} from '../../context/RecordingContext';
import {RecordingScannerService} from '../../services/scanner/RecordingScannerService';
import {GoogleDriveService} from '../../services/drive/GoogleDriveService';
import {GoogleSheetsService} from '../../services/sheets/GoogleSheetsService';
import {SheetRecord} from '../../types/sheets';
import {TranscriptionService} from '../../services/transcription/TranscriptionService';
import {TranscriptionResult} from '../../types/transcription';
import {PipelineService} from '../../services/pipeline/PipelineService';
import {PipelineJob, PipelineStage} from '../../types/pipeline';

// ─────────────────────────────────────────────────────────────
// Info Row
// ─────────────────────────────────────────────────────────────
const InfoRow: React.FC<{label: string; value: string; icon?: string}> = ({
  label,
  value,
  icon,
}) => (
  <View style={styles.infoRow}>
    {icon && <Text style={styles.infoIcon}>{icon}</Text>}
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────
// Call Details Screen
// ─────────────────────────────────────────────────────────────
const CallDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {callId} = route.params as {callId: string};

  const {getRecordingById} = useRecordings();
  const discovered = getRecordingById(callId);

  const call: CallRecord | null = useMemo(() => {
    if (discovered) {
      return RecordingScannerService.discoveredToCallRecord(discovered);
    }
    return MOCK_CALLS.find(c => c.id === callId) ?? null;
  }, [discovered, callId]);

  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [driveUploadProgress, setDriveUploadProgress] = useState(0);
  const [driveRecord, setDriveRecord] = useState<{
    driveFileId: string;
    driveUrl: string;
  } | null>(
    call?.driveUrl && call?.driveFileId
      ? {driveFileId: call.driveFileId, driveUrl: call.driveUrl}
      : null,
  );
  const [sheetRecord, setSheetRecord] = useState<SheetRecord | null>(null);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [transcriptResult, setTranscriptResult] =
    useState<TranscriptionResult | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [pipelineJob, setPipelineJob] = useState<PipelineJob | null>(null);
  const [isProcessingPipeline, setIsProcessingPipeline] = useState(false);

  useEffect(() => {
    if (call?.id) {
      PipelineService.getJob(call.id).then(job => {
        if (job) setPipelineJob(job);
      });

      const unsubscribe = PipelineService.subscribe(jobs => {
        const job = jobs[call.id];
        if (job) {
          setPipelineJob(job);
          if (job.driveUrl && !driveRecord) {
            setDriveRecord({
              driveFileId: job.driveFileId || '',
              driveUrl: job.driveUrl,
            });
          }
          if (job.transcriptPreview && !transcriptResult) {
            TranscriptionService.getCachedTranscript(call.id).then(t => {
              if (t) setTranscriptResult(t);
            });
          }
          if (job.sheetRowId && !sheetRecord) {
            GoogleSheetsService.getSyncedRecord(call.id).then(sheetRec => {
              if (sheetRec) setSheetRecord(sheetRec);
            });
          }
        }
      });

      TranscriptionService.getCachedTranscript(call.id).then(t => {
        if (t) setTranscriptResult(t);
      });

      GoogleDriveService.getUploadedRecord(call.id).then(rec => {
        if (rec) {
          setDriveRecord({
            driveFileId: rec.driveFileId,
            driveUrl: rec.driveUrl,
          });
        }
      });

      GoogleSheetsService.getSyncedRecord(call.id).then(sheetRec => {
        if (sheetRec) {
          setSheetRecord(sheetRec);
        } else if (call.status === 'COMPLETED' || call.driveUrl) {
          // Automatic row insertion upon recording processing completion
          setIsSyncingSheet(true);
          GoogleSheetsService.appendCallRecord(
            call,
            driveRecord?.driveUrl || call.driveUrl || undefined,
          )
            .then(syncRes => {
              setSheetRecord({
                callId: call.id,
                recordingId: call.id,
                spreadsheetId: syncRes.spreadsheetId,
                spreadsheetUrl: syncRes.spreadsheetUrl,
                rowNumber: syncRes.rowNumber,
                syncedAt: syncRes.syncedAt,
              });
            })
            .catch(() => {})
            .finally(() => setIsSyncingSheet(false));
        }
      });

      return () => unsubscribe();
    }
  }, [call?.id]);

  const handleRunFullPipeline = async () => {
    if (!call) return;
    setIsProcessingPipeline(true);
    try {
      const job = await PipelineService.processCall(discovered || call);
      setPipelineJob(job);
      if (job.driveUrl) {
        setDriveRecord({
          driveFileId: job.driveFileId || '',
          driveUrl: job.driveUrl,
        });
      }
      const tr = await TranscriptionService.getCachedTranscript(call.id);
      if (tr) setTranscriptResult(tr);
      const sr = await GoogleSheetsService.getSyncedRecord(call.id);
      if (sr) setSheetRecord(sr);

      Alert.alert(
        'Pipeline Finished',
        `All 5 end-to-end stages executed successfully!\n\n• Audio Scanned & Matched\n• Backed up to Google Drive\n• AI Speech Diarized & Transcribed\n• Logged to Google Sheets (Row #${job.sheetRowId || 'Auto'})`,
        [{text: 'OK'}],
      );
    } catch (err: any) {
      Alert.alert(
        'Pipeline Failed',
        err?.message || 'End-to-end pipeline execution failed.',
        [{text: 'OK'}],
      );
    } finally {
      setIsProcessingPipeline(false);
    }
  };

  const handleUploadToDrive = async () => {
    if (!call) return;
    setIsUploadingDrive(true);
    setDriveUploadProgress(0);
    try {
      const result = await GoogleDriveService.uploadRecording(
        call,
        percent => setDriveUploadProgress(percent),
      );
      setDriveRecord({
        driveFileId: result.fileId,
        driveUrl: result.webViewLink,
      });

      // Automatic row insertion upon recording processing completion (Phase 8)
      try {
        setIsSyncingSheet(true);
        const syncRes = await GoogleSheetsService.appendCallRecord(
          call,
          result.webViewLink,
        );
        setSheetRecord({
          callId: call.id,
          recordingId: call.id,
          spreadsheetId: syncRes.spreadsheetId,
          spreadsheetUrl: syncRes.spreadsheetUrl,
          rowNumber: syncRes.rowNumber,
          syncedAt: syncRes.syncedAt,
        });
      } catch (sheetErr) {
        console.warn('Auto sync to sheets error:', sheetErr);
      } finally {
        setIsSyncingSheet(false);
      }

      Alert.alert(
        'Google Drive & Sheets',
        `Recording successfully backed up to Google Drive and logged in Google Sheets!\n\nFolder: TeleCaller AI/Recordings/\nFile: ${result.fileName}\nSheet: Call Records (Row #${sheetRecord?.rowNumber || 'Auto'})`,
        [{text: 'OK'}],
      );
    } catch (err: any) {
      Alert.alert(
        'Upload Failed',
        err?.message || 'Could not upload recording to Google Drive.',
        [{text: 'OK'}],
      );
    } finally {
      setIsUploadingDrive(false);
      setDriveUploadProgress(0);
    }
  };

  const handleOpenDrive = async () => {
    const url = driveRecord?.driveUrl || call?.driveUrl;
    if (url) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          return;
        }
      } catch {}
      Alert.alert('Google Drive', `Link: ${url}`);
    }
  };

  const handleOpenSheets = async () => {
    const url = sheetRecord?.spreadsheetUrl;
    if (url) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          return;
        }
      } catch {}
      Alert.alert('Google Sheets', `Spreadsheet URL: ${url}`);
    }
  };

  const handleTranscribe = async () => {
    if (!call) return;
    setIsTranscribing(true);
    try {
      const res = await TranscriptionService.transcribeCall(call);
      setTranscriptResult(res);
      // Update Sheets if already backed up
      if (driveRecord?.driveUrl) {
        GoogleSheetsService.appendCallRecord(
          {
            ...call,
            transcriptPreview: res.transcriptPreview,
            transcript: res.segments,
          },
          driveRecord.driveUrl,
        ).catch(() => {});
      }
    } catch (e: any) {
      Alert.alert(
        'Transcription Failed',
        e?.message || 'Failed to transcribe call.',
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  if (!call) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Call record not found.</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button">
            <Text style={styles.backLink}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isIncoming = call.callType === 'Incoming';

  const isPipelineRunning =
    isProcessingPipeline ||
    (Boolean(pipelineJob) &&
      pipelineJob?.stage !== 'COMPLETED' &&
      pipelineJob?.stage !== 'FAILED' &&
      pipelineJob?.stage !== 'QUEUED');

  const isScanDone = Boolean(discovered || call);
  const isMatchDone = Boolean(
    call?.matchedWithCallLog ||
      pipelineJob?.stage === 'COMPLETED' ||
      (pipelineJob &&
        ['DRIVE', 'TRANSCRIPTION', 'SHEETS'].includes(pipelineJob.stage)),
  );
  const isDriveDone = Boolean(
    driveRecord?.driveUrl || pipelineJob?.driveUrl || call?.driveUrl,
  );
  const isDriveActive =
    (pipelineJob?.stage === 'DRIVE' || isUploadingDrive) && !isDriveDone;

  const isTranscribeDone = Boolean(
    transcriptResult?.transcriptPreview ||
      pipelineJob?.transcriptPreview ||
      call?.transcriptPreview,
  );
  const isTranscribeActive =
    (pipelineJob?.stage === 'TRANSCRIPTION' || isTranscribing) &&
    !isTranscribeDone;

  const isSheetsDone = Boolean(
    sheetRecord?.spreadsheetUrl || pipelineJob?.sheetRowId,
  );
  const isSheetsActive =
    (pipelineJob?.stage === 'SHEETS' || isSyncingSheet) && !isSheetsDone;

  const isAllCompleted =
    isScanDone && isMatchDone && isDriveDone && isTranscribeDone && isSheetsDone;

  const pipelineSteps = [
    {key: 'scan', label: 'Scan', icon: '📁', done: isScanDone, active: false},
    {
      key: 'match',
      label: 'Match',
      icon: '🔍',
      done: isMatchDone,
      active: pipelineJob?.stage === 'MATCH' && !isMatchDone,
    },
    {
      key: 'drive',
      label: 'Drive',
      icon: '☁️',
      done: isDriveDone,
      active: isDriveActive,
    },
    {
      key: 'transcribe',
      label: 'Transcribe',
      icon: '🎙️',
      done: isTranscribeDone,
      active: isTranscribeActive,
    },
    {
      key: 'sheets',
      label: 'Sheets',
      icon: '📊',
      done: isSheetsDone,
      active: isSheetsActive,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button">
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Call Details</Text>
        <TouchableOpacity
          style={styles.moreButton}
          accessibilityLabel="More options"
          accessibilityRole="button">
          <Text style={styles.moreIcon}>⋮</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Profile Card ── */}
        <Card variant="elevated" style={styles.profileCard}>
          <Avatar name={call.name} size={72} style={styles.profileAvatar} />
          <Text style={styles.profileName}>{call.name}</Text>
          <Text style={styles.profilePhone}>{call.phoneNumber}</Text>

          {/* Verification Badge */}
          {call.matchedWithCallLog ? (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeIcon}>✓</Text>
              <Text style={styles.verifiedBadgeText}>
                Matched with Device Call Log
              </Text>
            </View>
          ) : discovered ? (
            <View style={styles.unverifiedBadge}>
              <Text style={styles.unverifiedBadgeIcon}>📁</Text>
              <Text style={styles.unverifiedBadgeText}>
                Extracted from Audio File
              </Text>
            </View>
          ) : null}

          <View style={styles.statusRow}>
            <Text
              style={[
                styles.callTypeLabel,
                {color: isIncoming ? Colors.success : Colors.primary},
              ]}>
              {isIncoming ? '↙ Incoming Call' : '↗ Outgoing Call'}
            </Text>
            <StatusBadge status={call.status} />
          </View>
        </Card>

        {/* ── Visual Pipeline Stages Tracker (Phase 11) ── */}
        <Card variant="elevated" style={styles.pipelineCard}>
          <View style={styles.pipelineHeader}>
            <View style={styles.pipelineTitleRow}>
              <Text style={styles.pipelineTitle}>⚡ End-to-End Pipeline</Text>
              <View
                style={[
                  styles.pipelineStatusBadge,
                  isAllCompleted
                    ? styles.badgeCompleted
                    : isPipelineRunning
                    ? styles.badgeProcessing
                    : pipelineJob?.stage === 'FAILED'
                    ? styles.badgeFailed
                    : styles.badgePending,
                ]}>
                <Text
                  style={[
                    styles.pipelineStatusBadgeText,
                    isAllCompleted
                      ? styles.textCompleted
                      : isPipelineRunning
                      ? styles.textProcessing
                      : pipelineJob?.stage === 'FAILED'
                      ? styles.textFailed
                      : styles.textPending,
                  ]}>
                  {isAllCompleted
                    ? '✓ Done (100%)'
                    : isPipelineRunning
                    ? `${pipelineJob?.progressPercent || 50}% Active`
                    : pipelineJob?.stage === 'FAILED'
                    ? '⚠️ Failed'
                    : 'Pending Run'}
                </Text>
              </View>
            </View>
            <Text style={styles.pipelineSubtitle}>
              {pipelineJob?.statusText ||
                (isAllCompleted
                  ? 'All 5 stages completed automatically.'
                  : 'Ready to execute automatic 5-stage pipeline.')}
            </Text>
          </View>

          {/* Stepper visual diagram */}
          <View style={styles.stepperContainer}>
            {pipelineSteps.map((step, idx) => (
              <React.Fragment key={step.key}>
                {idx > 0 && (
                  <View
                    style={[
                      styles.stepperLine,
                      step.done
                        ? styles.stepperLineDone
                        : step.active
                        ? styles.stepperLineActive
                        : styles.stepperLinePending,
                    ]}
                  />
                )}
                <View style={styles.stepNodeWrapper}>
                  <View
                    style={[
                      styles.stepNode,
                      step.done
                        ? styles.stepNodeDone
                        : step.active
                        ? styles.stepNodeActive
                        : styles.stepNodePending,
                    ]}>
                    {step.active ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.stepIcon}>{step.icon}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      step.done
                        ? styles.stepLabelDone
                        : step.active
                        ? styles.stepLabelActive
                        : styles.stepLabelPending,
                    ]}>
                    {step.label}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Pipeline Action Button */}
          <TouchableOpacity
            style={[
              styles.pipelineRunBtn,
              isPipelineRunning && styles.pipelineRunBtnDisabled,
            ]}
            onPress={handleRunFullPipeline}
            disabled={isPipelineRunning}
            activeOpacity={0.85}
            accessibilityLabel="Run full automatic pipeline"
            accessibilityRole="button">
            {isPipelineRunning ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.pipelineRunBtnText}>
                  Processing Pipeline ({pipelineJob?.progressPercent || 0}%)...
                </Text>
              </>
            ) : isAllCompleted ? (
              <>
                <Text style={styles.pipelineRunBtnIcon}>🔄</Text>
                <Text style={styles.pipelineRunBtnText}>
                  Re-run Full Pipeline
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.pipelineRunBtnIcon}>⚡</Text>
                <Text style={styles.pipelineRunBtnText}>
                  Run Full Pipeline Now
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Card>

        {/* ── Call Information Card ── */}
        <Card variant="elevated" style={styles.infoCard}>
          <Text style={styles.cardTitle}>Call Information</Text>
          <InfoRow label="Date" value={formatDate(call.date)} icon="📅" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Time" value={call.time} icon="🕐" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Caller (From)" value={call.from} icon="👤" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Receiver (To)" value={call.to} icon="👥" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Direction" value={call.callType} icon="📞" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Duration" value={call.duration} icon="⏱️" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Language" value={call.language} icon="🌐" />
        </Card>

        {/* ── Recording File Metadata Card ── */}
        {call.recordingFileName && (
          <Card variant="elevated" style={styles.infoCard}>
            <Text style={styles.cardTitle}>Audio File Details</Text>
            <InfoRow
              label="File Name"
              value={call.recordingFileName}
              icon="🎵"
            />
            {call.fileSizeBytes ? (
              <>
                <View style={styles.infoSeparator} />
                <InfoRow
                  label="File Size"
                  value={formatBytes(call.fileSizeBytes)}
                  icon="💾"
                />
              </>
            ) : null}
            {discovered?.discoverySource ? (
              <>
                <View style={styles.infoSeparator} />
                <InfoRow
                  label="Storage Source"
                  value={formatSource(discovered.discoverySource)}
                  icon="📂"
                />
              </>
            ) : null}
          </Card>
        )}

        {/* ── Audio Player (Phase 6) ── */}
        <Card variant="elevated" style={styles.infoCard}>
          <Text style={styles.cardTitle}>Recording Player</Text>
          <AudioPlayer
            recordingUri={call.recordingUri}
            recordingFileName={call.recordingFileName}
            durationSeconds={call.durationSeconds}
            driveUrl={driveRecord?.driveUrl || call.driveUrl}
          />
        </Card>

        {/* ── Transcript Preview (Phase 9) ── */}
        <Card variant="elevated" style={styles.infoCard}>
          <View style={styles.driveHeaderRow}>
            <Text style={styles.cardTitle}>Transcript</Text>
            {transcriptResult?.transcriptPreview || call.transcriptPreview ? (
              <View style={styles.driveCheckBadge}>
                <Text style={styles.driveCheck}>✓ Transcribed</Text>
              </View>
            ) : null}
          </View>

          {transcriptResult?.transcriptPreview || call.transcriptPreview ? (
            <>
              <Text style={styles.transcriptPreview} numberOfLines={4}>
                {transcriptResult?.transcriptPreview || call.transcriptPreview}
              </Text>
              <TouchableOpacity
                style={styles.viewTranscriptBtn}
                onPress={() =>
                  navigation.navigate('Transcript', {callId: call.id})
                }
                accessibilityLabel="View full transcript"
                accessibilityRole="button">
                <Text style={styles.viewTranscriptText}>
                  View Full Transcript →
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.drivePendingContent}>
              <Text style={styles.drivePendingDescription}>
                Transcribe this call recording to separate speakers, generate dialog timestamps, and detect spoken language.
              </Text>
              {isTranscribing ? (
                <View style={styles.uploadingBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.uploadingText}>Transcribing call recording...</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.openDriveBtn}
                  onPress={handleTranscribe}
                  activeOpacity={0.8}
                  accessibilityLabel="Transcribe recording"
                  accessibilityRole="button">
                  <Text style={styles.openDriveBtnText}>🎙️ Transcribe Recording</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Card>

        {/* ── Processing Info ── */}
        {call.status === 'FAILED' && (
          <View style={styles.failedBanner}>
            <Text style={styles.failedBannerTitle}>⚠️ Processing Failed</Text>
            <Text style={styles.failedBannerText}>
              This recording could not be fully processed. You can retry
              processing in a later phase.
            </Text>
          </View>
        )}

        {/* ── Google Drive Backup (Phase 7) ── */}
        <Card variant="elevated" style={styles.infoCard}>
          <View style={styles.driveHeaderRow}>
            <Text style={styles.cardTitle}>Google Drive Backup</Text>
            {driveRecord ? (
              <View style={styles.driveCheckBadge}>
                <Text style={styles.driveCheck}>✓ Backed Up</Text>
              </View>
            ) : (
              <View style={styles.drivePendingBadge}>
                <Text style={styles.drivePendingText}>Pending Upload</Text>
              </View>
            )}
          </View>

          {driveRecord ? (
            <View style={styles.driveUploadedContent}>
              <View style={styles.driveRow}>
                <Text style={styles.driveIcon}>☁️</Text>
                <View style={styles.driveInfoCol}>
                  <Text style={styles.driveStatusTitle}>Uploaded to Drive</Text>
                  <Text style={styles.drivePathText} numberOfLines={1}>
                    TeleCaller AI/Recordings/
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.openDriveBtn}
                onPress={handleOpenDrive}
                activeOpacity={0.8}
                accessibilityLabel="Open in Google Drive"
                accessibilityRole="button">
                <Text style={styles.openDriveBtnText}>Open in Google Drive ↗</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.drivePendingContent}>
              <Text style={styles.drivePendingDescription}>
                Upload this recording to your Google Drive account in TeleCaller AI/Recordings/YYYY/MM/DD/. Duplicate protection is active.
              </Text>

              {isUploadingDrive ? (
                <View style={styles.uploadingBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.uploadingText}>
                    Uploading to Google Drive... {driveUploadProgress > 0 ? `${driveUploadProgress}%` : ''}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadDriveBtn}
                  onPress={handleUploadToDrive}
                  activeOpacity={0.8}
                  accessibilityLabel="Upload to Google Drive"
                  accessibilityRole="button">
                  <Text style={styles.uploadDriveBtnIcon}>☁️</Text>
                  <Text style={styles.uploadDriveBtnText}>Upload to Google Drive</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Card>

        {/* ── Google Sheets Record (Phase 8) ── */}
        <Card variant="elevated" style={styles.infoCard}>
          <View style={styles.driveHeaderRow}>
            <Text style={styles.cardTitle}>Google Sheets Record</Text>
            {sheetRecord ? (
              <View style={styles.driveCheckBadge}>
                <Text style={styles.driveCheck}>
                  ✓ Logged (Row #{sheetRecord.rowNumber})
                </Text>
              </View>
            ) : isSyncingSheet ? (
              <View style={styles.sheetSyncingBadge}>
                <Text style={styles.sheetSyncingText}>Logging...</Text>
              </View>
            ) : (
              <View style={styles.drivePendingBadge}>
                <Text style={styles.drivePendingText}>Auto-Logged on Process</Text>
              </View>
            )}
          </View>

          {sheetRecord ? (
            <View style={styles.driveUploadedContent}>
              <View style={styles.driveRow}>
                <Text style={styles.driveIcon}>📊</Text>
                <View style={styles.driveInfoCol}>
                  <Text style={styles.driveStatusTitle}>Logged in Google Sheets</Text>
                  <Text style={styles.drivePathText} numberOfLines={1}>
                    TeleCaller AI - Call Records (Row #{sheetRecord.rowNumber})
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.openSheetBtn}
                onPress={handleOpenSheets}
                activeOpacity={0.8}
                accessibilityLabel="Open in Google Sheets"
                accessibilityRole="button">
                <Text style={styles.openSheetBtnText}>Open in Google Sheets ↗</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.drivePendingContent}>
              <Text style={styles.drivePendingDescription}>
                Calls are automatically logged into your personal "TeleCaller AI - Call Records" spreadsheet across Columns A through N upon processing completion. Duplicate prevention is active.
              </Text>
              {isSyncingSheet && (
                <View style={styles.uploadingBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.uploadingText}>
                    Logging call details to Google Sheets...
                  </Text>
                </View>
              )}
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatSource(source?: string): string {
  if (source === 'saf') return 'Custom Folder (SAF)';
  if (source === 'filesystem') return 'Device Storage Folder';
  if (source === 'media_store') return 'Android MediaStore';
  return 'System Audio';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...(Shadow.sm as object),
  },
  backButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  backIcon: {
    fontSize: FontSize.xl,
    color: Colors.primary,
    fontWeight: '600',
  },
  topBarTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  moreButton: {
    padding: Spacing.sm,
  },
  moreIcon: {
    fontSize: FontSize.xl,
    color: Colors.textSecondary,
    fontWeight: '700',
  },

  // Scroll
  scroll: {flex: 1},
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing['4xl'],
    gap: Spacing.base,
  },

  // Profile card
  profileCard: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  profileAvatar: {
    marginBottom: Spacing.md,
  },
  profileName: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  verifiedBadgeIcon: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: '800',
    marginRight: 6,
  },
  verifiedBadgeText: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unverifiedBadgeIcon: {
    fontSize: FontSize.xs,
    marginRight: 6,
  },
  unverifiedBadgeText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  callTypeLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  // Info card
  infoCard: {
    gap: 0,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoIcon: {
    fontSize: 18,
    marginRight: Spacing.md,
    width: 28,
    textAlign: 'center',
  },
  infoContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.md,
  },
  infoSeparator: {
    height: 1,
    backgroundColor: Colors.border,
  },


  // Transcript preview
  transcriptPreview: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
    fontStyle: 'italic',
  },
  viewTranscriptBtn: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  viewTranscriptText: {
    fontSize: FontSize.base,
    color: Colors.primary,
    fontWeight: '700',
  },

  // Failed banner
  failedBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  failedBannerTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.error,
    marginBottom: Spacing.sm,
  },
  failedBannerText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    lineHeight: 20,
  },

  // Drive info
  driveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  driveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  driveIcon: {fontSize: 26},
  driveInfoCol: {
    flex: 1,
  },
  driveStatusTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  drivePathText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  driveCheckBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  driveCheck: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  drivePendingBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  drivePendingText: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  driveUploadedContent: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  openDriveBtn: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  openDriveBtnText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  drivePendingContent: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  drivePendingDescription: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  uploadingText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  uploadDriveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    ...(Shadow.sm as object),
  },
  uploadDriveBtnIcon: {
    fontSize: 16,
    color: Colors.textInverse,
  },
  uploadDriveBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textInverse,
  },

  // Google Sheets Card Styles (Phase 8)
  sheetSyncingBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  sheetSyncingText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  openSheetBtn: {
    backgroundColor: '#E8F5E9',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  openSheetBtnText: {
    color: '#2E7D32',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  // Not found
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  notFoundText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  backLink: {
    fontSize: FontSize.base,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Pipeline card styles (Phase 11)
  pipelineCard: {
    padding: Spacing.base,
  },
  pipelineHeader: {
    marginBottom: Spacing.sm,
  },
  pipelineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pipelineTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pipelineSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pipelineStatusBadge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  badgeCompleted: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  badgeProcessing: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  badgeFailed: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.error,
  },
  badgePending: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warning,
  },
  pipelineStatusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  textCompleted: {
    color: Colors.success,
  },
  textProcessing: {
    color: Colors.primary,
  },
  textFailed: {
    color: Colors.error,
  },
  textPending: {
    color: Colors.warning,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  stepperLine: {
    flex: 1,
    height: 3,
    marginHorizontal: 2,
    marginBottom: 16,
    borderRadius: 2,
  },
  stepperLineDone: {
    backgroundColor: Colors.success,
  },
  stepperLineActive: {
    backgroundColor: Colors.primary,
  },
  stepperLinePending: {
    backgroundColor: Colors.border,
  },
  stepNodeWrapper: {
    alignItems: 'center',
    width: 52,
  },
  stepNode: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  stepNodeDone: {
    backgroundColor: '#E8F5E9',
    borderColor: Colors.success,
  },
  stepNodeActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepNodePending: {
    backgroundColor: Colors.surfaceSecondary,
    borderColor: Colors.border,
  },
  stepIcon: {
    fontSize: 16,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  stepLabelDone: {
    color: Colors.success,
    fontWeight: '700',
  },
  stepLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  stepLabelPending: {
    color: Colors.textTertiary,
  },
  pipelineRunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    ...(Shadow.sm as object),
  },
  pipelineRunBtnDisabled: {
    opacity: 0.75,
  },
  pipelineRunBtnIcon: {
    fontSize: 16,
    color: Colors.textInverse,
  },
  pipelineRunBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});

export default CallDetailsScreen;
