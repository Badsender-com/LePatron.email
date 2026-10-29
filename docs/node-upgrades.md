# Node upgrades

The Node version lives in two places that must agree: `.nvmrc` (read by nvm and by both CI workflows through `node-version-file`) and `engines.node` in `package.json` (read by Clever Cloud). Both hold an exact version, so a Node patch is a pull request.

## Node 18.18.0 → 24.22.1

Node 18 has been out of support since April 2025, and the authorization server of the MCP epic (#1290) is `oidc-provider`, an ESM-only package. A CommonJS app can only `require()` it from Node 22.12, where `require(esm)` is on by default. Node 24 was picked over 22 because 22 leaves support in April 2027, 24 in April 2028.

Two dependencies changed, no major upgrade of the stack (Vue 2, Nuxt 2, webpack 4, Mongoose 5 all stay).

**The Brevo SDK's superagent, 3.7.0 → 5.3.1**, through `resolutions` (`sib-api-v3-sdk/superagent`, the only package using superagent at runtime; supertest keeps its own 10.x). superagent 3.7.0 reads `OutgoingMessage#_headers` when it follows a redirect, and Node 24 removed it ([DEP0066](https://nodejs.org/api/deprecations.html#DEP0066)): any redirect from the API threw inside superagent and the push never settled, with no error. The Brevo API does not redirect today; a host change on their side would have been enough. 5.3.1 is the first version reading `getHeaders()`. `tests/server/esp/sendinblue-provider.http.test.js` runs every provider method against a local stand-in of the API, redirects included (301 on a read, 308 keeping the method and body on a write), and passes on Node 18 and 24. The same move clears every advisory on that path (`form-data`, `qs`, `cookiejar`, one of them critical). `sib-api-v3-sdk` itself is no longer maintained; its successor is `@getbrevo/brevo`, a rewrite of the provider left for later.

**`babel-loader` 8.2.2 → 8.4.1**, a devDependency. Nuxt resolves its loaders from the project root first, so it picked the root 8.2.2 over its own 8.4.1. In dev mode Nuxt turns on babel's cache, and 8.2.2 names the cache files with an md4 hash, which OpenSSL 3 refuses: every page answered 500 `digital envelope routines::unsupported`. This was already broken on Node 18 with an empty cache; an existing cache did not help, the hash is computed before the cache is read. 8.4.1 hashes with sha256. A production build never hit it, babel's cache is off there.

On Node 22.20, 24.18 and 24.22.1, the pinned version:

- `yarn install --frozen-lockfile` passes without `--ignore-engines` (CI no longer passes it)
- `yarn test-ci` passes, every suite
- the editor bundle (`gulp build --prod`) is produced, byte-identical between the two versions
- `nuxt build`, `apidoc` and the VuePress build pass
- the server boots in development (Nuxt dev build) and in production, serves the login page and the editor bundle

What the upgrade changed in our code:

- **Outbound HTTP keeps Node 18's one socket per request** (`utils/outbound-keep-alive.js`, called first in `server/index.js`). Since Node 19, `http.globalAgent` and `https.globalAgent` keep idle sockets for 5 s. Every call made without its own agent uses them: the ESP connectors (axios in `config/axios.js`, `node-fetch`, `request`, superagent inside the Brevo SDK) and the image fetch, none of which retry. A peer that closes an idle socket sooner, without announcing it in a `Keep-Alive` header (a proxy or load balancer does that), races the next request: measured against such a server with 15 ms of latency, 74 `ECONNRESET` out of 200 sequential calls on Node 24, none on Node 18 nor with the fix. The integration providers (`integration-providers/provider-http.js`) build their own agents and are unaffected.
- **`utils/terminate.js` no longer hands an error to `process.exit`.** A second SIGTERM or SIGINT finds the server closed, `server.close` calls back with `ERR_SERVER_NOT_RUNNING`, and since Node 20 `process.exit` throws on a non-number ([DEP0164](https://nodejs.org/api/deprecations.html#DEP0164)). It also passes its code, which it never did.

What changes at runtime, with no code change:

- **Agents ask the lookup for every address** (`autoSelectFamily`, on by default since Node 20). `utils/outbound-host.js` already served both forms.
- **TLS refuses weak peers.** Node 24 runs OpenSSL 3.5 at its default security level 2 since 24.5.0 (Node 22 kept level 1): a TLS peer with an RSA, DSA or DH key under 2048 bits, an ECC key under 224 bits or a SHA-1 handshake signature is refused. TLS connections only: SAML signatures are checked with plain `crypto` calls, and SFTP goes through ssh2, so neither is concerned. The public endpoints we call (Brevo, Actito, Adobe, DeepL, the AI providers, S3 and Cellar) pass. What remains is hosts we do not control: images imported from a customer's URL, `SMTP_HOST`, `DSC_ESP_URL`, a customer's own Actito or Adobe instance, Mongo if its URI uses TLS. If one fails, set `ciphers: 'DEFAULT@SECLEVEL=1'` on that one connection, never globally.

What stays:

- **VuePress still needs `NODE_OPTIONS=--openssl-legacy-provider`.** Its webpack 4 hashes with md4, which OpenSSL 3 refuses (`ERR_OSSL_EVP_UNSUPPORTED`). Nuxt does not need it, in dev or in production.
- **Deprecation warnings from dependencies**, none from our code: `url.parse()` (DEP0169, Nuxt), `fs.Stats` constructor (DEP0180, gulp), invalid argument to `fs.existsSync` (DEP0187, Node 24 only).

What the local run cannot cover, and the staging smoke test does:

- The TLS hosts listed above, which only a real deployment reaches.
- Chrome for puppeteer (template previews) and the sharp binary are installed by the Clever Cloud build, not by CI.
- `node -p process.versions.openssl` on Clever Cloud should print 3.5.x: the official Node binary. A distribution build may set another security level.

After changing the version, deploy once without the Clever Cloud build cache so native modules and Chrome are installed for the new Node.

## Node 14.16.0 → 18.18.0

Done on `feat/upgrade-node18`. What it changed:

- **Upgraded:** `nuxt` 2.14 → 2.17.4 (`ERR_PACKAGE_PATH_NOT_EXPORTED`), `mongoose` 5.12 → 5.13.22, `sharp` 0.27 → 0.33.5 (arm64 binaries), `puppeteer` 1.20 → 21, `maildev` 1.1 → 2.1, `@nuxtjs/vuetify` 1.11 → 1.12.3.
- **Removed:** `segfault-handler` and `canvas` (native modules failing to load), `xml2json`, replaced by `fast-xml-parser` in `account/auth.guard.js` and `utils/soap-request.js`.
- **Added explicitly:** `vuex`, which was only hoisted transitively before.
- **Scripts:** the VuePress commands got `NODE_OPTIONS=--openssl-legacy-provider`.
