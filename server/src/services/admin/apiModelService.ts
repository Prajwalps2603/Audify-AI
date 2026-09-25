// TeleCaller AI — Server AI Model & API Configuration Service
// Role-based API key and AI Model management for hackerweb402@gmail.com
// Zero dummy data — real empty keys until explicitly entered by Super Admin.

import fs from 'fs';
import path from 'path';

export const ADMIN_EMAIL = 'hackerweb402@gmail.com';

export type ModelTier = 'free' | 'paid';

export interface AIModelConfig {
  id: string;
  name: string;
  providerKey: 'GOOGLE' | 'OPENAI' | 'DEEPGRAM' | 'GROQ' | 'ANTHROPIC' | 'CUSTOM';
  apiKey: string;
  tier: ModelTier;
  price?: string;
  description?: string;
  usageLimit?: string;
  benefits?: string[];
  isActive: boolean;
  createdAt: number;
}

export const INITIAL_AI_MODELS: AIModelConfig[] = [
  {
    id: 'model-google-stt',
    name: 'Google Cloud STT v2',
    providerKey: 'GOOGLE',
    apiKey: '',
    tier: 'free',
    price: 'Free',
    description: 'High-accuracy multi-lingual speech recognition powered by Google Cloud Speech v2 API.',
    usageLimit: 'Standard tier: 60 minutes / call, 5 concurrent streams',
    benefits: [
      'Multi-language automatic detection',
      'High accuracy for Indian accents & regional languages',
      'Realtime word-level timestamps',
      'Direct integration with Google Drive and Sheets',
    ],
    isActive: true,
    createdAt: 1774000000000,
  },
  {
    id: 'model-deepgram-nova',
    name: 'Deepgram Nova-2',
    providerKey: 'DEEPGRAM',
    apiKey: '',
    tier: 'free',
    price: 'Free',
    description: 'State-of-the-art fast automated speech recognition with ultra-low latency.',
    usageLimit: 'Standard tier: Real-time streaming transcription, 250ms latency',
    benefits: [
      'Industry-leading speed & transcription throughput',
      'Speaker diarization & conversational turns',
      'Smart formatting & punctuation',
      'Background noise suppression',
    ],
    isActive: true,
    createdAt: 1774100000000,
  },
  {
    id: 'model-openai-whisper',
    name: 'OpenAI Whisper Large v3',
    providerKey: 'OPENAI',
    apiKey: '',
    tier: 'paid',
    price: '₹199 / month',
    description: 'Premium neural transcription model with benchmark-topping multilingual comprehension.',
    usageLimit: 'Pro tier: 500 hours / month, unlimited audio length, 0 queue delay',
    benefits: [
      'State-of-the-art accuracy across 99+ languages',
      'Handles noisy phone lines and low-fidelity recordings',
      'Automatic translation to English or Hindi',
      'Context-aware acoustic conditioning',
      'Priority enterprise cloud compute',
    ],
    isActive: true,
    createdAt: 1774200000000,
  },
  {
    id: 'model-groq-whisper',
    name: 'Groq Whisper Turbo',
    providerKey: 'GROQ',
    apiKey: '',
    tier: 'free',
    price: 'Free',
    description: 'Lightning-fast LPU inference engine transcribing 1-hour calls in 5 seconds.',
    usageLimit: 'Standard tier: 100 requests / day, ultra-fast batch processing',
    benefits: [
      '216x real-time speed processing',
      'Zero latency transcription preview',
      'Standard punctuation and speaker labeling',
    ],
    isActive: true,
    createdAt: 1774300000000,
  },
  {
    id: 'model-gemini-audio',
    name: 'Gemini 1.5 Pro Audio',
    providerKey: 'CUSTOM',
    apiKey: '',
    tier: 'paid',
    price: '₹349 / month',
    description: 'Next-gen multimodal reasoning model capable of analyzing tone, sentiment, and speaker intent.',
    usageLimit: 'Enterprise tier: 1,000,000 token context window, deep semantic extraction',
    benefits: [
      'End-to-end audio understanding and verbatim transcript',
      'Automatic call sentiment & customer mood analysis',
      'Executive action items & follow-up generator',
      'Full call CRM summary auto-sync to Sheets',
    ],
    isActive: true,
    createdAt: 1774400000000,
  },
];

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'models.json');

function ensureDataFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true});
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_AI_MODELS, null, 2), 'utf-8');
    }
  } catch (e) {
    console.warn('[ServerApiModelService] Failed to ensure data file:', e);
  }
}

function loadModels(): AIModelConfig[] {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Strip any legacy dummy keys
      return parsed.map(m => ({
        ...m,
        apiKey: m.apiKey && !m.apiKey.startsWith('AIzaSyGoogleSTT_') && !m.apiKey.startsWith('sk-proj-openaiwhisper') && !m.apiKey.startsWith('dg_live_') && !m.apiKey.startsWith('gsk_groq') && !m.apiKey.startsWith('AIzaSyGemini')
          ? m.apiKey
          : '',
      }));
    }
  } catch (e) {
    console.warn('[ServerApiModelService] Failed to read models file, fallback to initial:', e);
  }
  return [...INITIAL_AI_MODELS];
}

function saveModels(models: AIModelConfig[]): void {
  ensureDataFile();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(models, null, 2), 'utf-8');
  } catch (e) {
    console.error('[ServerApiModelService] Failed to persist models to disk:', e);
  }
}

let serverModels: AIModelConfig[] = loadModels();

export class ServerApiModelService {
  public static isAdmin(email?: string | null): boolean {
    if (!email) return false;
    return email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
  }

  public static getModels(requesterEmail?: string | null, isVerifiedAdmin: boolean = false): AIModelConfig[] {
    const isAdminUser = isVerifiedAdmin && this.isAdmin(requesterEmail);
    return serverModels.map(m => {
      if (isAdminUser) {
        return {...m};
      }
      // If not authenticated admin, mask the key if set, or return empty
      return {
        ...m,
        apiKey: m.apiKey ? `••••••••••••${m.apiKey.slice(-4)}` : '',
      };
    });
  }

  public static addModel(
    modelData: Omit<AIModelConfig, 'id' | 'createdAt'>,
    requesterEmail?: string | null,
  ): AIModelConfig {
    if (!this.isAdmin(requesterEmail)) {
      throw new Error(`Unauthorized: ${requesterEmail} is not allowed to add models.`);
    }

    const newModel: AIModelConfig = {
      ...modelData,
      apiKey: modelData.apiKey?.trim() || '',
      id: `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    };

    serverModels.unshift(newModel);
    saveModels(serverModels);
    return newModel;
  }

  public static updateModel(
    id: string,
    updates: Partial<AIModelConfig>,
    requesterEmail?: string | null,
  ): AIModelConfig {
    if (!this.isAdmin(requesterEmail)) {
      throw new Error(`Unauthorized: ${requesterEmail} is not allowed to modify models.`);
    }

    const index = serverModels.findIndex(m => m.id === id);
    if (index === -1) {
      throw new Error(`Model with ID ${id} not found.`);
    }

    serverModels[index] = {
      ...serverModels[index],
      ...updates,
      apiKey: updates.apiKey !== undefined ? updates.apiKey.trim() : serverModels[index].apiKey,
    };
    saveModels(serverModels);
    return serverModels[index];
  }

  public static deleteModel(id: string, requesterEmail?: string | null): boolean {
    if (!this.isAdmin(requesterEmail)) {
      throw new Error(`Unauthorized: ${requesterEmail} is not allowed to delete models.`);
    }

    serverModels = serverModels.filter(m => m.id !== id);
    saveModels(serverModels);
    return true;
  }
}
