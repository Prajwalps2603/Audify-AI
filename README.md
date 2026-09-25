# Audify AI

<div align="center">

```
    _   _   _ ____  ___ _____   __   __     _    ___ 
   / \ | | | ||  _ \|_ _||  ___| \ \ / /   / \  |_ _|
  / _ \| | | || | | || | | |_     \ V /   / _ \  | | 
 / ___ \| |_| || |_| || | |  _|    | |   / ___ \ | | 
/_/   \_\\___/ |____/|___|_|       |_|  /_/   \_\___|
```

### Record • Transcribe • Organize • Automate

[![React Native](https://img.shields.io/badge/React%20Native-0.87.1-blue.svg)](https://reactnative.dev/)
[![React](https://img.shields.io/badge/React-19.2.3-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933.svg)](https://nodejs.org/)
[![Android](https://img.shields.io/badge/Platform-Android%2024+-3DDC84.svg)](https://www.android.com/)
[![HTTPS](https://img.shields.io/badge/HTTPS-Let's%20Encrypt-00C853.svg)](https://letsencrypt.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Audify AI** is an intelligent, privacy-first mobile companion for authorized telecallers, sales reps, and customer success agents. It automatically detects phone call recordings on Android, links call metadata, backs up audio to Google Drive, generates AI-powered speech-to-text transcriptions with speaker diarization, and syncs organized summaries directly into Google Sheets CRM tables — all backed by a hardened **HTTPS Express backend** with Let's Encrypt auto-renewal.

</div>

---

## 🚀 Key Features

- 🎙️ **Automated Recording Discovery**: Real-time media scanner discovers audio recordings across Android internal storage and custom directories via SAF (Storage Access Framework).
- 🔗 **Call Metadata Matching**: Correlates device call logs (duration, timestamp, incoming/outgoing/missed status, contact name) with audio files using fuzzy time window matching.
- ☁️ **Google Drive Backup**: Uploads recordings directly to a secure, organized user Drive folder (`Audify AI Recordings`) with duplicate checks.
- 🗣️ **Multi-Provider AI Transcription**: Pluggable Speech-to-Text supporting **Google Cloud Speech-to-Text v2**, **OpenAI Whisper**, **Deepgram Nova-2**, and **AssemblyAI** with diarization and confidence scores.
- 📊 **Google Sheets CRM Sync**: Real-time export of structured call summaries, sentiment, duration, audio links, and transcripts into automated Google Sheets spreadsheets.
- ⚡ **Automated 4-Stage Pipeline**: End-to-end background orchestration (`Discovery → Drive Upload → Transcription → CRM Sync`) with retry queues and exponential backoff.
- 🛡️ **Native Android Foreground Service**: Background monitoring module with Doze mode exemption, persistent notification, and periodic sync intervals (15m, 30m, 1h, 4h).
- 🔒 **Enterprise-Grade Security**: OAuth 2.0 PKCE authentication, AES-encrypted token persistence via `react-native-encrypted-storage`, zero plain-text token logging, and optional biometric app locking.
- 🌐 **HTTPS with Auto-Renewal**: Backend runs HTTPS with Let's Encrypt (Greenlock) in production — certificates renew automatically. Self-signed cert auto-generated for local development.

---

## 📐 Architecture & Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ANDROID MOBILE APP                              │
│                 (React Native 0.87.1 + TypeScript 6.0)                 │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 ↓                   ↓                   ↓
         ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
         │ Native Call   │   │ Storage SAF   │   │ Foreground    │
         │ Log Resolver  │   │ Audio Scanner │   │ Sync Service  │
         └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
                 │                   │                   │
                 └───────────────────┼───────────────────┘
                                     ↓
                  ┌─────────────────────────────────────┐
                  │      4-STAGE AUTOMATED PIPELINE     │
                  │                                     │
                  │  1. Match Recording ↔ Call Log      │
                  │  2. Stream Audio to Google Drive    │
                  │  3. Multi-Provider STT & Diarization│
                  │  4. Insert Structured CRM Row       │
                  └──────────────────┬──────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ↓                            ↓                            ↓
┌───────────────┐            ┌───────────────┐            ┌───────────────┐
│ Google Drive  │            │ Google Sheets │            │ AI STT Cloud  │
│  Cloud Backup │            │   Live CRM    │            │ (Google/OpenAI│
│               │            │               │            │ Deepgram/AAI) │
└───────────────┘            └───────────────┘            └───────────────┘
                                     │
                                     ↓
               ┌──────────────────────────────────────────┐
               │         AUDIFY AI BACKEND SERVER         │
               │     Node.js + Express + TypeScript        │
               │  HTTPS: Let's Encrypt (Greenlock) / Dev  │
               │  Auto-renewal • Rate Limiting • Helmet   │
               └──────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
AudifyAI/
├── mobile/                          # React Native Android Mobile Application
│   ├── android/                     # Native Android Gradle Project & JNI
│   │   ├── app/                     # Main Android Application module
│   │   │   └── src/main/java/       # Kotlin modules (Foreground Service, SAF)
│   │   └── build.gradle
│   ├── src/
│   │   ├── components/              # Reusable UI widgets (Player, Cards, Badges)
│   │   ├── context/                 # Global State (AuthContext, RecordingContext)
│   │   ├── navigation/              # React Navigation Root & Tab Navigators
│   │   ├── screens/
│   │   │   ├── Login/               # OAuth 2.0 Google Onboarding
│   │   │   ├── Home/                # Dashboard stats, quick actions & scanner
│   │   │   ├── Calls/               # Filterable call recording list
│   │   │   ├── CallDetails/         # Metadata, audio player & sync actions
│   │   │   ├── Transcript/          # Full diarized transcript viewer
│   │   │   └── Settings/            # Provider picker, background & Drive configs
│   │   ├── services/
│   │   │   ├── auth/                # Google OAuth token management
│   │   │   ├── background/          # Android Foreground Service bridge
│   │   │   ├── drive/               # Google Drive REST v3 integration
│   │   │   ├── pipeline/            # 4-stage background processing engine
│   │   │   ├── scanner/             # MediaStore & SAF audio file scanner
│   │   │   ├── sheets/              # Google Sheets REST v4 CRM sync
│   │   │   └── transcription/       # Multi-provider STT adapter
│   │   ├── theme/                   # Design tokens (Colors, Typography, Spacing)
│   │   └── types/                   # Full TypeScript interface definitions
│   └── package.json
│
├── server/                          # Node.js + Express Backend Server
│   ├── src/
│   │   ├── server.ts                # Main server entry point (HTTPS + routes)
│   │   ├── https/
│   │   │   └── httpsServer.ts       # Dual-mode HTTPS (Greenlock / self-signed)
│   │   └── services/
│   │       └── admin/               # Admin config & AI model management
│   ├── .env.example                 # Environment variable template
│   └── package.json
│
└── README.md
```

---

## 🏆 Project Milestones & Completion

| Phase | Description | Status |
|:-----:|-------------|:------:|
| **1** | Design System, Architecture & UI Skeleton | ✅ Complete |
| **2** | Google OAuth 2.0 PKCE Sign-In & Token Persistence | ✅ Complete |
| **3** | MediaStore Device Call Recording Discovery | ✅ Complete |
| **4** | Android SAF Folder Picker & Persistent URI Permissions | ✅ Complete |
| **5** | Device Call Log Metadata Matching (Fuzzy Window) | ✅ Complete |
| **6** | Audio Player with Scrubbing, Speed Controls & Waveforms | ✅ Complete |
| **7** | Google Drive REST API Multipart Audio Uploads | ✅ Complete |
| **8** | Google Sheets CRM Integration & Auto-Spreadsheet Generation | ✅ Complete |
| **9** | Multi-Provider Speech-to-Text (Google, Whisper, Deepgram, AssemblyAI) | ✅ Complete |
| **10** | Diarized Transcript UI with Speaker Badges & Search | ✅ Complete |
| **11** | 4-Stage Automated Pipeline with Queue & Retry Mechanism | ✅ Complete |
| **12** | Native Android Foreground Service & Battery Doze Exemption | ✅ Complete |
| **13** | Advanced Call Search, Date Filters & Status Badges | ✅ Complete |
| **14** | Enterprise Security, Encrypted Storage & Privacy Audit | ✅ Complete |
| **15** | Comprehensive End-to-End Suite & Automated Jest Tests | ✅ Complete |
| **16** | Production Release Engineering & Physical Device Deployment | ✅ Complete |
| **17** | HTTPS Backend with Let's Encrypt Auto-Renewal (Greenlock) | ✅ Complete |

---

## 🛠️ Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| **Node.js** | `22.x` or later |
| **Java Development Kit** | JDK 17 (Eclipse Temurin or Oracle JDK 17) |
| **Android Studio** | Ladybug / Meerkat |
| **Android SDK Platform** | API 34+ |
| **Android NDK** | `26.1.10909125` |
| **CMake** | `3.22.1` |

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Prajwalps2603/TeleCall-AI.git
cd TeleCall-AI

# Install mobile dependencies
cd mobile && npm install

# Install server dependencies
cd ../server && npm install
```

### 2. Configure Environment

**Mobile** — Create `mobile/.env`:
```env
# Google Cloud OAuth Web Client ID (from Google Cloud Console)
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com

# Target Drive Folder & Sheets ID (optional, created automatically if blank)
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_SHEETS_SPREADSHEET_ID=

# Active Speech-to-Text Engine: GOOGLE | OPENAI | DEEPGRAM | ASSEMBLYAI
DEFAULT_STT_PROVIDER=GOOGLE
GOOGLE_SPEECH_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
```

**Server** — Copy and edit `server/.env.example` → `server/.env`:
```bash
cp server/.env.example server/.env
# Edit server/.env — set ADMIN_SECRET_KEY, JWT_SECRET, etc.
```

### 3. Google Cloud Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable APIs:
   - **Google Drive API**
   - **Google Sheets API**
   - **Cloud Speech-to-Text API**
3. Configure the **OAuth Consent Screen**:
   - Add scopes: `.../auth/drive.file`, `.../auth/spreadsheets`
   - Add your test user email under **Test Users**.
4. Create Credentials:
   - **Android Client ID**: Package `com.audifyai` with SHA-1 fingerprint.
   - **Web Application Client ID**: Copy the Client ID into `GOOGLE_WEB_CLIENT_ID`.

### 4. Run the Backend Server

```bash
cd server
npm run dev
# HTTPS dev server starts at https://localhost:3443
# (self-signed cert is auto-generated — accept it in your browser)
```

> **Health check**: `GET https://localhost:3443/api/health`

### 5. Build and Run Mobile App on Android

Connect your Android phone with USB debugging enabled:

```bash
# Verify phone is connected
adb devices

# Start Metro bundler
cd mobile && npm start

# In another terminal — build and install
cd mobile
npx react-native run-android

# Or build a debug APK directly
cd mobile/android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.audifyai/.MainActivity
```

---

## 🌐 HTTPS Setup (Production)

The backend ships with **dual-mode HTTPS**:

| Mode | Trigger | How it works |
|------|---------|-------------|
| **Development** | `NODE_ENV` ≠ `production` OR `DOMAIN` not set | Auto-generates a self-signed cert in `server/.dev-certs/` on first run. Cert is reused across restarts. HTTP → HTTPS redirect on `HTTP_PORT`. |
| **Production** | `NODE_ENV=production` AND `DOMAIN` is set | Uses **Greenlock (Let's Encrypt)** — issues real certificates and renews them automatically before expiry. |

### Production Deployment Steps

1. **Point your domain** to your server's IP (A record in DNS).
2. **Set env vars** in `server/.env`:
   ```env
   NODE_ENV=production
   DOMAIN=api.audifyai.com
   MAINTAINER_EMAIL=your@email.com
   HTTP_PORT=80          # Must be 80 for ACME challenge
   HTTPS_PORT=443
   LETS_ENCRYPT_STAGING=true   # Test first!
   ```
3. **Start the server** (requires ports 80 & 443 to be open in your firewall):
   ```bash
   npm run build && npm start
   ```
4. **Verify staging cert** works (browser will warn, that's OK for staging).
5. **Switch to real certs** — set `LETS_ENCRYPT_STAGING=false` and restart.

> ⚠️ Let's Encrypt requires port **80** to be open for the ACME HTTP-01 challenge. The server automatically handles the challenge — no NGINX needed.

---

## 🔒 Security & Privacy

- **On-Device First**: Audio files remain locally on your phone unless explicitly backed up to your personal Google Drive.
- **Zero Third-Party Relays**: Direct HTTPS communication between the mobile app and Google APIs / Speech APIs; no intermediary server.
- **Encrypted Storage**: OAuth refresh tokens, session tokens, and API credentials are kept in Android `EncryptedSharedPreferences` via keystore-backed AES-256 GCM encryption.
- **Explicit Consent**: Granular runtime permissions requested for Call Logs, Microphone, Storage, and Foreground Services.
- **HTTPS Everywhere**: Backend enforces TLS 1.2/1.3 with automatic certificate renewal via Let's Encrypt.
- **Admin Auth**: All sensitive admin routes require both a secret key (`x-admin-key` header) and an authorized email.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
