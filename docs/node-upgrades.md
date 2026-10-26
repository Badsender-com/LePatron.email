# Node upgrades

The Node version lives in two places that must agree: `.nvmrc` (read by nvm and by both CI workflows through `node-version-file`) and `engines.node` in `package.json` (read by Clever Cloud). Both hold an exact version, so a Node patch is a pull request.

## Node 18.18.0 → 24.22.1

Node 18 has been out of support since April 2025, and the authorization server of the MCP epic (#1290) is `oidc-provider`, an ESM-only package. A CommonJS app can only `require()` it from Node 22.12, where `require(esm)` is on by default. Node 24 was picked over 22 because 22 leaves support in April 2027, 24 in April 2028.

No dependency had to change. On both Node 22.20 and 24.18:

- `yarn install --frozen-lockfile` passes without `--ignore-engines` (CI no longer passes it)
- `yarn test-ci` passes, every suite
- the editor bundle (`gulp build --prod`) is produced, byte-identical between the two versions
- `nuxt build`, `apidoc` and the VuePress build pass
- the production server boots, serves the login page and the editor bundle

What stays:

- **VuePress still needs `NODE_OPTIONS=--openssl-legacy-provider`.** Its webpack 4 hashes with md4, which OpenSSL 3 refuses (`ERR_OSSL_EVP_UNSUPPORTED`). Nuxt does not need it.
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
