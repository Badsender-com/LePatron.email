#!/usr/bin/env node
'use strict';

/**
 * A fake Emarsys for a developer's machine (ADR 0028): the five calls of the
 * API v3 the image host integration makes, so that an export can be tried end
 * to end without an Emarsys account.
 *
 *   yarn fake:emarsys            # listens on http://127.0.0.1:3800
 *   lepatron_emarsysFakeUrl=http://127.0.0.1:3800 yarn dev
 *
 * Credentials it accepts: client ID `fake-client`, secret `fake-secret`
 * (FAKE_EMARSYS_CLIENT_ID, FAKE_EMARSYS_SECRET); anything else is refused, to
 * try that path too. FAKE_EMARSYS_UPLOAD_DELAY_MS slows each upload down. Its folders: `LePatron` (1000), `Marque A` (1001) and
 * `Marque A / Emails` (1002).
 *
 * It keeps everything in memory, and serves what it stored at
 * /custloads/123/<file>, as Emarsys does, so the exported HTML displays its
 * images. http://127.0.0.1:3800 shows its folders, files and counters, and
 * deletes a file as someone would in the Media Database.
 *
 * Written from the Emarsys documentation, as the provider was: it shows the
 * whole chain works, not that Emarsys answers as documented.
 */

const http = require('http');
const crypto = require('crypto');
const path = require('path');

const PORT = Number(process.env.FAKE_EMARSYS_PORT) || 3800;
const CLIENT_ID = process.env.FAKE_EMARSYS_CLIENT_ID || 'fake-client';
const SECRET = process.env.FAKE_EMARSYS_SECRET || 'fake-secret';
// Slows each upload down, to watch an export's progress (ADR 0029).
const UPLOAD_DELAY_MS = Number(process.env.FAKE_EMARSYS_UPLOAD_DELAY_MS) || 0;
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_BODY_BYTES = 32 * 1024 * 1024;

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function send(res, status, body, type = 'application/json') {
  const payload =
    type === 'application/json' ? JSON.stringify(body) : String(body);
  res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8` });
  res.end(payload);
}

const ok = (res, data) =>
  send(res, 200, { replyCode: 0, replyText: 'OK', data });
const fail = (res, status, replyCode, replyText) =>
  send(res, status, { replyCode, replyText, data: '' });

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ])
  );
}

/**
 * @param {Object} [options]
 * @param {number} [options.port] 0 for any free one
 * @returns {Promise<{ server: http.Server, base: string, state: Object }>}
 */
function createFakeEmarsys({ port = PORT } = {}) {
  const state = {
    tokens: new Set(),
    folders: [
      { id: 1000, parent: 0, name: 'LePatron' },
      { id: 1001, parent: 0, name: 'Marque A' },
      { id: 1002, parent: 1001, name: 'Emails' },
    ],
    files: new Map(),
    counters: { tokens: 0, refusedTokens: 0, uploads: 0, fileReads: 0 },
  };
  let nextId = 2000;
  let BASE = '';

  function fileUrl(file) {
    return `${BASE}/custloads/123/${encodeURIComponent(file.filename)}`;
  }

  function describeFile(file) {
    return {
      id: file.id,
      folder: file.folder,
      filename: file.filename,
      size: file.content.length,
      original_name: file.originalName,
      url: fileUrl(file),
    };
  }

  // POST /oauth2/token: the client credentials grant, in HTTP Basic.
  function token(req, res, body) {
    const [scheme, encoded] = (req.headers.authorization || '').split(' ');
    const [clientId, secret] = Buffer.from(encoded || '', 'base64')
      .toString('utf8')
      .split(':');
    const granted =
      scheme === 'Basic' &&
      clientId === CLIENT_ID &&
      secret === SECRET &&
      new URLSearchParams(body).get('grant_type') === 'client_credentials';
    if (!granted) {
      state.counters.refusedTokens += 1;
      return send(res, 401, { error: 'invalid_client' });
    }
    state.counters.tokens += 1;
    const accessToken = crypto.randomBytes(16).toString('hex');
    state.tokens.add(accessToken);
    return send(res, 200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
    });
  }

  async function api(req, res, url) {
    const [scheme, accessToken] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !state.tokens.has(accessToken)) {
      return fail(res, 401, 1, 'Unauthorized');
    }
    const route = `${req.method} ${url.pathname}`;

    if (route === 'GET /api/v3/folder') {
      const parent = url.searchParams.get('folder');
      return ok(
        res,
        parent
          ? state.folders.filter((f) => String(f.parent) === parent)
          : state.folders
      );
    }

    if (route === 'POST /api/v3/folder') {
      const { name, parent } = JSON.parse(await readBody(req));
      if (!name || !state.folders.some((f) => f.id === parent)) {
        return fail(res, 400, 10001, 'Invalid folder');
      }
      const folder = { id: nextId++, parent, name };
      state.folders.push(folder);
      return ok(res, { id: folder.id });
    }

    if (route === 'POST /api/v3/file') {
      const { filename, file, folder } = JSON.parse(await readBody(req));
      if (UPLOAD_DELAY_MS) {
        await new Promise((resolve) => setTimeout(resolve, UPLOAD_DELAY_MS));
      }
      const content = Buffer.from(file || '', 'base64');
      if (!filename || !content.length) {
        return fail(res, 400, 10001, 'Missing file');
      }
      if (content.length > MAX_IMAGE_BYTES) {
        return fail(res, 400, 10002, 'File too large');
      }
      if (folder && !state.folders.some((f) => f.id === folder)) {
        return fail(res, 400, 10003, 'Unknown folder');
      }
      const id = nextId++;
      // Emarsys renames what it stores: the URL never derives from the name.
      const stored = {
        id,
        folder: folder || 0,
        filename: `${id}_${path.basename(filename)}`,
        originalName: filename,
        content,
      };
      state.files.set(String(id), stored);
      state.counters.uploads += 1;
      // The upload answers without the URL: it is read back by GET /file/{id}.
      const { url: _url, ...uploaded } = describeFile(stored);
      return ok(res, [uploaded]);
    }

    const fileMatch = url.pathname.match(/^\/api\/v3\/file\/([^/]+)$/);
    if (req.method === 'GET' && fileMatch) {
      state.counters.fileReads += 1;
      const file = state.files.get(decodeURIComponent(fileMatch[1]));
      if (!file) return fail(res, 404, 1, 'File not found');
      return ok(res, describeFile(file));
    }

    return fail(res, 404, 1, `No route ${route}`);
  }

  function servedFile(res, name) {
    const file = [...state.files.values()].find((f) => f.filename === name);
    if (!file) return send(res, 404, 'Not found', 'text/plain');
    const type =
      MIME_TYPES[path.extname(file.filename).toLowerCase()] ||
      'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    return res.end(file.content);
  }

  function folderPath(id) {
    const names = [];
    let folder = state.folders.find((f) => f.id === id);
    while (folder) {
      names.unshift(folder.name);
      const parentId = folder.parent;
      folder = state.folders.find((f) => f.id === parentId);
    }
    return names.join(' / ') || '(root)';
  }

  function inspectionPage(res) {
    const { counters } = state;
    const files = [...state.files.values()]
      .map(
        (file) => `<tr>
    <td><img src="${escapeHtml(fileUrl(file))}" alt=""></td>
    <td>${file.id}</td>
    <td>${escapeHtml(folderPath(file.folder))}</td>
    <td>${escapeHtml(file.originalName)}<br><small>${escapeHtml(
          file.filename
        )}</small></td>
    <td>${file.content.length}</td>
    <td><form method="post" action="/_fake/files/${file.id}/delete">
      <button>Delete</button></form></td>
  </tr>`
      )
      .join('\n');
    const folders = state.folders
      .map((f) => `<li>${f.id} · ${escapeHtml(folderPath(f.id))}</li>`)
      .join('\n');
    send(
      res,
      200,
      `<!doctype html><meta charset="utf-8"><title>Fake Emarsys</title>
  <style>
    body { font: 14px system-ui, sans-serif; margin: 2rem; color: #222; }
    table { border-collapse: collapse; } td, th { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
    img { max-width: 80px; max-height: 60px; } small { color: #888; }
  </style>
  <h1>Fake Emarsys</h1>
  <p>Credentials: <code>${escapeHtml(CLIENT_ID)}</code> / <code>${escapeHtml(
        SECRET
      )}</code></p>
  <p>Tokens granted: <b id="tokens">${counters.tokens}</b> · refused:
  <b id="refused-tokens">${counters.refusedTokens}</b> · uploads:
  <b id="uploads">${counters.uploads}</b> · file reads:
  <b id="file-reads">${counters.fileReads}</b></p>
  <h2>Folders</h2><ul>${folders}</ul>
  <h2>Files (${state.files.size})</h2>
  <table><tr><th></th><th>id</th><th>folder</th><th>name</th><th>bytes</th><th></th></tr>
  ${files}</table>`,
      'text/html'
    );
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, BASE);
    try {
      if (req.method === 'POST' && url.pathname === '/oauth2/token') {
        return token(req, res, await readBody(req));
      }
      if (url.pathname.startsWith('/api/v3/')) return await api(req, res, url);
      if (req.method === 'GET' && url.pathname.startsWith('/custloads/123/')) {
        return servedFile(
          res,
          decodeURIComponent(url.pathname.slice('/custloads/123/'.length))
        );
      }
      const deletion = url.pathname.match(/^\/_fake\/files\/(\d+)\/delete$/);
      if (req.method === 'POST' && deletion) {
        state.files.delete(deletion[1]);
        res.writeHead(303, { Location: '/' });
        return res.end();
      }
      if (req.method === 'GET' && url.pathname === '/_fake/state') {
        return send(res, 200, {
          counters: state.counters,
          folders: state.folders,
          files: [...state.files.values()].map(describeFile),
        });
      }
      if (req.method === 'GET' && url.pathname === '/') {
        return inspectionPage(res);
      }
      return send(res, 404, 'Not found', 'text/plain');
    } catch (error) {
      return fail(res, 400, 1, error.message);
    }
  });

  return new Promise((resolve) => {
    // The machine only: it takes credentials and stores what it is sent.
    server.listen(port, '127.0.0.1', () => {
      BASE = `http://127.0.0.1:${server.address().port}`;
      resolve({ server, base: BASE, state });
    });
  });
}

if (require.main === module) {
  createFakeEmarsys().then(({ base }) => {
    console.log(`Fake Emarsys on ${base} (client ${CLIENT_ID})`);
  });
}

module.exports = { createFakeEmarsys };
