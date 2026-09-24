# TeleCaller AI — Android Call Conversation Manager

TeleCaller AI is a production-grade, local-first React Native Android application for telecallers, sales reps, and customer success teams. It automatically discovers device call recordings, matches them with device call logs, streams backups to Google Drive, transcribes multilingual conversations via state-of-the-art AI speech models, and synchronizes organized CRM rows into Google Sheets.

---

## 🌟 Key Features Across 16 Phases

1. **Authentication & Session Security (Phases 1 & 2)**
   - Hardware-backed Android KeyStore encryption (`react-native-encrypted-storage`, AES-256 GCM).
   - Google Sign-In with silent refresh and least-privilege OAuth scopes (`drive.file`, `spreadsheets`).
   - Plaintext storage hygiene (zero tokens or secrets in unencrypted AsyncStorage).

2. **Native Recording Scanner & SAF Integration (Phases 3 & 4)**
   - High-performance native MediaStore content indexing.
   - Storage Access Framework (SAF) folder picker with persisted directory URIs.
   - Support for OEM recording directories (Samsung, Xiaomi, OnePlus, Vivo, Oppo, Pixel).

3. **Call Log Correlation & Verification (Phase 5)**
   - On-device timestamp and phone number correlation.
   - Caller name attribution, direction categorization (`Incoming`, `Outgoing`, `Missed`).

4. **In-App Audio Player & Waveform Visualizer (Phase 6)**
   - Play/pause, scrub slider, 10-second skip forwards/backwards.
   - Playback speed controls (0.75x, 1.0x, 1.25x, 1.5x, 2.0x).

5. **Google Drive Cloud Backup (Phase 7)**
   - Resumable streaming upload via Google Drive v3 REST API.
   - Automatic parent folder creation (`TeleCaller AI Recordings`) and duplicate detection via SHA-256 hash.

6. **Google Sheets CRM Sync (Phase 8)**
   - Dynamic spreadsheet initialization with styled headers.
   - Real-time row append: Caller, Phone Number, Date/Time, Duration, Audio URL, Transcript Preview.

7. **Multi-Provider Speech-to-Text (Phases 9 & 10)**
   - Pluggable STT architecture: Google Cloud Speech-to-Text v2, OpenAI Whisper API, Deepgram Nova-2, and AssemblyAI.
   - Automatic language detection (English, Hindi, Malayalam, Tamil, Telugu, etc.).
   - Interactive diarized transcript viewer with speaker roles (`CALLER` / `RECEIVER`).

8. **Automated End-to-End Pipeline (Phase 11)**
   - Single-tap or automated 5-stage pipeline: `MATCH` ➔ `DRIVE` ➔ `TRANSCRIPTION` ➔ `SHEETS` ➔ `COMPLETED`.
   - Real-time visual steppers and stage badges.

9. **Background Processing & Automation (Phase 12)**
   - Kotlin Foreground Service (`TeleCallerForegroundService.kt`) with persistent notification.
   - Periodic scan watchdog with customizable intervals (5m, 15m, 30m, 60m).
   - Wi-Fi only synchronization guard and Android Doze mode exemption management.

10. **Advanced Search & Multi-Dimensional Filters (Phase 13)**
    - Full-text conversational transcript search with snippet highlighting.
    - Multi-dimensional filters: Date range (Today, Yesterday, Week, Month), Call Type, Duration brackets (<1m, 1-5m, >5m), and Call Log match status.

11. **Security & Privacy Audit Suite (Phase 14)**
    - Real-time diagnostic inspector auditing KeyStore probes, storage hygiene, Scoped Storage compliance, TLS transport security, and permission health.
    - Zero Data Selling Pledge and transparent user consent modals.

12. **Robust Test Suite & Fault Tolerance (Phase 15)**
    - 6 comprehensive Jest test suites (21 unit tests, 100% pass rate).
    - Network failure recovery, graceful degradation, and retry mechanics.

13. **Release Packaging & Production Readiness (Phase 16)**
    - Production R8/ProGuard configuration.
    - Optimized Hermes bytecode compilation.

---

## 🏗️ Architecture & Pipeline Flow

```
[Phone Call Ends] ──> [Audio Saved to Storage]
                             │
                             ▼
              [RecordingScanner Native Module]
              (MediaStore / SAF DocumentFile)
                             │
                             ▼
               [Call Log & Contacts Matching]
                             │
                             ▼
            [PipelineService End-to-End Runner]
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
[Google Drive Upload]  [AI Speech-to-Text]  [Google Sheets CRM]
(drive.file scope)     (Whisper/Google STT) (Auto-append row)
        └────────────────────┬────────────────────┘
                             ▼
             [Finalized Call Record & Storage]
             (Interactive Player, Search, UI)
```

---

## 🚀 Setup & Execution

### Prerequisites
- Node.js >= 22.11.0
- JDK 17
- Android SDK (API 34+)

### Installation
```bash
cd mobile
npm install
```

### Environment Configuration
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```

### Running Tests
```bash
npm test
```

### Running TypeScript Check
```bash
npx tsc --noEmit
```

### Running in Development
```bash
# Start Metro bundler
npm start

# Run on connected Android device/emulator
npm run android
```

### Production Release Bundling
```bash
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res/
```

---

## 🔒 Security & Privacy Architecture
- **Android KeyStore**: Auth tokens are encrypted with AES-256 GCM.
- **Scoped Storage**: No broad `MANAGE_EXTERNAL_STORAGE` permission required. Operates strictly within system MediaStore and user-chosen SAF folders.
- **Least-Privilege Scopes**: Requests only `drive.file` and `spreadsheets`. Never accesses unauthorized user files.
- **Transport Security**: All external communications strictly enforce TLS 1.2/1.3. Cleartext HTTP is disabled.

---

## 📄 License
Proprietary & Confidential. All rights reserved.
