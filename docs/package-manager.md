# Package manager

Yarn 4, pinned by `packageManager` in `package.json` and run through Corepack. Run `corepack enable` once per machine; `yarn` then uses the pinned version, whatever is installed globally. Node ships Corepack up to version 24; from Node 25, install it with `npm install -g corepack`.

## Yarn 1.22 → 4.18.1

Yarn 1 is no longer maintained, and Clever Cloud cannot key its dependency cache on the lockfile: their support pointed to a faster package manager as the lever for install time.

### Settings

`.yarnrc.yml` holds them:

- **`nodeLinker: node-modules`**: Plug'n'Play would break the Nuxt 2, gulp and browserify builds, which expect a hoisted `node_modules`.
- **`enableScripts: false`**, the Yarn 4 default: dependencies' install scripts do not run. Three are allowed in `dependenciesMeta`, the ones the app needs at runtime: `puppeteer` (downloads Chrome, for template previews), `gifsicle` (downloads its binary, for GIF resizing) and `sharp` (checks its prebuilt binary). A new dependency whose install script matters gets its line in `dependenciesMeta`; `yarn install` lists the skipped ones (`YN0004`). The project's own `postinstall` (`husky install`) still runs.
- The other Yarn 4 defaults stay: no git dependencies, and a package version must be a day old to be resolved.

`engines.yarn` (`<2`) is gone: `packageManager` replaces it.

The skipped scripts that did something:

- **Cypress** no longer downloads its binary. Run `yarn cypress install` once before `yarn test:e2e`.
- **`ssh2`** no longer builds its optional crypto binding, nor **`cpu-features`** its optional native module: `ssh2` falls back to plain JavaScript. On Clever Cloud the `cpu-features` build already failed, `node-gyp` being missing.
- **`fsevents`** 1.2.13 (macOS, development only) no longer builds; `fsevents` 2 has no script.

The others only printed a message: `core-js`, `nodemon`, `nuxt`, `vuepress`, `es5-ext`, `typechecker`.

### Puppeteer's install waited ten minutes for nothing

Puppeteer's install script downloads Chrome in about 20 s, then stays alive until Google's servers close the connection, which they do after 610 s idle: `@puppeteer/browsers` 1.9.1 asks for `Connection: keep-alive` on an agent that never releases the socket. On Clever Cloud this was most of the install (`yarn install` took 659 s, its "Building fresh packages" step about ten minutes). Measured locally: the script exits at 610 s, 23 s with the fix.

The fix is a Yarn patch, `.yarn/patches/@puppeteer-browsers-npm-1.9.1-*.patch`, applied through `resolutions`: `httpRequest` no longer asks for keep-alive by default. Version 3 of `@puppeteer/browsers` no longer has this code, but it comes with Puppeteer 25 and a newer Chrome (#1376). The `resolutions` entry names version 1.9.1: once Puppeteer is upgraded it matches nothing and nothing says so, remove it and the patch then.

### Lockfile

Converted by Yarn, not regenerated: every package keeps the version Yarn 1 had resolved. Yarn 4 adds what its compatibility layer declares on behalf of packages that forget to: `@types/keyv` for `got`, `@babel/types` for `@babel/parser`, and `node-gyp` for the packages whose scripts call it (`cpu-features`, `nan`, `fsevents`, and `evp_bytestokey`, whose test script mentions it). `evp_bytestokey` is not optional, so `node-gyp` 13 and its dependencies (`undici`, `tar` 7, `minipass` 7…) are installed everywhere, production included. They never run, but they make the install bigger and give audits more to scan; the top-level `tar` moves from 6.2.1 to 7.5.22.

The `@nuxtjs/vuetify/**/sass` resolution is gone, Yarn 4 does not read that syntax. `sass` stays at 1.32.13, the version `@nuxtjs/vuetify` asks for (`~1.32.13`).

Yarn 4 hoists differently, so browserify picks other copies of the same files for the editor bundle's Node shims: the bundle's one copy of `inherits` is 2.0.3 instead of 2.0.1 (2.0.3 only adds a guard for a missing parent class), and the module ids shift. The Nuxt build produces the same code, only its source maps differ.

### Measures

On a MacBook, Node 24.22.1, without Chrome and Cypress downloads in either case:

|                                | Yarn 1.22 | Yarn 4.18.1 |
| ------------------------------ | --------- | ----------- |
| Empty cache, no `node_modules` | 60 s      | 41 s        |
| Warm cache, no `node_modules`  | 25 s      | 22 s        |
| `node_modules` up to date      | < 1 s     | 4 s         |

`yarn test-ci` and `yarn build` pass; `sharp`, `gifsicle` and `ssh2-sftp-client` load and work, and Puppeteer's install script downloads Chrome. What staging checks: Chrome launching, through `POST /api/templates/:templateId/preview` (no screen calls it today, #1375), and the install time on Clever Cloud.

### CI

GitHub Actions run `corepack enable` before `actions/setup-node`, whose Yarn cache asks Yarn for its cache folder, then `yarn install --immutable` (`--frozen-lockfile` in Yarn 1). That `corepack` comes with the runner's preinstalled Node, not with the version `setup-node` installs: if the runner image changes it, this step is the first suspect.

### Clever Cloud

Clever Cloud runs `yarn install` with no flag, and Yarn 4 always installs devDependencies, which `yarn build` needs.

On each application, just before the merge that deploys this change to it:

- `CC_NODE_BUILD_TOOL` goes from `yarn`, which runs Yarn 1, to `yarn-berry`. Not before: the branch still deployed would then run on Yarn 4. Yarn 1 refuses a project pinned to Yarn 4, so a new application needs `yarn-berry` too.
- `CC_NODE_DEV_DEPENDENCIES` can go: it has no effect with Yarn 4.
- Where `CC_CACHE_DEPENDENCIES` is `true`, add `YARN_ENABLE_GLOBAL_CACHE=false` and `CC_CACHE_DEPENDENCIES_EXTRA_PATHS=.yarn/cache`. Yarn 4 keeps its package cache in the home directory, which the dependency cache does not keep: with `node_modules` restored and that cache empty, Yarn 4 downloads every package again (547 MiB). The setting stays out of `.yarnrc.yml` so that each local worktree shares the global cache.
- Where `CC_CACHE_DEPENDENCIES` is not set, every deployment installs from scratch, Yarn 1 as Yarn 4: nothing to add.

`.yarn/install-state.gz` stays out of the cached paths on purpose. Without it, a cached install runs the three allowed install scripts again (measured locally: 4 s, plus Chrome's download). Puppeteer keeps Chrome in the home directory, which no cache keeps: its script is what puts Chrome back on each deployment.

The first deployment after the switch installs from scratch either way.

**Rolling back** to a commit before the switch: set `CC_NODE_BUILD_TOOL` back to `yarn` and remove `YARN_ENABLE_GLOBAL_CACHE` and `CC_CACHE_DEPENDENCIES_EXTRA_PATHS` before redeploying.
