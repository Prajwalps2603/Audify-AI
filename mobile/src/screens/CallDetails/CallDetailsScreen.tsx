// TeleCaller AI — Call Details Screen
// Comprehensive call inspection, synchronized audio playback, full pipeline execution.

import React, {useMemo, useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Linking,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
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
import {PipelineJob} from '../../types/pipeline';
import {toast} from '../../components/Toast';
import {showAlert, showConfirm} from '../../components/AppModal';

// ─────────────────────────────────────────────────────────────
// Info Row
// ─────────────────────────────────────────────────────────────
const InfoRow: React.FC<{
  label: string;
  value: string;
  iconName?: string;
  iconColor?: string;
}> = ({label, value, iconName, iconColor = Colors.primary}) => (
  <View style={styles.infoRow}>
    {iconName && (
      <View style={styles.infoIconWrapper}>
        <Icon name={iconName} size={18} color={iconColor} />
      </View>
    )}
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
    return null;
  }, [discovered]);

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
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [isUploadPaused, setIsUploadPaused] = useState(false);
  const uploadCancelledRef = useRef(false);
  const uploadPausedRef = useRef(false);

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
        }
      });

      TranscriptionService.getCachedTranscript(call.id).then(cached => {
        if (cached) setTranscriptResult(cached);
      });

      GoogleSheetsService.getSyncedRecord(call.id).then(sr => {
        if (sr) {
          setSheetRecord(sr);
        } else if (call.driveUrl) {
          setIsSyncingSheet(true);
          GoogleSheetsService.appendCallRecord(call, call.driveUrl)
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

      showAlert({
        title: 'Pipeline Completed',
        message:
          `All pipeline stages executed successfully!\n\n` +
          `• Audio Scanned & Matched\n` +
          `• Backed up to Google Drive\n` +
          `• AI Speech Transcribed & Diarized\n` +
          `• Logged to Google Sheets (Row #${job.sheetRowId || 'Auto'})`,
        variant: 'success',
        buttons: [{text: 'OK'}],
      });
    } catch (err: any) {
      showAlert({
        title: 'Pipeline Failed',
        message: err?.message || 'End-to-end pipeline execution failed.',
        variant: 'error',
        buttons: [{text: 'OK'}],
      });
    } finally {
      setIsProcessingPipeline(false);
    }
  };

  const handleUploadToDrive = () => {
    if (!call) return;
    showConfirm(
      'Upload to Google Drive',
      `Recording: ${call.recordingFileName || call.name}\nDuration: ${call.duration}\n\nUpload this call recording to your secure Google Drive account?`,
      () => {
        startInteractiveUpload();
      },
      'Upload Now',
    );
  };

  const startInteractiveUpload = async () => {
    if (!call) return;
    uploadCancelledRef.current = false;
    uploadPausedRef.current = false;
    setIsUploadPaused(false);
    setIsUploadingDrive(true);
    setDriveUploadProgress(8);
    setIsUploadModalVisible(true);

    try {
      const result = await GoogleDriveService.uploadRecording(
        call,
        percent => {
          if (uploadCancelledRef.current) return;
          if (!uploadPausedRef.current) {
            setDriveUploadProgress(Math.max(8, percent));
          }
        },
      );

      if (uploadCancelledRef.current) return;

      setDriveRecord({
        driveFileId: result.fileId,
        driveUrl: result.webViewLink,
      });

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

      setDriveUploadProgress(100);
      setIsUploadModalVisible(false);
      toast.success(
        'Upload Successful',
        `Backed up to Google Drive (${result.fileName})`,
      );
    } catch (err: any) {
      if (!uploadCancelledRef.current) {
        showAlert({
          title: 'Upload Failed',
          message: err?.message || 'Could not upload recording to Google Drive.',
          variant: 'error',
          buttons: [{text: 'OK'}],
        });
      }
    } finally {
      setIsUploadingDrive(false);
    }
  };

  const handleToggleUploadPause = () => {
    const next = !isUploadPaused;
    uploadPausedRef.current = next;
    setIsUploadPaused(next);
    if (next) {
      toast.info('Upload Paused', 'Recording upload is paused.');
    } else {
      toast.info('Upload Resumed', 'Resuming recording upload...');
    }
  };

  const handleCancelUpload = () => {
    uploadCancelledRef.current = true;
    setIsUploadingDrive(false);
    setDriveUploadProgress(0);
    setIsUploadPaused(false);
    setIsUploadModalVisible(false);
    toast.warning('Upload Cancelled', 'Recording upload was cancelled.');
  };

  const handleCloseUploadModal = () => {
    setIsUploadModalVisible(false);
    if (isUploadingDrive) {
      toast.info('Uploading in Background', 'Recording upload running in background.');
    }
  };

  const handleOpenDrive = async () => {
    const url = driveRecord?.driveUrl || call?.driveUrl || 'https://drive.google.com';
    if (Platform.OS === 'android') {
      const cleanUrl = url.replace(/^https?:\/\//, '');
      const intentUrl = `intent://${cleanUrl}#Intent;action=android.intent.action.VIEW;package=com.google.android.apps.docs;end`;
      try {
        const canOpen = await Linking.canOpenURL(intentUrl);
        if (canOpen) {
          await Linking.openURL(intentUrl);
          toast.info('Google Drive', 'Opening Google Drive app...');
          return;
        }
      } catch {}
    }
    try {
      await Linking.openURL(url);
      toast.info('Google Drive', 'Opening Google Drive...');
    } catch {
      toast.error('Drive Error', 'Could not open Google Drive.');
    }
  };

  const handleOpenSheets = async () => {
    const url = sheetRecord?.spreadsheetUrl || 'https://docs.google.com/spreadsheets';
    if (Platform.OS === 'android') {
      const cleanUrl = url.replace(/^https?:\/\//, '');
      const intentUrl = `intent://${cleanUrl}#Intent;action=android.intent.action.VIEW;package=com.google.android.apps.docs.editors.sheets;end`;
      try {
        const canOpen = await Linking.canOpenURL(intentUrl);
        if (canOpen) {
          await Linking.openURL(intentUrl);
          toast.info('Google Sheets', 'Opening Google Sheets app...');
          return;
        }
      } catch {}
    }
    try {
      await Linking.openURL(url);
      toast.info('Google Sheets', 'Opening Google Sheets...');
    } catch {
      toast.error('Sheets Error', 'Could not open Google Sheets.');
    }
  };

  const handleTranscribe = async () => {
    if (!call) return;
    setIsTranscribing(true);
    try {
      const res = await TranscriptionService.transcribeCall(call);
      setTranscriptResult(res);
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
      toast.success('Transcription Complete', 'Audio transcribed and diarized');
    } catch (e: any) {
      showAlert({
        title: 'Transcription Failed',
        message: e?.message || 'Failed to transcribe call.',
        variant: 'error',
        buttons: [{text: 'OK'}],
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  if (!call) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}>
          <Icon name="file-question-outline" size={56} color={Colors.textTertiary} />
          <Text style={styles.notFoundText}>Call record not found.</Text>
          <TouchableOpacity
            style={styles.backLinkBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button">
            <Icon name="arrow-left" size={16} color={Colors.primary} style={{marginRight: 4}} />
            <Text style={styles.backLink}>Go Back</Text>
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
    {key: 'scan', label: 'Scan', iconName: 'folder-search-outline', done: isScanDone, active: false},
    {
      key: 'match',
      label: 'Match',
      iconName: 'account-search-outline',
      done: isMatchDone,
      active: pipelineJob?.stage === 'MATCH' && !isMatchDone,
    },
    {
      key: 'drive',
      label: 'Drive',
      iconName: 'cloud-upload-outline',
      done: isDriveDone,
      active: isDriveActive,
    },
    {
      key: 'transcribe',
      label: 'Transcribe',
      iconName: 'waveform',
      done: isTranscribeDone,
      active: isTranscribeActive,
    },
    {
      key: 'sheets',
      label: 'Sheets',
      iconName: 'table-large',
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
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Call Details</Text>
        {/* Spacer to keep title centered */}
        <View style={styles.topBarSpacer} />
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
              <Icon name="check-decagram" size={14} color={Colors.success} style={{marginRight: 6}} />
              <Text style={styles.verifiedBadgeText}>
                Matched with Call Log
              </Text>
            </View>
          ) : discovered ? (
            <View style={styles.unverifiedBadge}>
              <Icon name="file-music-outline" size={14} color={Colors.textSecondary} style={{marginRight: 6}} />
              <Text style={styles.unverifiedBadgeText}>
                Discovered Audio File
              </Text>
            </View>
          ) : null}

          <View style={styles.statusRow}>
            <View style={styles.callTypeBadge}>
              <Icon
                name={isIncoming ? 'phone-incoming' : 'phone-outgoing'}
                size={14}
                color={isIncoming ? Colors.success : Colors.primary}
                style={{marginRight: 4}}
              />
              <Text
                style={[
                  styles.callTypeLabel,
                  {color: isIncoming ? Colors.success : Colors.primary},
                ]}>
                {isIncoming ? 'Incoming Call' : 'Outgoing Call'}
              </Text>
            </View>
            <StatusBadge status={call.status} />
          </View>
        </Card>

        {/* ── Visual Pipeline Stages Tracker ── */}
        <Card variant="elevated" style={styles.pipelineCard}>
          <View style={styles.pipelineHeader}>
            <View style={styles.pipelineTitleRow}>
              <View style={styles.pipelineTitleLeft}>
                <Icon name="lightning-bolt" size={20} color={Colors.primary} style={{marginRight: 6}} />
                <Text style={styles.pipelineTitle}>Pipeline Execution</Text>
              </View>
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
                    ? 'Done (100%)'
                    : isPipelineRunning
                    ? `${pipelineJob?.progressPercent || 50}% Active`
                    : pipelineJob?.stage === 'FAILED'
                    ? 'Failed'
                    : 'Pending Run'}
                </Text>
              </View>
            </View>
            <Text style={styles.pipelineSubtitle}>
              {pipelineJob?.statusText ||
                (isAllCompleted
                  ? 'All stages completed automatically.'
                  : 'Ready to execute automated multi-stage pipeline.')}
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
                      <Icon
                        name={step.iconName}
                        size={16}
                        color={step.done ? '#fff' : Colors.textTertiary}
                      />
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
                <ActivityIndicator size="small" color="#fff" style={{marginRight: 8}} />
                <Text style={styles.pipelineRunBtnText}>
                  Processing ({pipelineJob?.progressPercent || 0}%)...
                </Text>
              </>
            ) : isAllCompleted ? (
              <>
                <Icon name="refresh" size={18} color="#fff" style={{marginRight: 6}} />
                <Text style={styles.pipelineRunBtnText}>
                  Re-run Full Pipeline
                </Text>
              </>
            ) : (
              <>
                <Icon name="play" size={18} color="#fff" style={{marginRight: 6}} />
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
          <InfoRow label="Date" value={formatDate(call.date)} iconName="calendar-month-outline" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Time" value={call.time} iconName="clock-outline" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Caller (From)" value={call.from} iconName="account-arrow-right-outline" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Receiver (To)" value={call.to} iconName="account-arrow-left-outline" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Direction" value={call.callType} iconName="phone-outline" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Duration" value={call.duration} iconName="timer-outline" />
          <View style={styles.infoSeparator} />
          <InfoRow label="Language" value={call.language} iconName="translate" />
        </Card>

        {/* ── Recording File Metadata Card ── */}
        {call.recordingFileName && (
          <Card variant="elevated" style={styles.infoCard}>
            <Text style={styles.cardTitle}>Audio File Details</Text>
            <InfoRow
              label="File Name"
              value={call.recordingFileName}
              iconName="file-music-outline"
            />
            {call.fileSizeBytes ? (
              <>
                <View style={styles.infoSeparator} />
                <InfoRow
                  label="File Size"
                  value={formatBytes(call.fileSizeBytes)}
                  iconName="harddisk"
                />
              </>
            ) : null}
            {discovered?.discoverySource ? (
              <>
                <View style={styles.infoSeparator} />
                <InfoRow
                  label="Storage Source"
                  value={formatSource(discovered.discoverySource)}
                  iconName="folder-outline"
                />
              </>
            ) : null}
          </Card>
        )}

        {/* ── Audio Player ── */}
        <Card variant="elevated" style={styles.infoCard}>
          <Text style={styles.cardTitle}>Recording Player</Text>
          <AudioPlayer
            recordingUri={call.recordingUri}
            recordingFileName={call.recordingFileName}
            durationSeconds={call.durationSeconds}
            driveUrl={driveRecord?.driveUrl || call.driveUrl}
          />
        </Card>

        {/* ── Transcript Preview ── */}
        <Card variant="elevated" style={styles.infoCard}>
          <View style={styles.driveHeaderRow}>
            <Text style={styles.cardTitle}>Transcript</Text>
            {transcriptResult?.transcriptPreview || call.transcriptPreview ? (
              <View style={styles.driveCheckBadge}>
                <Icon name="check" size={12} color={Colors.success} style={{marginRight: 3}} />
                <Text style={styles.driveCheck}>Transcribed</Text>
              </View>
            ) : null}
          </View>

          {transcriptResult?.transcriptPreview || call.transcriptPreview ? (
            <>
              <Text style={styles.transcriptPreview} numberOfLines={4}>
                {transcriptResult?.transcriptPreview || call.transcriptPreview}
              </Text>
              <TouchableOpacity
                style={styles.viewTranscriptBadge}
                onPress={() =>
                  navigation.navigate('Transcript', {callId: call.id})
                }
                activeOpacity={0.8}
                accessibilityLabel="View full transcript"
                accessibilityRole="button">
                <Icon name="text-box-search-outline" size={15} color={Colors.primary} />
                <Text style={styles.viewTranscriptBadgeText}>
                  View Full Transcript
                </Text>
                <Icon name="arrow-right" size={14} color={Colors.primary} />
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
                  <Icon name="waveform" size={18} color={Colors.primary} style={{marginRight: 6}} />
                  <Text style={styles.openDriveBtnText}>Transcribe Recording</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Card>

        {/* ── Processing Failed Banner ── */}
        {call.status === 'FAILED' && (
          <View style={styles.failedBanner}>
            <View style={styles.failedBannerTitleRow}>
              <Icon name="alert-circle-outline" size={18} color={Colors.error} style={{marginRight: 6}} />
              <Text style={styles.failedBannerTitle}>Processing Failed</Text>
            </View>
            <Text style={styles.failedBannerText}>
              This recording could not be fully processed. You can retry processing using the pipeline runner above.
            </Text>
          </View>
        )}

        {/* ── Google Drive Backup ── */}
        <Card variant="elevated" style={styles.infoCard}>
          <View style={styles.driveHeaderRow}>
            <Text style={styles.cardTitle}>Google Drive Backup</Text>
            {driveRecord ? (
              <View style={styles.driveCheckBadge}>
                <Icon name="check" size={12} color={Colors.success} style={{marginRight: 3}} />
                <Text style={styles.driveCheck}>Backed Up</Text>
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
                <View style={styles.driveIconBox}>
                  <Icon name="cloud-check" size={24} color={Colors.primary} />
                </View>
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
                <Text style={styles.openDriveBtnText}>Open in Google Drive</Text>
                <Icon name="open-in-new" size={16} color={Colors.primary} style={{marginLeft: 4}} />
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
                    {isUploadPaused
                      ? `Upload Paused (${driveUploadProgress}%)`
                      : `Uploading to Google Drive... ${driveUploadProgress > 0 ? `${driveUploadProgress}%` : ''}`}
                  </Text>
                  <TouchableOpacity
                    style={styles.inlineControlsBtn}
                    onPress={() => setIsUploadModalVisible(true)}>
                    <Text style={styles.inlineControlsBtnText}>Controls</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pendingActionsRow}>
                  <TouchableOpacity
                    style={styles.uploadDriveBtn}
                    onPress={handleUploadToDrive}
                    activeOpacity={0.8}
                    accessibilityLabel="Upload to Google Drive"
                    accessibilityRole="button">
                    <Icon name="cloud-upload" size={18} color={Colors.textInverse} style={{marginRight: 6}} />
                    <Text style={styles.uploadDriveBtnText}>Upload to Google Drive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.openDriveOutlineBtn}
                    onPress={handleOpenDrive}
                    activeOpacity={0.8}
                    accessibilityLabel="Open Google Drive App"
                    accessibilityRole="button">
                    <Icon name="google-drive" size={16} color="#4285F4" style={{marginRight: 6}} />
                    <Text style={styles.openDriveOutlineBtnText}>Open Google Drive App</Text>
                    <Icon name="open-in-new" size={14} color="#4285F4" style={{marginLeft: 4}} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </Card>

        {/* ── Google Sheets Record ── */}
        <Card variant="elevated" style={styles.infoCard}>
          <View style={styles.driveHeaderRow}>
            <Text style={styles.cardTitle}>Google Sheets Record</Text>
            {sheetRecord ? (
              <View style={styles.driveCheckBadge}>
                <Icon name="check" size={12} color={Colors.success} style={{marginRight: 3}} />
                <Text style={styles.driveCheck}>
                  Logged (Row #{sheetRecord.rowNumber})
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
                <View style={[styles.driveIconBox, {backgroundColor: '#ECFDF5'}]}>
                  <Icon name="table-large" size={24} color="#059669" />
                </View>
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
                <Text style={styles.openSheetBtnText}>Open in Google Sheets</Text>
                <Icon name="open-in-new" size={16} color="#059669" style={{marginLeft: 4}} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.drivePendingContent}>
              <Text style={styles.drivePendingDescription}>
                Calls are automatically logged into your personal "TeleCaller AI - Call Records" spreadsheet across Columns A through N upon processing completion.
              </Text>
              {isSyncingSheet && (
                <View style={styles.uploadingBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.uploadingText}>
                    Logging call details to Google Sheets...
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.openSheetOutlineBtn}
                onPress={handleOpenSheets}
                activeOpacity={0.8}
                accessibilityLabel="Open Google Sheets App"
                accessibilityRole="button">
                <Icon name="google-spreadsheet" size={16} color="#059669" style={{marginRight: 6}} />
                <Text style={styles.openSheetOutlineBtnText}>Open Google Sheets App</Text>
                <Icon name="open-in-new" size={14} color="#059669" style={{marginLeft: 4}} />
              </TouchableOpacity>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* ── Floating Background Upload Indicator ── */}
      {isUploadingDrive && !isUploadModalVisible && (
        <TouchableOpacity
          style={styles.floatingUploadBanner}
          onPress={() => setIsUploadModalVisible(true)}
          activeOpacity={0.88}>
          <View style={styles.floatingUploadIconBox}>
            {isUploadPaused ? (
              <Icon name="pause" size={18} color="#FFFFFF" />
            ) : (
              <ActivityIndicator size="small" color="#FFFFFF" />
            )}
          </View>
          <View style={styles.floatingUploadInfo}>
            <Text style={styles.floatingUploadTitle}>
              {isUploadPaused
                ? `Upload Paused (${driveUploadProgress}%)`
                : `Uploading to Drive (${driveUploadProgress}%)`}
            </Text>
            <Text style={styles.floatingUploadSubtitle}>
              Tap to open controls (Pause / Cancel)
            </Text>
          </View>
          <View style={styles.floatingUploadChevron}>
            <Icon name="chevron-up" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Upload Progress & Control Modal ── */}
      <Modal
        visible={isUploadModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseUploadModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.uploadModalCard}>
            {/* Modal Header */}
            <View style={styles.uploadModalHeader}>
              <View style={styles.uploadModalIconWrap}>
                <Icon name="cloud-upload" size={24} color={Colors.primary} />
              </View>
              <View style={styles.uploadModalTitleWrap}>
                <Text style={styles.uploadModalTitle}>Uploading Recording</Text>
                <Text style={styles.uploadModalSubtitle} numberOfLines={1}>
                  {call?.recordingFileName || call?.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseUploadModal}
                style={styles.uploadModalCloseBtn}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Icon name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Progress Track */}
            <View style={styles.uploadProgressBarTrack}>
              <View
                style={[
                  styles.uploadProgressBarFill,
                  {
                    width: `${Math.max(5, driveUploadProgress)}%`,
                    backgroundColor: isUploadPaused ? '#F59E0B' : Colors.primary,
                  },
                ]}
              />
            </View>

            {/* Progress Info */}
            <View style={styles.uploadProgressInfoRow}>
              <Text style={styles.uploadProgressStatus}>
                {isUploadPaused ? 'Upload Paused' : 'Uploading to Google Drive...'}
              </Text>
              <Text style={styles.uploadProgressPercent}>
                {driveUploadProgress}%
              </Text>
            </View>

            {/* Controls: Pause/Resume + Cancel */}
            <View style={styles.uploadModalActionsRow}>
              <TouchableOpacity
                style={[
                  styles.uploadModalActionBtn,
                  isUploadPaused
                    ? styles.uploadResumeBtn
                    : styles.uploadPauseBtn,
                ]}
                onPress={handleToggleUploadPause}
                activeOpacity={0.8}>
                <Icon
                  name={isUploadPaused ? 'play' : 'pause'}
                  size={16}
                  color={isUploadPaused ? '#FFFFFF' : '#1E293B'}
                  style={{marginRight: 6}}
                />
                <Text
                  style={[
                    styles.uploadModalActionText,
                    {color: isUploadPaused ? '#FFFFFF' : '#1E293B'},
                  ]}>
                  {isUploadPaused ? 'Resume' : 'Pause'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadModalActionBtn, styles.uploadCancelBtn]}
                onPress={handleCancelUpload}
                activeOpacity={0.8}>
                <Icon
                  name="close-circle-outline"
                  size={16}
                  color="#DC2626"
                  style={{marginRight: 6}}
                />
                <Text
                  style={[
                    styles.uploadModalActionText,
                    {color: '#DC2626'},
                  ]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>

            {/* Run in background note */}
            <TouchableOpacity
              style={styles.uploadBackgroundLink}
              onPress={handleCloseUploadModal}>
              <Text style={styles.uploadBackgroundLinkText}>
                Close popup (continue in background)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  topBarTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  topBarSpacer: {
    width: 40, // same visual weight as the back button
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
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callTypeLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  // Pipeline stages card
  pipelineCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
  },
  pipelineHeader: {
    marginBottom: Spacing.lg,
  },
  pipelineTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  pipelineTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pipelineTitle: {
    fontSize: FontSize.base,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  pipelineSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pipelineStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeCompleted: {backgroundColor: Colors.successLight},
  badgeProcessing: {backgroundColor: Colors.primaryLight},
  badgeFailed: {backgroundColor: Colors.errorLight},
  badgePending: {backgroundColor: Colors.surfaceSecondary},
  pipelineStatusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  textCompleted: {color: Colors.success},
  textProcessing: {color: Colors.primary},
  textFailed: {color: Colors.error},
  textPending: {color: Colors.textTertiary},

  // Stepper
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  stepperLine: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  stepperLineDone: {backgroundColor: Colors.primary},
  stepperLineActive: {backgroundColor: Colors.primaryLight},
  stepperLinePending: {backgroundColor: Colors.border},
  stepNodeWrapper: {
    alignItems: 'center',
    width: 52,
  },
  stepNode: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepNodeDone: {
    backgroundColor: Colors.primary,
  },
  stepNodeActive: {
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  stepNodePending: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepLabelDone: {color: Colors.primary, fontWeight: '700'},
  stepLabelActive: {color: Colors.primary, fontWeight: '800'},
  stepLabelPending: {color: Colors.textTertiary},

  pipelineRunBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Shadow.md as object),
  },
  pipelineRunBtnDisabled: {
    opacity: 0.6,
  },
  pipelineRunBtnText: {
    color: Colors.textInverse,
    fontWeight: '700',
    fontSize: FontSize.base,
  },

  // Info Card
  infoCard: {
    padding: Spacing.lg,
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
    paddingVertical: Spacing.xs,
  },
  infoIconWrapper: {
    width: 32,
    alignItems: 'center',
    marginRight: Spacing.sm,
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
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  infoSeparator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },

  // Transcript Preview
  transcriptPreview: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
    fontStyle: 'italic',
  },
  viewTranscriptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
  },
  viewTranscriptText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '700',
  },

  // Drive & Sheets
  driveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  driveCheckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  driveCheck: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '700',
  },
  drivePendingBadge: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  drivePendingText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  sheetSyncingBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  sheetSyncingText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
  driveUploadedContent: {
    gap: Spacing.md,
  },
  driveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  driveIconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driveInfoCol: {
    flex: 1,
  },
  driveStatusTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  drivePathText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  openDriveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  openDriveBtnText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '700',
  },
  openSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  openSheetBtnText: {
    fontSize: FontSize.sm,
    color: '#059669',
    fontWeight: '700',
  },
  drivePendingContent: {
    gap: Spacing.md,
  },
  drivePendingDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  uploadDriveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  uploadDriveBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textInverse,
    fontWeight: '700',
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  uploadingText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Failed banner
  failedBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  failedBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  failedBannerTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.error,
  },
  failedBannerText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    lineHeight: 18,
  },

  // Not found
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  notFoundText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  backLink: {
    fontSize: FontSize.base,
    color: Colors.primary,
    fontWeight: '700',
  },

  // Transcript Badge Button
  viewTranscriptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#818CF8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
    gap: 8,
    elevation: 3,
    shadowColor: '#4F46E5',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  viewTranscriptBadgeText: {
    fontSize: FontSize.xs,
    color: '#3730A3',
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Pending Actions
  pendingActionsRow: {
    gap: Spacing.sm,
  },
  openDriveOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  openDriveOutlineBtnText: {
    fontSize: FontSize.sm,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  openSheetOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  openSheetOutlineBtnText: {
    fontSize: FontSize.sm,
    color: '#047857',
    fontWeight: '700',
  },
  inlineControlsBtn: {
    marginLeft: 'auto',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  inlineControlsBtnText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
  },

  // Floating Background Upload Indicator
  floatingUploadBanner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.xl,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.35,
    shadowRadius: 12,
    zIndex: 999,
  },
  floatingUploadIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  floatingUploadInfo: {
    flex: 1,
  },
  floatingUploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  floatingUploadSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  floatingUploadChevron: {
    marginLeft: 8,
  },

  // Upload Progress & Control Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  uploadModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius['2xl'],
    padding: 24,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  uploadModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  uploadModalTitleWrap: {
    flex: 1,
  },
  uploadModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  uploadModalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  uploadModalCloseBtn: {
    padding: 6,
  },
  uploadProgressBarTrack: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  uploadProgressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  uploadProgressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  uploadProgressStatus: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  uploadProgressPercent: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  uploadModalActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadModalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  uploadPauseBtn: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  uploadResumeBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  uploadCancelBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  uploadModalActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  uploadBackgroundLink: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  uploadBackgroundLinkText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default CallDetailsScreen;
