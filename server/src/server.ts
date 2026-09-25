// Audify AI — Main Backend Express Server
// Centralized, hardened backend with HTTPS (Let's Encrypt auto-renewal in production,
// self-signed cert in development). Handles Admin settings, feature toggles, and AI Models.

import express, {Request, Response, NextFunction} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import {ServerAdminService, ADMIN_EMAIL} from './services/admin/adminConfigService';
import {ServerApiModelService} from './services/admin/apiModelService';
import {startHttpsServer} from './https/httpsServer';

dotenv.config();

const app = express();
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '80', 10);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443', 10);
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'tc_sec_admin_key_9948_auth_2026';

// ── Security Middleware ──
app.use(helmet({
  contentSecurityPolicy: false, // For API-only server
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-admin-email'],
}));

app.use(express.json({limit: '256kb'}));

// ── Rate Limiting ──
// General limiter: Max 500 requests per 15 mins per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {success: false, error: 'Too many requests from this IP. Please try again later.'},
});
app.use('/api/', generalLimiter);

// Sensitive Admin mutations limiter: Max 60 operations per 15 mins per IP
const adminMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {success: false, error: 'Too many admin action requests. Please slow down.'},
});

// ── Admin Authentication Middleware ──
function checkIsAdminAuthenticated(req: Request): boolean {
  const adminKey = (req.headers['x-admin-key'] as string) ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const email = ((req.body?.email || req.query?.email || req.headers['x-admin-email']) as string) || '';

  const isEmailAdmin = email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
  const isKeyValid = adminKey === ADMIN_SECRET_KEY;

  return isEmailAdmin && isKeyValid;
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  if (!checkIsAdminAuthenticated(req)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Valid Admin Secret Key and Super Admin authorization required.',
    });
  }
  next();
}

// ── Request Logger (non-verbose for production) ──
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.method !== 'GET') {
    const email = (req.body?.email || req.query?.email || req.headers['x-admin-email']) as string | undefined;
    console.log(`[Audify AI Security] ${req.method} ${req.path} — requester: ${email || 'anonymous'}`);
  }
  next();
});

// ── Health Check ──
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Audify AI Backend',
    adminEmail: ADMIN_EMAIL,
    security: {
      rateLimiting: 'active',
      helmet: 'active',
      adminKeyAuth: 'enforced',
    },
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
// Admin Feature Visibility Toggles Routes
// ─────────────────────────────────────────────────────────────

// GET /api/admin/config?email=user@example.com
app.get('/api/admin/config', (req: Request, res: Response) => {
  const email = (req.query.email as string) || '';
  const config = ServerAdminService.getConfigForUser(email);
  const isAdmin = checkIsAdminAuthenticated(req);

  res.json({
    success: true,
    isAdmin,
    config,
  });
});

// POST /api/admin/config (Protected)
app.post('/api/admin/config', adminMutationLimiter, requireAdminAuth, (req: Request, res: Response) => {
  try {
    const {updates, email} = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({success: false, error: 'Updates object is required.'});
    }
    const updated = ServerAdminService.updateConfig(updates, email);
    res.json({
      success: true,
      config: updated,
    });
  } catch (e: any) {
    res.status(403).json({
      success: false,
      error: e?.message || 'Unauthorized to update admin configuration.',
    });
  }
});

// POST /api/admin/config/reset (Protected)
app.post('/api/admin/config/reset', adminMutationLimiter, requireAdminAuth, (req: Request, res: Response) => {
  try {
    const {email} = req.body;
    const reset = ServerAdminService.resetConfig(email);
    res.json({
      success: true,
      config: reset,
    });
  } catch (e: any) {
    res.status(403).json({
      success: false,
      error: e?.message || 'Unauthorized to reset admin configuration.',
    });
  }
});

// ─────────────────────────────────────────────────────────────
// AI Models & API Keys Management Routes
// ─────────────────────────────────────────────────────────────

// GET /api/admin/models?email=user@example.com
app.get('/api/admin/models', (req: Request, res: Response) => {
  const email = (req.query.email as string) || '';
  const isAuthAdmin = checkIsAdminAuthenticated(req);
  // Unmasked keys are ONLY returned if the request is authenticated with the Admin Secret Key
  const models = ServerApiModelService.getModels(email, isAuthAdmin);

  res.json({
    success: true,
    isAdmin: isAuthAdmin,
    models,
  });
});

// POST /api/admin/models (Protected)
app.post('/api/admin/models', adminMutationLimiter, requireAdminAuth, (req: Request, res: Response) => {
  try {
    const {model, email} = req.body;
    if (!model || typeof model.name !== 'string' || !model.name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Model name is required.',
      });
    }

    const created = ServerApiModelService.addModel(model, email);
    res.status(201).json({
      success: true,
      model: created,
    });
  } catch (e: any) {
    res.status(403).json({
      success: false,
      error: e?.message || 'Unauthorized: Only Super Admin can add models.',
    });
  }
});

// PUT /api/admin/models/:id (Protected)
app.put('/api/admin/models/:id', adminMutationLimiter, requireAdminAuth, (req: Request, res: Response) => {
  try {
    const {id} = req.params;
    const {updates, email} = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({success: false, error: 'Updates object is required.'});
    }

    const updated = ServerApiModelService.updateModel(id, updates, email);
    res.json({
      success: true,
      model: updated,
    });
  } catch (e: any) {
    const isNotFound = e?.message?.includes('not found');
    res.status(isNotFound ? 404 : 403).json({
      success: false,
      error: e?.message || 'Unauthorized: Only Super Admin can update models.',
    });
  }
});

// DELETE /api/admin/models/:id (Protected)
app.delete('/api/admin/models/:id', adminMutationLimiter, requireAdminAuth, (req: Request, res: Response) => {
  try {
    const {id} = req.params;
    const email = (req.body?.email || req.query?.email || req.headers['x-admin-email']) as string;

    const deleted = ServerApiModelService.deleteModel(id, email);
    res.json({
      success: true,
      deleted,
    });
  } catch (e: any) {
    res.status(403).json({
      success: false,
      error: e?.message || 'Unauthorized: Only Super Admin can delete models.',
    });
  }
});

// 404 Handler for unknown routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({success: false, error: 'Endpoint not found.'});
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Audify AI Server Error]:', err);
  res.status(500).json({
    success: false,
    error: err?.message || 'Internal server error',
  });
});

// ── HTTPS Server Startup ──────────────────────────────────────────────────
// Reads NODE_ENV, DOMAIN, HTTP_PORT, HTTPS_PORT, MAINTAINER_EMAIL from .env
// Production (NODE_ENV=production + DOMAIN set) → Let's Encrypt auto-renewal
// Development / no domain                        → Self-signed cert (auto-generated)
startHttpsServer({
  app,
  httpPort: HTTP_PORT,
  httpsPort: HTTPS_PORT,
  domain: process.env.DOMAIN || undefined,
  maintainerEmail: process.env.MAINTAINER_EMAIL || undefined,
  configDir: process.env.GREENLOCK_CONFIG_DIR || undefined,
  agreeToTerms: true,
}).then(() => {
  console.log(`[Audify AI Backend] Super Admin: ${ADMIN_EMAIL}`);
  console.log(`[Audify AI Backend] Security headers (Helmet) & Rate Limiting active.`);
}).catch((err: Error) => {
  console.error('[Audify AI Backend] HTTPS startup failed:', err.message);
  process.exit(1);
});

export default app;
