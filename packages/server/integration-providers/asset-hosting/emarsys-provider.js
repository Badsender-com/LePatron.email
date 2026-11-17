'use strict';

const BaseProvider = require('../base-provider.js');
const fetch = require('node-fetch');
const { guardedFetch, toProviderError } = require('../provider-http.js');
const { emarsysEndpoints } = require('./emarsys-endpoints.js');
const config = require('../../node.config.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

const TIMEOUT_MS = 15000;
// An upload carries up to 16 MB, base64-encoded.
const UPLOAD_TIMEOUT_MS = 60000;
// The Emarsys limit for an image in the Media Database.
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
// Renewed a minute early, so a token never expires between two calls of one
// export.
const TOKEN_MARGIN_MS = 60 * 1000;

/**
 * An Emarsys Media Database, as an image host of the export.
 *
 * `apiKey` holds the client secret, `config.clientId` the client ID and
 * `config.rootFolderId` the folder the emails' folders are created under.
 */
class EmarsysProvider extends BaseProvider {
  constructor(integration) {
    super(integration);
    // The Emarsys API, or the fake Emarsys of a developer's machine.
    this.endpoints = emarsysEndpoints(config);
    this.clientId = this.config.clientId;
    this.rootFolderId = this.config.rootFolderId;
    // Kept by the instance: Emarsys allows 50 token requests a minute per
    // client, and an export makes dozens of calls.
    this.token = null;
    this.tokenExpiresAt = 0;
    // The token being asked: calls made at the same time wait for it rather
    // than each asking their own.
    this.pendingToken = null;
    // The emails' folders found or created, by name: the images of one export
    // are put in parallel, and must not each create the folder.
    this.folderIds = new Map();
  }

  /**
   * Whether Emarsys gives a token for the credentials and lists the folders
   * with it.
   * @returns {Promise<boolean>}
   */
  async validateCredentials() {
    try {
      await this.listFolders();
      return true;
    } catch (error) {
      if (error instanceof ProviderError) return false;
      throw error;
    }
  }

  /**
   * The folders of the Media Database.
   * @returns {Promise<Array<{ id: number, parent: number, name: string }>>}
   */
  async listFolders() {
    const folders = await this.callApi('GET', '/folder');
    return (folders || []).map(({ id, parent, name }) => ({
      id,
      parent,
      name,
    }));
  }

  /**
   * Puts an image in the email's folder, created under the root folder when
   * missing. Emarsys renames what it stores: the URL comes from Emarsys, never
   * from the file name.
   * @param {Object} image
   * @param {string} image.folderName the email's folder
   * @param {string} image.filename
   * @param {Buffer} image.content
   * @returns {Promise<{ id: string, url: string }>}
   */
  async putImage({ folderName, filename, content }) {
    if (content.length > MAX_IMAGE_BYTES) {
      throw new ProviderError(
        `Emarsys: ${filename} is over the 16 MB limit`,
        CODES.API_ERROR
      );
    }
    const folder = await this.emailFolderId(folderName);
    const [uploaded] =
      (await this.callApi(
        'POST',
        '/file',
        { filename, file: content.toString('base64'), folder },
        { timeoutMs: UPLOAD_TIMEOUT_MS }
      )) || [];
    if (!uploaded || !uploaded.id) {
      throw new ProviderError(
        `Emarsys: no file identifier for ${filename}`,
        CODES.INVALID_RESPONSE
      );
    }
    const id = String(uploaded.id);
    const file = await this.callApi('GET', `/file/${encodeURIComponent(id)}`);
    if (!file || !file.url) {
      throw new ProviderError(
        `Emarsys: no URL for ${filename}`,
        CODES.INVALID_RESPONSE
      );
    }
    return { id, url: file.url };
  }

  /**
   * Whether a file put earlier is still in the Media Database: someone may
   * have deleted it there. Anything but a clear answer reads as "not found",
   * and the image is put again; refused credentials still throw.
   * @param {string} fileId
   * @returns {Promise<boolean>}
   */
  async fileExists(fileId) {
    try {
      const file = await this.callApi(
        'GET',
        `/file/${encodeURIComponent(String(fileId))}`
      );
      return !!(file && file.url);
    } catch (error) {
      if (
        error instanceof ProviderError &&
        error.code === CODES.INVALID_CREDENTIALS
      ) {
        throw error;
      }
      return false;
    }
  }

  emailFolderId(folderName) {
    if (!this.folderIds.has(folderName)) {
      const pending = this.findOrCreateFolder(folderName).catch((error) => {
        // A failure is not remembered: the next image tries again.
        this.folderIds.delete(folderName);
        throw error;
      });
      this.folderIds.set(folderName, pending);
    }
    return this.folderIds.get(folderName);
  }

  async findOrCreateFolder(name) {
    if (!this.rootFolderId) {
      throw new ProviderError('Emarsys: no root folder', CODES.CONFIG_ERROR);
    }
    const children =
      (await this.callApi('GET', `/folder?folder=${this.rootFolderId}`)) || [];
    const existing = children.find(
      (folder) =>
        folder.name === name &&
        String(folder.parent) === String(this.rootFolderId)
    );
    if (existing) return existing.id;
    const created = await this.callApi('POST', '/folder', {
      name,
      parent: this.rootFolderId,
    });
    return created.id;
  }

  async getToken() {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    if (!this.pendingToken) {
      this.pendingToken = this.requestToken().finally(() => {
        this.pendingToken = null;
      });
    }
    return this.pendingToken;
  }

  async requestToken() {
    if (!this.clientId || !this.apiKey) {
      throw new ProviderError(
        'Emarsys: client ID or secret missing',
        CODES.CONFIG_ERROR
      );
    }
    const basic = Buffer.from(`${this.clientId}:${this.apiKey}`).toString(
      'base64'
    );
    const response = await this.send(this.endpoints.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
      timeoutMs: TIMEOUT_MS,
      label: 'Emarsys token',
    });
    if (!response.ok) {
      throw new ProviderError(
        `Emarsys token request failed: ${response.status}`,
        response.status === 400 || response.status === 401
          ? CODES.INVALID_CREDENTIALS
          : CODES.API_ERROR
      );
    }
    const body = await readJson(response, 'Emarsys token');
    if (!body.access_token) {
      throw new ProviderError(
        'Emarsys token: no access token',
        CODES.INVALID_RESPONSE
      );
    }
    const lifetimeMs = (Number(body.expires_in) || 3600) * 1000;
    this.token = body.access_token;
    this.tokenExpiresAt = Date.now() + lifetimeMs - TOKEN_MARGIN_MS;
    return this.token;
  }

  /**
   * One call to the API: resolves with its `data`, throws a ProviderError on
   * an HTTP error or a non-zero `replyCode`.
   */
  /**
   * One HTTP call, guarded against private addresses; the fake Emarsys of a
   * developer's machine is the one address it must reach on the machine
   * itself (emarsys-endpoints.js).
   */
  send(url, { method, headers, body, timeoutMs, label }) {
    if (this.endpoints.isDevFake) {
      return fetch(url, { method, headers, body, timeout: timeoutMs });
    }
    return guardedFetch(url, { method, headers, body, timeoutMs, label });
  }

  async callApi(method, path, payload, { timeoutMs = TIMEOUT_MS } = {}) {
    const token = await this.getToken();
    const label = `Emarsys ${method} ${path}`;
    const response = await this.send(`${this.endpoints.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
      timeoutMs,
      label,
    });
    if (response.status === 401) {
      // Revoked meanwhile: the next call asks a new one.
      this.token = null;
      throw new ProviderError(
        `${label}: unauthorized`,
        CODES.INVALID_CREDENTIALS
      );
    }
    const body = await readJson(response, label);
    if (!response.ok || body.replyCode !== 0) {
      throw new ProviderError(
        `${label} failed: ${response.status} ${body.replyCode ?? ''} ${
          body.replyText ?? ''
        }`.trim(),
        CODES.API_ERROR
      );
    }
    return body.data;
  }
}

async function readJson(response, label) {
  try {
    return await response.json();
  } catch (error) {
    throw toProviderError(error, label);
  }
}

module.exports = EmarsysProvider;
