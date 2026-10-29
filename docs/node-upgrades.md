# Node upgrades

The Node version lives in two places that must agree: `.nvmrc` (read by nvm and by both CI workflows through `node-version-file`) and `engines.node` in `package.json` (read by Clever Cloud). Both hold an exact version, so a Node patch is a pull request.

## Node 18.18.0 → 24.22.1

Node 18 has been out of support since April 2025, and the authorization server of the MCP epic (#1290) is `oidc-provider`, an ESM-only package. A CommonJS app can only `require()` it from Node 22.12, where `require(esm)` is on by default. Node 24 was picked over 22 because 22 leaves support in April 2027, 24 in April 2028.

One devDependency changed: **`babel-loader` 8.2.2 → 8.4.1**. Nuxt resolves its loaders from the project root first, so it picked the root 8.2.2 over its own 8.4.1. In dev mode Nuxt turns on babel's cache, and 8.2.2 names the cache files with an md4 hash, which OpenSSL 3 refuses: every page answered 500 `digital envelope routines::unsupported`. This was already broken on Node 18 with an empty cache; an existing cache did not help, the hash is computed before the cache is read. 8.4.1 hashes with sha256. A production build never hit it, babel's cache is off there.

On Node 22.20, 24.18 and 24.22.1, the pinned version:

- `yarn install --frozen-lockfile` passes without `--ignore-engines` (CI no longer passes it)
- `yarn test-ci` passes, every suite
- the editor bundle (`gulp build --prod`) is produced, byte-identical between the two versions
- `nuxt build`, `apidoc` and the VuePress build pass
- the server boots in development (Nuxt dev build) and in production, serves the login page and the editor bundle

What changes at runtime, with no code change:

- **Outbound HTTP keeps its sockets alive.** Since Node 19, `http.globalAgent` is created with `keepAlive: true` (idle sockets dropped after 5 s). Every call made without an explicit agent, the ESP connectors through `config/axios.js` and the `node-fetch` call sites, now reuses connections where Node 18 opened one per request. Fewer TLS handshakes; the one failure mode is a peer closing an idle socket just as the next request goes out, which shows as an intermittent `ECONNRESET` or `socket hang up` on an ESP push. Only `globalAgent` changed its default: the HTTP integration providers build their own agents (`integration-providers/provider-http.js`), which stay at `keepAlive: false`.
- **Agents ask the lookup for every address** (`autoSelectFamily`, on by default since Node 20). `utils/outbound-host.js` already served both forms.

What stays:

- **VuePress still needs `NODE_OPTIONS=--openssl-legacy-provider`.** Its webpack 4 hashes with md4, which OpenSSL 3 refuses (`ERR_OSSL_EVP_UNSUPPORTED`). Nuxt does not need it, in dev or in production.
- **Deprecation warnings from dependencies**, none from our code: `url.parse()` (DEP0169, Nuxt), `fs.Stats` constructor (DEP0180, gulp), invalid argument to `fs.existsSync` (DEP0187, Node 24 only).

What the local run cannot cover, and the staging smoke test does:

- Node 24 ships OpenSSL 3.5. A TLS peer with an old certificate or key (an ESP endpoint, an SMTP or SFTP server, a SAML IdP) is where a refusal would show.
- Chrome for puppeteer (template previews) and the sharp binary are installed by the Clever Cloud build, not by CI.

After changing the version, deploy once without the Clever Cloud build cache so native modules and Chrome are installed for the new Node.

## Node 14.16.0 → 18.18.0

Done on `feat/upgrade-node18`. What it changed:

- **Upgraded:** `nuxt` 2.14 → 2.17.4 (`ERR_PACKAGE_PATH_NOT_EXPORTED`), `mongoose` 5.12 → 5.13.22, `sharp` 0.27 → 0.33.5 (arm64 binaries), `puppeteer` 1.20 → 21, `maildev` 1.1 → 2.1, `@nuxtjs/vuetify` 1.11 → 1.12.3.
- **Removed:** `segfault-handler` and `canvas` (native modules failing to load), `xml2json`, replaced by `fast-xml-parser` in `account/auth.guard.js` and `utils/soap-request.js`.
- **Added explicitly:** `vuex`, which was only hoisted transitively before.
- **Scripts:** the VuePress commands got `NODE_OPTIONS=--openssl-legacy-provider`.
