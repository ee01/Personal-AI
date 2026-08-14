/**
 * Stable Ed25519 device identity for OpenClaw Gateway connect handshake.
 * Aligns with OpenClaw's device-auth v3 payload (deviceId|clientId|mode|…).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export type OpenClawDeviceIdentity = {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
};

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const spki = crypto.createPublicKey(publicKeyPem).export({
    type: 'spki',
    format: 'der',
  }) as Buffer;
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function fingerprintPublicKey(publicKeyPem: string): string {
  return crypto
    .createHash('sha256')
    .update(derivePublicKeyRaw(publicKeyPem))
    .digest('hex');
}

function generateIdentity(): OpenClawDeviceIdentity {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({
    type: 'spki',
    format: 'pem',
  }) as string;
  const privateKeyPem = privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string;
  return {
    deviceId: fingerprintPublicKey(publicKeyPem),
    publicKeyPem,
    privateKeyPem,
  };
}

export function publicKeyRawBase64UrlFromPem(publicKeyPem: string): string {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

export function signDevicePayload(
  privateKeyPem: string,
  payload: string,
): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  return base64UrlEncode(
    crypto.sign(null, Buffer.from(payload, 'utf8'), key) as Buffer,
  );
}

/** Verify a UTF-8 payload signature against raw base64url or PEM public key. */
export function verifyDeviceSignature(
  publicKey: string,
  payload: string,
  signatureBase64Url: string,
): boolean {
  try {
    const key = publicKey.includes('BEGIN')
      ? crypto.createPublicKey(publicKey)
      : crypto.createPublicKey({
          key: Buffer.concat([
            ED25519_SPKI_PREFIX,
            base64UrlDecode(publicKey),
          ]),
          type: 'spki',
          format: 'der',
        });
    const sig = base64UrlDecode(signatureBase64Url);
    return crypto.verify(null, Buffer.from(payload, 'utf8'), key, sig);
  } catch {
    return false;
  }
}

function normalizeDeviceMetadataForAuth(value: string | undefined): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/[A-Z]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 32),
  );
}

/** OpenClaw gateway-protocol device-auth payload v3. */
export function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
  platform?: string;
  deviceFamily?: string;
}): string {
  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAtMs),
    params.token ?? '',
    params.nonce,
    normalizeDeviceMetadataForAuth(params.platform),
    normalizeDeviceMetadataForAuth(params.deviceFamily),
  ].join('|');
}

export function resolveGatewayDeviceIdentityPath(
  explicitPath?: string,
): string {
  if (explicitPath && explicitPath.trim()) return explicitPath.trim();
  const dataDir =
    process.env.DATA_DIR && process.env.DATA_DIR.trim()
      ? path.isAbsolute(process.env.DATA_DIR)
        ? process.env.DATA_DIR.trim()
        : path.resolve(process.cwd(), process.env.DATA_DIR.trim())
      : path.resolve(process.cwd(), 'data');
  return path.join(dataDir, 'openclaw-gateway-device.json');
}

export function loadOrCreateGatewayDeviceIdentity(
  filePath?: string,
): OpenClawDeviceIdentity {
  const resolved = resolveGatewayDeviceIdentityPath(filePath);
  try {
    if (fs.existsSync(resolved)) {
      const raw = JSON.parse(fs.readFileSync(resolved, 'utf8')) as Record<
        string,
        unknown
      >;
      if (
        typeof raw.deviceId === 'string' &&
        typeof raw.publicKeyPem === 'string' &&
        typeof raw.privateKeyPem === 'string'
      ) {
        const derived = fingerprintPublicKey(raw.publicKeyPem);
        if (derived === raw.deviceId) {
          return {
            deviceId: raw.deviceId,
            publicKeyPem: raw.publicKeyPem,
            privateKeyPem: raw.privateKeyPem,
          };
        }
      }
    }
  } catch {
    /* recreate below */
  }

  const identity = generateIdentity();
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(
    resolved,
    JSON.stringify(
      {
        version: 1,
        deviceId: identity.deviceId,
        publicKeyPem: identity.publicKeyPem,
        privateKeyPem: identity.privateKeyPem,
        createdAtMs: Date.now(),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  return identity;
}
