'use strict';

/**
 * Mounts a single-file Vue component of the UI in jsdom, for a test that
 * checks what it shows and what it asks of the server. The project has no
 * @vue/test-utils: the component's script goes through the project's Babel
 * configuration, its template through vue-template-compiler, and it mounts
 * on Vue's runtime.
 *
 * - `imports` stands in for what the script imports, by the path it names
 *   (`'~/components/bs-timestamp.vue'`, `'lucide-vue'`): anything else it
 *   imports is an error, so a test says what it replaces.
 * - The Vuetify components (`v-…`) and the ones the script names are left as
 *   plain elements holding their content: a `v-btn` is a button-like element
 *   whose `click` the test dispatches. A component of the project the test
 *   gives compiled (`componentOf`) is rendered, its named slots with it.
 * - `mocks` become the instance's properties (`$t`, `$axios`…).
 *
 * The test file runs in jsdom (`@jest-environment jsdom`).
 */

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const { parseComponent, compileToFunctions } = require('vue-template-compiler');
const Vue = require('vue');

const ROOT = path.join(__dirname, '../..');

Vue.config.productionTip = false;
Vue.config.devtools = false;
// Vuetify and the components a test leaves out render as plain elements.
Vue.config.ignoredElements = [/^v-/, /^lucide-/, /^bs-/];

// Babel loads the UI's configuration and its presets at its first transform,
// most of what a mount costs: done here, when the test file loads, rather
// than inside the 5 seconds of its first test, which the full suite's
// parallel load made it exceed.
babel.transformSync('', {
  filename: path.join(ROOT, 'packages/ui/component.js'),
  root: ROOT,
});

function optionsOf(file, imports) {
  const { script, template } = parseComponent(fs.readFileSync(file, 'utf8'));
  const { code } = babel.transformSync(script.content, {
    filename: path.join(path.dirname(file), 'component.js'),
    root: ROOT,
  });
  const module = { exports: {} };
  const required = (name) => {
    if (name in imports) return imports[name];
    throw new Error(
      `mount-sfc: ${file} imports ${name}, which the test does not give`
    );
  };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', code)(
    required,
    module,
    module.exports
  );
  const options = module.exports.default || module.exports;
  // Only the components the test gives compiled are rendered.
  const rendered = Object.fromEntries(
    Object.entries(options.components || {}).filter(
      ([, component]) => component && typeof component.render === 'function'
    )
  );
  return {
    ...options,
    ...compileToFunctions(template.content),
    components: rendered,
  };
}

/**
 * A component of the UI, compiled as `mountSfc` compiles it, for a test to
 * give in `imports` when what the component shows sits in its slots.
 *
 * @param {string} file the path of the .vue file, from the repository root
 * @param {Object} [imports] what its script imports
 * @returns {Object} the component's options
 */
function componentOf(file, imports = {}) {
  return optionsOf(path.join(ROOT, file), imports);
}

/**
 * @param {string} file the path of the .vue file, from the repository root
 * @param {Object} [options]
 * @param {Object} [options.props]
 * @param {Object} [options.mocks]
 * @param {Object} [options.imports]
 * @returns {Vue} the mounted instance; its `$el` is in the document
 */
function mountSfc(file, { props = {}, mocks = {}, imports = {} } = {}) {
  const Component = Vue.extend(optionsOf(path.join(ROOT, file), imports));
  const host = document.createElement('div');
  document.body.appendChild(host);
  const vm = new Component({
    propsData: props,
    beforeCreate() {
      Object.assign(this, mocks);
    },
  });
  vm.$mount(host);
  return vm;
}

// Lets the promises the component awaits settle, then the DOM update.
async function settle(vm) {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await vm.$nextTick();
}

module.exports = { mountSfc, componentOf, settle };
