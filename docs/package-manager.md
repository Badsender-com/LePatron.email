# Package manager

Yarn 4, pinned by `packageManager` in `package.json` and run through Corepack, which ships with Node 24. Run `corepack enable` once per machine; `yarn` then uses the pinned version, whatever is installed globally.

## Yarn 1.22 → 4.18.1

Yarn 1 is no longer maintained, and Clever Cloud cannot key its dependency cache on the lockfile: their support pointed to a faster package manager as the lever for install time.

### Settings

`.yarnrc.yml` holds them:

- **`nodeLinker: node-modules`**: Plug'n'Play would break the Nuxt 2, gulp and browserify builds, which expect a hoisted `node_modules`.
- **`enableScripts: false`**, the Yarn 4 default: dependencies' install scripts do not run. Three are allowed in `dependenciesMeta`, the ones the app needs at runtime: `puppeteer` (downloads Chrome, for template previews), `gifsicle` (downloads its binary, for GIF resizing) and `sharp` (checks its prebuilt binary). The scripts skipped include Cypress's binary download and a `node-gyp` build of `cpu-features`, an optional speed-up of `ssh2` that falls back to plain JavaScript. A new dependency whose install script matters gets its line in `dependenciesMeta`; `yarn install` lists the skipped ones (`YN0004`).
- The other Yarn 4 defaults stay: no git dependencies, and a package version must be a day old to be resolved.

`engines.yarn` (`<2`) is gone: `packageManager` replaces it.

### Lockfile

Converted by Yarn, not regenerated: every package keeps the version Yarn 1 had resolved. Yarn 4 adds what its compatibility layer declares on behalf of packages that forget to (`@types/keyv` for `got`, `@babel/types` for `@babel/parser`, `node-gyp` for `fsevents`), none of which runs.

The `@nuxtjs/vuetify/**/sass` resolution is gone, Yarn 4 does not read that syntax. `sass` stays at 1.32.13, the version `@nuxtjs/vuetify` asks for (`~1.32.13`).

Yarn 4 hoists differently, so browserify picks other copies of the same files for the editor bundle's Node shims: the bundle's one copy of `inherits` is 2.0.3 instead of 2.0.1 (2.0.3 only adds a guard for a missing parent class), and the module ids shift. The Nuxt build produces the same code, only its source maps differ.

### Measures

On a MacBook, Node 24.22.1, without Chrome and Cypress downloads in either case:

|                                | Yarn 1.22 | Yarn 4.18.1 |
| ------------------------------ | --------- | ----------- |
| Empty cache, no `node_modules` | 60 s      | 41 s        |
| Warm cache, no `node_modules`  | 25 s      | 22 s        |
| `node_modules` up to date      | < 1 s     | 4 s         |

`yarn test-ci` and `yarn build` pass; `sharp`, `gifsicle` and `ssh2-sftp-client` load and work, and Puppeteer's install script downloads Chrome. What staging checks: a template preview (Chrome launching), and the install time on Clever Cloud, where Cypress's binary no longer downloads.

### CI and deployment

- **GitHub Actions** run `corepack enable` before `actions/setup-node`, whose Yarn cache asks Yarn for its cache folder, then `yarn install --immutable` (`--frozen-lockfile` in Yarn 1).
- **Clever Cloud** picks Yarn 4 from `packageManager`, without `CC_NODE_BUILD_TOOL` (`yarn-berry` would say the same). It runs `yarn install` with no flag, and Yarn 4 always installs devDependencies, which `yarn build` needs: `CC_NODE_DEV_DEPENDENCIES` has no effect. Deploy once without the build cache after the switch.
