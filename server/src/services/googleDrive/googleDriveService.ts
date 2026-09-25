// Audify AI — Server Google Drive Service (Phase 7)
// Backend service for handling Google Drive operations, folder structure,
// duplicate protection, and file uploads.

export interface ServerDriveFolder {
  id: string;
  name: string;
}

export interface ServerDriveUploadResult {
  fileId: string;
  name: string;
  webViewLink: string;
  sizeBytes?: number;
}

export class ServerGoogleDriveService {
  private static DRIVE_API = 'https://www.googleapis.com/drive/v3';

  /**
   * Search or create a folder within Google Drive.
   * Ensures folders are never duplicated.
   */
  static async getOrCreateFolder(
    folderName: string,
    accessToken: string,
    parentId?: string,
  ): Promise<string> {
    const parentQuery = parentId ? `'${parentId}' in parents` : `'root' in parents`;
    const q = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${parentQuery}`;
    const searchUrl = `${this.DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: {Authorization: `Bearer ${accessToken}`},
    });

    if (searchRes.ok) {
      const data: any = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    const createRes = await fetch(`${this.DRIVE_API}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed creating folder "${folderName}": ${err}`);
    }

    const created: any = await createRes.json();
    return created.id;
  }

  /**
   * Ensures the mandatory Audify AI folder hierarchy:
   * Audify AI/
   *   Recordings/
   *     YYYY/MM/DD/
   *   Call Records/
   */
  static async ensureFolderHierarchy(
    accessToken: string,
    date: Date = new Date(),
  ): Promise<{
    rootFolderId: string;
    recordingsFolderId: string;
    dateFolderId: string;
    callRecordsFolderId: string;
  }> {
    const rootFolderId = await this.getOrCreateFolder('Audify AI', accessToken);
    const callRecordsFolderId = await this.getOrCreateFolder('Call Records', accessToken, rootFolderId);
    const recordingsFolderId = await this.getOrCreateFolder('Recordings', accessToken, rootFolderId);

    const yearStr = date.getFullYear().toString();
    const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = date.getDate().toString().padStart(2, '0');

    const yearFolderId = await this.getOrCreateFolder(yearStr, accessToken, recordingsFolderId);
    const monthFolderId = await this.getOrCreateFolder(monthStr, accessToken, yearFolderId);
    const dateFolderId = await this.getOrCreateFolder(dayStr, accessToken, monthFolderId);

    return {
      rootFolderId,
      recordingsFolderId,
      dateFolderId,
      callRecordsFolderId,
    };
  }

  /**
   * Duplicate Protection: Checks whether a file already exists in the target folder.
   */
  static async checkDuplicateFile(
    fileName: string,
    folderId: string,
    accessToken: string,
  ): Promise<{ exists: boolean; fileId?: string; webViewLink?: string }> {
    const q = `name = '${fileName}' and '${folderId}' in parents and trashed = false`;
    const searchUrl = `${this.DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`;

    try {
      const res = await fetch(searchUrl, {
        headers: {Authorization: `Bearer ${accessToken}`},
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.files && data.files.length > 0) {
          return {
            exists: true,
            fileId: data.files[0].id,
            webViewLink: data.files[0].webViewLink,
          };
        }
      }
    } catch {}

    return {exists: false};
  }
}
