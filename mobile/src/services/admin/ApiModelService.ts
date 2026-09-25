// TeleCaller AI — Mobile AI Model & API Key Management Service
// Full backend integration for Super Admin controls & User selection
// Zero dummy data — real empty keys until explicitly entered by Super Admin.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {ADMIN_EMAIL} from './AdminConfigService';
import {getBackendUrl, detectActiveBackend, ADMIN_API_SECRET} from '../../config/backend';

export type ModelTier = 'free' | 'paid';

export type ProviderKey =
  | 'GOOGLE'
  | 'OPENAI'
  | 'DEEPGRAM'
  | 'GROQ'
  | 'ANTHROPIC'
  | 'CUSTOM';

export interface AIModelConfig {
  id: string;
  name: string;
  providerKey: ProviderKey;
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
    description:
      'High-accuracy multi-lingual speech recognition powered by Google Cloud Speech v2 API.',
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
    description:
      'State-of-the-art fast automated speech recognition with ultra-low latency.',
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
    description:
      'Premium neural transcription model with benchmark-topping multilingual comprehension.',
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
    description:
      'Lightning-fast LPU inference engine transcribing 1-hour calls in 5 seconds.',
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
    description:
      'Next-gen multimodal reasoning model capable of analyzing tone, sentiment, and speaker intent.',
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

const STORAGE_KEY = '@telecaller_ai_models_v1';
const SELECTED_MODEL_KEY = '@telecaller_selected_model_id_v1';

// Helper to remove any legacy dummy strings
function cleanDummyKeys(models: AIModelConfig[]): AIModelConfig[] {
  return models.map(m => {
    const k = m.apiKey || '';
    if (
      k.startsWith('AIzaSyGoogleSTT_') ||
      k.startsWith('dg_live_84f93b02') ||
      k.startsWith('sk-proj-openaiwhisper') ||
      k.startsWith('gsk_groq_whisper') ||
      k.startsWith('AIzaSyGemini_Pro')
    ) {
      return {...m, apiKey: ''};
    }
    return m;
  });
}

class ApiModelServiceClass {
  private models: AIModelConfig[] = cleanDummyKeys([...INITIAL_AI_MODELS]);
  private selectedModelId: string = 'model-google-stt';
  private listeners: Array<(models: AIModelConfig[]) => void> = [];
  private isLoaded = false;
  private currentUserEmail: string = '';

  constructor() {
    this.loadFromStorage();
  }

  public setUserEmail(email?: string | null): void {
    if (email && email !== this.currentUserEmail) {
      this.currentUserEmail = email;
      this.syncFromBackend(email);
    }
  }

  public async loadFromStorage(): Promise<AIModelConfig[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: AIModelConfig[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.models = cleanDummyKeys(parsed);
        }
      }
      const selected = await AsyncStorage.getItem(SELECTED_MODEL_KEY);
      if (selected) {
        this.selectedModelId = selected;
      }
    } catch (e) {
      console.warn('[ApiModelService] Failed to load models from storage:', e);
    } finally {
      this.isLoaded = true;
      this.notifyListeners();
    }

    // Only sync from backend when a real email is already set;
    // otherwise wait for setUserEmail() to trigger the first sync.
    if (this.currentUserEmail) {
      this.syncFromBackend(this.currentUserEmail);
    }
    return this.models;
  }

  /**
   * Sync latest models from backend server
   */
  public async syncFromBackend(userEmail?: string | null): Promise<AIModelConfig[]> {
    try {
      await detectActiveBackend();
      const backendUrl = getBackendUrl();
      const email = userEmail || this.currentUserEmail || '';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(
        `${backendUrl}/api/admin/models?email=${encodeURIComponent(email)}`,
        {
          signal: controller.signal,
          headers: {
            'x-admin-key': ADMIN_API_SECRET,
            'x-admin-email': email,
          },
        },
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.models)) {
          this.models = cleanDummyKeys(data.models);
          await this.saveToStorage();
          this.notifyListeners();
        }
      }
    } catch (e) {
      // Backend not reached, keep cached models
    }
    return this.models;
  }

  public getModels(userEmail?: string | null): AIModelConfig[] {
    const email = userEmail || this.currentUserEmail;
    const isAdmin =
      email && email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();

    if (isAdmin) {
      return [...this.models];
    }
    // Return sanitized models for regular users
    return this.models.map(m => ({
      ...m,
      apiKey: m.apiKey ? `••••••••••••${m.apiKey.slice(-4)}` : '',
    }));
  }

  public getModelById(id: string): AIModelConfig | undefined {
    return this.models.find(m => m.id === id);
  }

  public getSelectedModelId(): string {
    return this.selectedModelId;
  }

  public async setSelectedModelId(id: string): Promise<void> {
    this.selectedModelId = id;
    try {
      await AsyncStorage.setItem(SELECTED_MODEL_KEY, id);
    } catch (e) {
      console.warn('[ApiModelService] Failed to store selected model:', e);
    }
  }

  public async addModel(
    modelData: Omit<AIModelConfig, 'id' | 'createdAt'>,
    requesterEmail?: string | null,
  ): Promise<AIModelConfig> {
    const email = requesterEmail || this.currentUserEmail;
    const isAdmin =
      email && email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      throw new Error(
        `Unauthorized: Only ${ADMIN_EMAIL} can add new AI models or API keys.`,
      );
    }

    const payload = {
      ...modelData,
      apiKey: modelData.apiKey?.trim() || '',
    };

    // Try saving directly to backend
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/admin/models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_API_SECRET,
          'x-admin-email': email,
        },
        body: JSON.stringify({model: payload, email}),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.model) {
          const created: AIModelConfig = cleanDummyKeys([data.model])[0];
          this.models = [created, ...this.models.filter(m => m.id !== created.id)];
          await this.saveToStorage();
          this.notifyListeners();
          return created;
        }
      }
    } catch (e) {
      console.warn('[ApiModelService] Backend unreachable, adding locally:', e);
    }

    // Local fallback
    const newModel: AIModelConfig = {
      ...payload,
      id: `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    };

    this.models = [newModel, ...this.models];
    await this.saveToStorage();
    this.notifyListeners();
    return newModel;
  }

  public async updateModel(
    id: string,
    updates: Partial<AIModelConfig>,
    requesterEmail?: string | null,
  ): Promise<AIModelConfig> {
    const email = requesterEmail || this.currentUserEmail;
    const isAdmin =
      email && email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      throw new Error(`Unauthorized: Only ${ADMIN_EMAIL} can modify AI models.`);
    }

    const index = this.models.findIndex(m => m.id === id);
    if (index === -1) {
      throw new Error(`Model not found with ID ${id}`);
    }

    // Try updating on backend
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/admin/models/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_API_SECRET,
          'x-admin-email': email,
        },
        body: JSON.stringify({updates, email}),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.model) {
          const updated: AIModelConfig = cleanDummyKeys([data.model])[0];
          this.models[index] = updated;
          await this.saveToStorage();
          this.notifyListeners();
          return updated;
        }
      }
    } catch (e) {
      console.warn('[ApiModelService] Backend unreachable, updating locally:', e);
    }

    // Local fallback
    this.models[index] = {
      ...this.models[index],
      ...updates,
      apiKey: updates.apiKey !== undefined ? updates.apiKey.trim() : this.models[index].apiKey,
    };
    await this.saveToStorage();
    this.notifyListeners();
    return this.models[index];
  }

  public async deleteModel(
    id: string,
    requesterEmail?: string | null,
  ): Promise<boolean> {
    const email = requesterEmail || this.currentUserEmail;
    const isAdmin =
      email && email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      throw new Error(`Unauthorized: Only ${ADMIN_EMAIL} can delete AI models.`);
    }

    // Try deleting on backend
    try {
      const backendUrl = getBackendUrl();
      await fetch(`${backendUrl}/api/admin/models/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_API_SECRET,
          'x-admin-email': email,
        },
        body: JSON.stringify({email}),
      });
    } catch (e) {
      console.warn('[ApiModelService] Backend unreachable, deleting locally:', e);
    }

    this.models = this.models.filter(m => m.id !== id);
    if (this.selectedModelId === id && this.models.length > 0) {
      this.selectedModelId = this.models[0].id;
    }
    await this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  public async setModelTier(
    id: string,
    tier: ModelTier,
    price?: string,
    requesterEmail?: string | null,
  ): Promise<AIModelConfig> {
    return this.updateModel(
      id,
      {
        tier,
        price: tier === 'free' ? 'Free' : (price || '₹199 / month'),
      },
      requesterEmail,
    );
  }

  public subscribe(listener: (models: AIModelConfig[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.models]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private async saveToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.models));
    } catch (e) {
      console.warn('[ApiModelService] Failed to save models:', e);
    }
  }

  private notifyListeners(): void {
    const copy = [...this.models];
    this.listeners.forEach(l => {
      try {
        l(copy);
      } catch (e) {
        console.error('[ApiModelService] Listener error:', e);
      }
    });
  }
}

export const ApiModelService = new ApiModelServiceClass();
