// TeleCaller AI — Transcription Types

import {TranscriptSegment, SpeakerRole} from './index';

export type SpeechProvider = 'GOOGLE' | 'OPENAI' | 'DEEPGRAM';

export interface SpeechProviderInfo {
  id: SpeechProvider;
  name: string;
  description: string;
  model: string;
  supportsDiarization: boolean;
  supportsMultilingual: boolean;
}

export const SUPPORTED_PROVIDERS: Record<SpeechProvider, SpeechProviderInfo> = {
  GOOGLE: {
    id: 'GOOGLE',
    name: 'Google Cloud Speech-to-Text',
    description: 'v2 Chirp & multi-language diarization with high accuracy for Indian regional languages.',
    model: 'chirp_2 / telephony',
    supportsDiarization: true,
    supportsMultilingual: true,
  },
  OPENAI: {
    id: 'OPENAI',
    name: 'OpenAI Whisper',
    description: 'High robustness across accents, background noise, and multi-lingual conversations.',
    model: 'whisper-1',
    supportsDiarization: true,
    supportsMultilingual: true,
  },
  DEEPGRAM: {
    id: 'DEEPGRAM',
    name: 'Deepgram Nova-2',
    description: 'Ultra low-latency speech-to-text with conversational diarization and word timestamps.',
    model: 'nova-2-phonecall',
    supportsDiarization: true,
    supportsMultilingual: true,
  },
};

export interface TranscriptionConfig {
  provider: SpeechProvider;
  apiKey?: string;
  languageDetection: boolean;
  model?: string;
  targetLanguage?: string;
}

export interface TranscriptionResult {
  callId: string;
  language: string;
  confidence?: number;
  transcriptPreview: string;
  segments: TranscriptSegment[];
  transcribedAt: string;
  provider: SpeechProvider;
}

export interface TranscriptionProgress {
  callId: string;
  status: 'idle' | 'preparing' | 'processing' | 'diarizing' | 'completed' | 'failed';
  progressPercent: number;
  error?: string;
}
