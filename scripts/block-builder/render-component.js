'use strict';

// Vue's part of the build: template in, HTML with sentinels out.
//
// The template is compiled here, explicitly, rather than handed to the runtime
// compiler through `createSSRApp({ template })`. Two things depend on it:
//
//   - the output must not depend on the environment. Vue's defaults follow
//     NODE_ENV — a production build drops every comment, Outlook's conditional
//     comments included — so a `NODE_ENV=production` shell would have compiled
//     different emails from the same source. Every option that shapes the
//     output is spelled out below instead.
//   - a compile error must stop the build. The runtime compiler only WARNS
//     about a template it cannot compile, and renders what it could.

// Vue's production build is not merely quieter: it strips the warnings this
// build relies on to refuse a broken component. Picked at require time, so it
// is checked before Vue is loaded. The command line script forces the
// development build; this is for anything else that requires the module.
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'The block builder compiler needs Vue’s development build: run it ' +
      'without NODE_ENV=production.'
  );
}

/* eslint-disable import/order */
const { compileTemplate } = require('@vue/compiler-sfc');
const Vue = require('vue3');
const serverRenderer = require('vue3/server-renderer');
/* eslint-enable import/order */

const { sentinelFor } = require('./markup-pipeline.js');

// What the generated render function `require`s. The aliases matter: in this
// repository `vue` is Vue 2, which the editor uses.
const RENDER_REQUIRES = { vue: Vue, 'vue/server-renderer': serverRenderer };

/**
 * @param {string} name
 * @param {string} template the `<template>` content
 * @param {Object} bindings what compileScript reports, so props are read as
 *   `$props.x` and anything else stands out as `_ctx.x`
 * @returns {{ssrRender: Function, code: string}}
 */
function compileRender(name, template, bindings) {
  const { code, errors, tips } = compileTemplate({
    source: template,
    filename: `${name}.vue`,
    id: name,
    ssr: true,
    ssrCssVars: [],
    // Asset URLs would become `import`s, which a function-mode render cannot
    // hold — and an email's images are absolute URLs anyway.
    transformAssetUrls: false,
    compilerOptions: {
      mode: 'function',
      // Kept, then stripped by the pipeline: every comment goes but Outlook's
      // conditional ones, which are markup to the clients that read them.
      comments: true,
      whitespace: 'condense',
      bindingMetadata: bindings,
    },
  });

  const problems = errors.concat(tips).map((e) => e.message || String(e));
  if (problems.length) {
    throw new Error(
      `${name}.vue: the template does not compile cleanly:\n${problems
        .map((p) => `  ${p}`)
        .join('\n')}`
    );
  }

  // eslint-disable-next-line no-new-func
  const ssrRender = Function('require', code)((id) => RENDER_REQUIRES[id]);
  return { ssrRender, code };
}

/**
 * Renders the component once, with a sentinel in place of every slot prop.
 *
 * @param {{ssrRender: Function, slots: Object}} component
 * @param {Object} fixed the variant's props, real values rather than sentinels
 * @returns {Promise<string>} HTML still carrying the sentinels
 */
async function renderWithSentinels({ ssrRender, slots }, fixed) {
  const slotNames = Object.keys(slots);
  const props = slotNames.reduce((all, name) => {
    all[name] = sentinelFor(name);
    return all;
  }, {});

  // The variant's own props are real values: they are what the `v-if` reads,
  // and they must not survive into the output.
  Object.assign(props, fixed);

  const app = Vue.createSSRApp(
    { props: slotNames.concat(Object.keys(fixed)), ssrRender },
    props
  );
  // A warning is a component that renders, but not as written — a property
  // the template reads and nothing defines, say. Vue would log it and carry
  // on; here it fails the build, like everything else that would ship a hole.
  app.config.warnHandler = (message) => {
    throw new Error(`Vue warned while rendering: ${message}`);
  };
  app.config.errorHandler = (error) => {
    throw error;
  };
  return serverRenderer.renderToString(app);
}

module.exports = { compileRender, renderWithSentinels };
