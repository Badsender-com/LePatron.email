'use strict';

const BaseProvider = require('../base-provider.js');
const { guardedFetch, toProviderError } = require('../provider-http.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('../provider-error.js');

// The Emarsys API v3, authenticated with OpenID Connect (ADR 0028). Both hosts
// are fixed: an admin gives credentials, never an address.
const TOKEN_URL = 'https://auth.emarsys.net/oauth2/token';
const API_URL = 'https://api.emarsys.net/api/v3';

const TIMEOUT_MS = 15000;
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
    this.clientId = this.config.clientId;
    this.rootFolderId = this.config.rootFolderId;
    // Kept by the instance: Emarsys allows 50 token requests a minute per
    // client, and an export makes dozens of calls.
    this.token = null;
    this.tokenExpiresAt = 0;
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

  async getToken() {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;

    if (!this.clientId || !this.apiKey) {
      throw new ProviderError(
        'Emarsys: client ID or secret missing',
        CODES.CONFIG_ERROR
      );
    }
    const basic = Buffer.from(`${this.clientId}:${this.apiKey}`).toString(
      'base64'
    );
    const response = await guardedFetch(TOKEN_URL, {
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
  async callApi(method, path, payload) {
    const token = await this.getToken();
    const label = `Emarsys ${method} ${path}`;
    const response = await guardedFetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
      timeoutMs: TIMEOUT_MS,
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
