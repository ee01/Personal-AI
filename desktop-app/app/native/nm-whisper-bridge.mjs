#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DESKTOP_APP_PORT =
  process.env.DESKTOP_APP_PORT || process.env.DOUBAO_BRIDGE_PORT || '46321';
const BASE_URL = `http://127.0.0.1:${DESKTOP_APP_PORT}`;

function readTokenFromFile() {
  const tokenPath = join(
    homedir(),
    'Library',
    'Application Support',
    'Personal AI',
    '.nm-token',
  );
  if (existsSync(tokenPath)) {
    return readFileSync(tokenPath, 'utf8').trim();
  }
  return (
    process.env.DESKTOP_APP_AUTH_TOKEN ||
    process.env.DOUBAO_BRIDGE_AUTH_TOKEN ||
    ''
  );
}

function readNmMessage() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let headerRead = false;
    let messageLength = 0;
    let bytesRead = 0;

    process.stdin.on('data', (chunk) => {
      chunks.push(chunk);
      const buf = Buffer.concat(chunks);

      if (!headerRead && buf.length >= 4) {
        messageLength = buf.readUInt32LE(0);
        headerRead = true;
        bytesRead = buf.length - 4;
      } else if (headerRead) {
        bytesRead = buf.length - 4;
      }

      if (headerRead && bytesRead >= messageLength) {
        const msgBuf = Buffer.concat(chunks).slice(4, 4 + messageLength);
        try {
          resolve(JSON.parse(msgBuf.toString('utf8')));
        } catch (e) {
          reject(e);
        }
        process.stdin.removeAllListeners('data');
      }
    });

    process.stdin.on('end', () => {
      process.exit(0);
    });

    process.stdin.on('error', reject);
  });
}

function writeNmMessage(msg) {
  const json = JSON.stringify(msg);
  const buf = Buffer.from(json, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(Buffer.concat([header, buf]));
}

async function forwardToServer(message, token) {
  const { method = 'GET', path = '/whisper/status', body } = message;
  const url = `${BASE_URL}${path}`;

  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-bridge-token': token,
    },
  };

  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  const response = await fetch(url, opts);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: response.ok, raw: text };
  }
}

async function main() {
  const token = readTokenFromFile();

  process.stdin.on('end', () => process.exit(0));

  while (true) {
    let message;
    try {
      message = await readNmMessage();
    } catch {
      process.exit(0);
    }

    try {
      const result = await forwardToServer(message, token);
      writeNmMessage(result);
    } catch (e) {
      writeNmMessage({ ok: false, error: String(e?.message || e) });
    }
  }
}

main().catch(() => process.exit(1));
