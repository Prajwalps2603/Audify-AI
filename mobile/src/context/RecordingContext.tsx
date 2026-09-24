// TeleCaller AI — Recording Context (Phase 3 & Phase 4)
// Provides global state for discovered recordings, SAF folder selection, and persistence.

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import {
  DiscoveredRecording,
  ScanStatus,
  CommonFolderInfo,
  SelectedFolder,
} from '../types/recordings';
import {RecordingScannerService} from '../services/scanner/RecordingScannerService';

interface RecordingContextType {
  recordings: DiscoveredRecording[];
  status: ScanStatus;
  errorMessage: string | null;
  lastScannedAt: string | null;
  commonFolders: CommonFolderInfo[];
  selectedFolder: SelectedFolder | null;
  hasCallLogPermission: boolean;
  requestCallLogPermission: () => Promise<boolean>;
  scanRecordings: () => Promise<void>;
  selectFolder: () => Promise<SelectedFolder>;
  changeFolder: () => Promise<SelectedFolder>;
  clearSelectedFolder: () => Promise<void>;
  scanSelectedFolder: () => Promise<void>;
  getRecordingById: (id: string) => DiscoveredRecording | undefined;
}

const RecordingContext = createContext<RecordingContextType | undefined>(
  undefined,
);

export const RecordingProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [recordings, setRecordings] = useState<DiscoveredRecording[]>([]);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [commonFolders, setCommonFolders] = useState<CommonFolderInfo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<SelectedFolder | null>(
    null,
  );
  const [hasCallLogPermission, setHasCallLogPermission] = useState<boolean>(false);

  // Load common folders info, persisted SAF folder, and call log permission on mount
  useEffect(() => {
    RecordingScannerService.getCommonFolders()
      .then(setCommonFolders)
      .catch(() => {});

    RecordingScannerService.getPersistedFolder()
      .then(folder => {
        if (folder) {
          setSelectedFolder(folder);
        }
      })
      .catch(() => {});

    RecordingScannerService.checkCallLogPermission()
      .then(setHasCallLogPermission)
      .catch(() => {});
  }, []);

  const requestCallLogPermission = useCallback(async (): Promise<boolean> => {
    const granted = await RecordingScannerService.requestCallLogPermission();
    setHasCallLogPermission(granted);
    return granted;
  }, []);

  const scanRecordings = useCallback(async () => {
    setStatus('scanning');
    setErrorMessage(null);

    try {
      // Auto-check and request call log permission if not yet granted
      const hasLogPerm = await RecordingScannerService.checkCallLogPermission();
      if (!hasLogPerm) {
        const granted = await RecordingScannerService.requestCallLogPermission();
        setHasCallLogPermission(granted);
      }

      const results = await RecordingScannerService.scanRecordings();
      setRecordings(results);
      setLastScannedAt(new Date().toISOString());

      if (results.length === 0) {
        setStatus('empty');
      } else {
        setStatus('success');
      }

      RecordingScannerService.getCommonFolders()
        .then(setCommonFolders)
        .catch(() => {});
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Failed to scan recordings');
      setStatus('error');
    }
  }, []);

  // Phase 4: Select folder via Storage Access Framework
  const selectFolder = useCallback(async (): Promise<SelectedFolder> => {
    setStatus('scanning');
    setErrorMessage(null);
    try {
      const folder = await RecordingScannerService.openFolderPicker();
      setSelectedFolder(folder);

      // Auto-check and request call log permission if not yet granted
      const hasLogPerm = await RecordingScannerService.checkCallLogPermission();
      if (!hasLogPerm) {
        const granted = await RecordingScannerService.requestCallLogPermission();
        setHasCallLogPermission(granted);
      }

      // Scan the newly chosen folder immediately
      const results = await RecordingScannerService.scanFolderUri(folder.uri);
      setRecordings(results);
      setLastScannedAt(new Date().toISOString());

      if (results.length === 0) {
        setStatus('empty');
      } else {
        setStatus('success');
      }

      return folder;
    } catch (err: any) {
      setStatus('idle');
      setErrorMessage(err?.message ?? 'Folder selection cancelled or failed.');
      throw err;
    }
  }, []);

  // Phase 4: Change folder (alias for re-selecting folder)
  const changeFolder = useCallback(async (): Promise<SelectedFolder> => {
    return await selectFolder();
  }, [selectFolder]);

  // Phase 4: Clear persisted folder
  const clearSelectedFolder = useCallback(async () => {
    await RecordingScannerService.clearPersistedFolder();
    setSelectedFolder(null);
  }, []);

  // Phase 4: Scan specifically the currently selected folder
  const scanSelectedFolder = useCallback(async () => {
    if (!selectedFolder) {
      await scanRecordings();
      return;
    }

    setStatus('scanning');
    setErrorMessage(null);

    try {
      const results = await RecordingScannerService.scanFolderUri(
        selectedFolder.uri,
      );
      setRecordings(results);
      setLastScannedAt(new Date().toISOString());

      if (results.length === 0) {
        setStatus('empty');
      } else {
        setStatus('success');
      }
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Failed scanning selected folder.');
      setStatus('error');
    }
  }, [selectedFolder, scanRecordings]);

  const getRecordingById = useCallback(
    (id: string) => {
      return recordings.find(r => r.id === id);
    },
    [recordings],
  );

  return (
    <RecordingContext.Provider
      value={{
        recordings,
        status,
        errorMessage,
        lastScannedAt,
        commonFolders,
        selectedFolder,
        hasCallLogPermission,
        requestCallLogPermission,
        scanRecordings,
        selectFolder,
        changeFolder,
        clearSelectedFolder,
        scanSelectedFolder,
        getRecordingById,
      }}>
      {children}
    </RecordingContext.Provider>
  );
};

export const useRecordings = (): RecordingContextType => {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecordings must be used within a RecordingProvider');
  }
  return context;
};
