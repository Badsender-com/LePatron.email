'use strict';

// The project has no @vue/test-utils. This reads the <script> of a .vue file,
// compiles it with Babel and hands back its options, for a test to build the
// component with Vue itself. Its imports are required as Jest requires them,
// except those the test replaces (`mocks`, keyed by the import as written),
// the child components (`.vue`) and the icons, which no test needs.

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const UI = path.join(__dirname, '../../packages/ui');

function loadVueComponent(file, mocks = {}) {
  const filename = path.join(UI, file);
  const source = fs.readFileSync(filename, 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(source)[1];
  const { code } = babel.transformSync(script, {
    filename: `${filename}.js`,
    babelrc: false,
    configFile: false,
    presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  });

  const requireImport = (request) => {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }
    if (request === 'lucide-vue') return {};
    let local = null;
    if (request.startsWith('~/')) local = path.join(UI, request.slice(2));
    if (request.startsWith('.')) {
      local = path.resolve(path.dirname(filename), request);
    }
    if (!local) return require(request);
    // A child component, imported with or without its extension.
    if (local.endsWith('.vue') || fs.existsSync(`${local}.vue`)) return {};
    return require(local);
  };

  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', code)(
    requireImport,
    module,
    module.exports
  );
  return module.exports.default;
}

module.exports = { loadVueComponent };
