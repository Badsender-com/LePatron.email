# Node 18 Migration Guide

Summary of all changes on `feat/upgrade-node18` to migrate from **Node 14.16.0 → 18.18.0**.

---

## 1. Node Version

| File                        | Before    | After     |
| --------------------------- | --------- | --------- |
| `.nvmrc`                    | `14.16.0` | `18.18.0` |
| `package.json` engines.node | `14.16.0` | `18.18.0` |

## 2. Dependency Upgrades

| Package           | Before  | After   | Why                                              |
| ----------------- | ------- | ------- | ------------------------------------------------ |
| `nuxt`            | 2.14.12 | 2.17.4  | Fixes `ERR_PACKAGE_PATH_NOT_EXPORTED` on Node 18 |
| `mongoose`        | 5.12.0  | 5.13.22 | Node 18 compatibility                            |
| `sharp`           | 0.27.0  | ^0.33.5 | arm64/Node 18 native binary support              |
| `puppeteer`       | 1.20.0  | ^21.0.0 | Node 18 compatibility                            |
| `maildev`         | 1.1.0   | 2.1.0   | Node 18 compatibility                            |
| `@nuxtjs/vuetify` | 1.11.2  | 1.12.3  | Nuxt 2.17 compatibility                          |
| `lint-staged`     | >=10    | 13.2.3  | Pin to specific compatible version               |

## 3. Dependency Removals

| Package            | Version | Why                                                                                 |
| ------------------ | ------- | ----------------------------------------------------------------------------------- |
| `segfault-handler` | 1.3.0   | Native module incompatible with Node 18 / arm64                                     |
| `xml2json`         | 0.12.0  | Native deps (`node-expat`) incompatible with Node 18; replaced by `fast-xml-parser` |

## 4. Dependency Additions

| Package           | Version | Why                                                |
| ----------------- | ------- | -------------------------------------------------- |
| `vuex`            | 3.6.2   | Explicit dep (was previously hoisted transitively) |
| `fast-xml-parser` | ^4.3.0  | Pure-JS replacement for `xml2json`                 |

## 5. Resolutions Changes

**Removed:**

- `@babel/core`: 7.12.17
- `@babel/preset-env`: 7.12.17

**Added / Changed:**

- `@nuxtjs/vuetify/**/sass`: 1.32.12 → 1.32.13
- `winston`: pinned to 3.2.1
- `vue-server-renderer`: pinned to 2.6.14
- `@types/bson`: pinned to 4.0.5
- `@types/minimatch`: pinned to 5.1.2

## 6. Code Changes — xml2json → fast-xml-parser

Two files migrated from `xml2json` to `fast-xml-parser`:

### `packages/server/account/auth.guard.js`

```diff
-const xmlParser = require('xml2json');
+const { XMLParser } = require('fast-xml-parser');

-const jsonObject = xmlParser.toJson(buff.toString(), {
-  object: true,
-  sanitize: true,
-  trim: true,
-});
+const parser = new XMLParser({
+  ignoreAttributes: false,
+  trimValues: true,
+});
+const jsonObject = parser.parse(buff.toString());

 // Access change: .$t no longer needed
-email = jsonObject['saml2p:Response']['saml2:Assertion']['saml2:Subject']['saml2:NameID'].$t;
+email = jsonObject['saml2p:Response']['saml2:Assertion']['saml2:Subject']['saml2:NameID'];
```

### `packages/server/utils/soap-request.js`

```diff
-const xmlParser = require('xml2json');
+const { XMLParser } = require('fast-xml-parser');

-const jsObjectFromXml = JSON.parse(xmlParser.toJson(response.data));
+const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
+const jsObjectFromXml = parser.parse(response.data);
```

## 7. Script Changes

VuePress commands now require `NODE_OPTIONS=--openssl-legacy-provider` (webpack 4 + OpenSSL 3):

```diff
-"docs:dev": "vuepress dev ./packages/documentation",
-"docs:dev:build": "vuepress build ./packages/documentation",
+"docs:dev": "NODE_OPTIONS=--openssl-legacy-provider vuepress dev ./packages/documentation",
+"docs:dev:build": "NODE_OPTIONS=--openssl-legacy-provider vuepress build ./packages/documentation",
```

## 8. Install Notes

```bash
# NODE_OPTIONS needed for dev/build (webpack 4 + OpenSSL 3)
export NODE_OPTIONS=--openssl-legacy-provider

# --ignore-engines needed because bson@7.1.1 declares node>=20 but works fine on 18
yarn install --ignore-engines
```
