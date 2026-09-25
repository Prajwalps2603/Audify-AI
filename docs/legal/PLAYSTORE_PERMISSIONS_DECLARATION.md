# Google Play Console — Permissions Declaration Form Guide
## For TeleCaller AI (`READ_CALL_LOG`, `READ_MEDIA_AUDIO`, `POST_NOTIFICATIONS`)

When submitting **TeleCaller AI** to the Google Play Console, Google will flag `READ_CALL_LOG` as a **High-Risk / Restricted Permission**. You must complete the **Permissions Declaration Form** in Play Console.

Use the exact answers below to ensure 100% compliance and prevent app rejection.

---

### Section 1: Core App Functionality
**Question:** What is the primary purpose of your app?  
**Select:** `Call Recording, Management & Productivity / Business Communication Analysis`

---

### Section 2: READ_CALL_LOG Permission Declaration

#### 1. Why does your app need the `READ_CALL_LOG` permission?
**Copy-paste this exact text into Google Play Console:**
> "TeleCaller AI provides users with automated transcription, AI summarization, and cloud backup of telephone call recordings stored locally on their device.
> 
> The `READ_CALL_LOG` permission is required strictly for local correlation: Android saves call recording audio files with generic filenames (such as timestamps or temporary hashes) without embedded contact metadata. TeleCaller AI reads local call logs exclusively on the user's device to match each audio recording with the corresponding phone number, contact name, call direction (incoming/outgoing), and duration.
> 
> Call log data is processed locally on the device and is never sold, shared with data brokers, or transmitted to any advertising networks. It is only included in the user's own designated Google Sheet if the user explicitly turns on Google Sheet export."

#### 2. Does your app transfer Call Log data off the device?
**Select:** `No, except to user-authorized cloud storage (Google Drive / Google Sheets under the user's own account).`

#### 3. Can your app fulfill its core functionality without this permission?
**Answer:**
> "No. Without `READ_CALL_LOG`, call recordings would be displayed as unidentifiable raw audio files without caller names or phone numbers, preventing users from recognizing client conversations or generating organized business call summaries."

---

### Section 3: Audio & Storage Permissions (`READ_MEDIA_AUDIO` / Storage Access Framework)
**Question:** How does your app access user audio files?  
**Answer:**
> "TeleCaller AI utilizes Android's Storage Access Framework (SAF) and scoped media permissions (`READ_MEDIA_AUDIO`) to allow the user to select the specific directory where their call recordings are stored. The application only accesses audio files within the folder explicitly chosen by the user."

---

### Section 4: Foreground Service (`FOREGROUND_SERVICE_DATA_SYNC`)
**Question:** Why does your app use a foreground service?  
**Answer:**
> "TeleCaller AI uses a foreground service with a visible persistent notification to perform user-scheduled background scanning, audio compression, and cloud backups to Google Drive. This ensures that large audio file processing is not prematurely terminated by Android's Doze mode or low-memory killer while a backup is in progress."

---

### Section 5: Play Console Review Video Walkthrough Requirement
Google Play review teams often request a short demonstration video link (YouTube unlisted link or Google Drive link) for `READ_CALL_LOG`.

**Requirements for the review video (30 to 60 seconds):**
1. **Show the Consent Disclosure:** Open the app and show the Onboarding Consent Screen explaining that call logs and audio folders will be accessed.
2. **Show the Permission Prompt:** Show Android's standard system dialog requesting "Allow TeleCaller AI to access your call logs".
3. **Show Core Feature in Action:** Show the Calls screen populated with the matched contact name and phone number alongside the call recording playback.
4. **Show User Control:** Go to Settings → Show that the user can revoke permissions, change recording folders, or wipe account data at any time.

---

### Section 6: Data Safety Form (Google Play Console)

| Field | Value | Notes |
|---|---|---|
| **Does your app collect or share user data?** | `Yes` | Only user-initiated actions |
| **Is all user data encrypted in transit?** | `Yes` | All external API calls use TLS/HTTPS |
| **Do you provide a way for users to request data deletion?** | `Yes` | In-app "Delete Account & Data" wiping Keystore credentials |
| **Personal Info (Name, Email):** | Collected: Yes, Shared: No | For Google Sign-In identification |
| **Audio Files:** | Collected: Yes (Local-first) | Shared only with user's Google Drive and configured AI transcription API |
| **Call Logs:** | Collected: Yes (On-device) | Ephemeral matching, not shared with third parties |
