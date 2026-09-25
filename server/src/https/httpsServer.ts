// Audify AI — HTTPS Server Bootstrap
// Supports two modes:
//   1. PRODUCTION: greenlock-express (Let's Encrypt) with automatic certificate renewal
//   2. DEVELOPMENT: self-signed certificate for local HTTPS testing
//
// Switch between modes using the NODE_ENV and DOMAIN env variables.
// When NODE_ENV=production and DOMAIN is set, Let's Encrypt is used automatically.
// In all other cases, a self-signed cert is generated and used.

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import {Application} from 'express';

// ── Types ──────────────────────────────────────────────────────────────────
export interface HttpsServerConfig {
  /** The Express application instance */
  app: Application;
  /** HTTP port — used for Let's Encrypt ACME challenge traffic (port 80) */
  httpPort: number;
  /** HTTPS port (default 443 in production, 3443 in dev) */
  httpsPort: number;
  /** Your domain name (e.g. api.audifyai.com). Required for Let's Encrypt. */
  domain?: string;
  /** Contact email for Let's Encrypt certificate notifications */
  maintainerEmail?: string;
  /** Directory where Greenlock stores certificates and account data */
  configDir?: string;
  /** Whether to agree to Let's Encrypt subscriber agreement automatically */
  agreeToTerms?: boolean;
}

// ── Dev: Self-Signed Certificate Generator ────────────────────────────────
function generateSelfSignedCert(certDir: string): {key: string; cert: string} {
  const certPath = path.join(certDir, 'selfsigned.crt');
  const keyPath = path.join(certDir, 'selfsigned.key');

  // Return cached certs if they already exist (avoid regenerating every restart)
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log('[Audify AI HTTPS] Using cached self-signed certificate.');
    return {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8'),
    };
  }

  // Generate a new self-signed certificate using the `selfsigned` package
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const selfsigned = require('selfsigned');
  const attrs = [
    {name: 'commonName', value: 'localhost'},
    {name: 'organizationName', value: 'Audify AI Dev'},
    {shortName: 'OU', value: 'Development'},
    {name: 'countryName', value: 'IN'},
  ];
  const pems = selfsigned.generate(attrs, {
    algorithm: 'sha256',
    days: 365,
    keySize: 2048,
    extensions: [
      {name: 'subjectAltName', altNames: [{type: 2, value: 'localhost'}]},
    ],
  });

  // Persist to disk so they survive server restarts
  fs.mkdirSync(certDir, {recursive: true});
  fs.writeFileSync(certPath, pems.cert, {mode: 0o600});
  fs.writeFileSync(keyPath, pems.private, {mode: 0o600});

  console.log(`[Audify AI HTTPS] Self-signed cert generated → ${certDir}`);
  return {key: pems.private, cert: pems.cert};
}

// ── Production: Start Greenlock (Let's Encrypt) Server ────────────────────
async function startGreenlockServer(config: HttpsServerConfig): Promise<void> {
  const {app, httpPort, httpsPort, domain, maintainerEmail, configDir, agreeToTerms} = config;

  if (!domain) {
    throw new Error('[Audify AI HTTPS] DOMAIN env variable is required for production HTTPS.');
  }
  if (!maintainerEmail) {
    throw new Error('[Audify AI HTTPS] MAINTAINER_EMAIL env variable is required for Let\'s Encrypt.');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Greenlock = require('greenlock-express');

  const glConfigDir = configDir || path.join(process.cwd(), '.greenlock');
  fs.mkdirSync(glConfigDir, {recursive: true});

  const gl = Greenlock.init({
    // ── Greenlock core config ──────────────────────────────────────────
    packageRoot: process.cwd(),
    configDir: glConfigDir,
    maintainerEmail,
    cluster: false,

    // ── Let's Encrypt environment ──────────────────────────────────────
    // Use staging during testing to avoid rate limits.
    // Set LETS_ENCRYPT_STAGING=false in production .env to issue real certs.
    staging: process.env.LETS_ENCRYPT_STAGING !== 'false',

    agreeToTerms: agreeToTerms ?? true,

    // ── Automatic site/domain registration ────────────────────────────
    notify: (event: string, details: unknown) => {
      if (event === 'error') {
        console.error('[Audify AI Greenlock Error]:', details);
      } else {
        console.log(`[Audify AI Greenlock] ${event}:`, JSON.stringify(details));
      }
    },
  });

  // Register the site/domain — Greenlock handles cert issuance + renewal automatically
  await gl.manager.defaults({
    subscriberEmail: maintainerEmail,
    agreeToTerms: agreeToTerms ?? true,
  });

  await gl.sites.add({
    subject: domain,
    altnames: [domain, `www.${domain}`],
  });

  console.log(`[Audify AI HTTPS] Starting Greenlock (Let's Encrypt) server...`);
  console.log(`[Audify AI HTTPS] Domain: ${domain}`);
  console.log(`[Audify AI HTTPS] Staging mode: ${process.env.LETS_ENCRYPT_STAGING !== 'false'}`);
  console.log(`[Audify AI HTTPS]  Set LETS_ENCRYPT_STAGING=false for real certificates.`);

  // Greenlock manages both the HTTP challenge server (port 80) and the HTTPS server (port 443)
  gl.serve(app).listen(httpPort, httpsPort, () => {
    console.log(`[Audify AI HTTPS] HTTP  (ACME challenge) → http://localhost:${httpPort}`);
    console.log(`[Audify AI HTTPS] HTTPS (TLS encrypted) → https://${domain}:${httpsPort}`);
  });
}

// ── Development: Start Self-Signed HTTPS Server ───────────────────────────
function startDevHttpsServer(config: HttpsServerConfig): void {
  const {app, httpPort, httpsPort} = config;

  const certDir = path.join(process.cwd(), '.dev-certs');
  const {key, cert} = generateSelfSignedCert(certDir);

  // HTTPS server
  const httpsServer = https.createServer({key, cert}, app);
  httpsServer.listen(httpsPort, () => {
    console.log(`[Audify AI HTTPS] Dev HTTPS server → https://localhost:${httpsPort}`);
    console.log(`[Audify AI HTTPS] Browser warning is expected for self-signed certs.`);
    console.log(`[Audify AI HTTPS] Accept the cert in your browser or add it to your trust store.`);
  });

  // HTTP redirect server — redirects all plain HTTP traffic to HTTPS
  const redirectApp = http.createServer((req, res) => {
    const host = req.headers.host?.replace(`:${httpPort}`, '') || 'localhost';
    res.writeHead(301, {Location: `https://${host}:${httpsPort}${req.url}`});
    res.end();
  });
  redirectApp.listen(httpPort, () => {
    console.log(`[Audify AI HTTPS] HTTP  (→ HTTPS redirect) → http://localhost:${httpPort}`);
  });
}

// ── Main Export: Start the appropriate HTTPS server ───────────────────────
export async function startHttpsServer(config: HttpsServerConfig): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const hasDomain = !!(config.domain);

  if (isProd && hasDomain) {
    console.log('[Audify AI HTTPS] Production mode detected. Using Let\'s Encrypt (Greenlock).');
    await startGreenlockServer(config);
  } else {
    if (isProd && !hasDomain) {
      console.warn('[Audify AI HTTPS] WARNING: NODE_ENV=production but DOMAIN is not set!');
      console.warn('[Audify AI HTTPS] Falling back to self-signed cert. Set DOMAIN in your .env for real HTTPS.');
    } else {
      console.log('[Audify AI HTTPS] Development mode. Using self-signed certificate.');
    }
    startDevHttpsServer(config);
  }
}
