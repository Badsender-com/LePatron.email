'use strict';

// What the compiler refuses before it renders anything.
//
// Every refusal here stands for a mistake that would otherwise compile to
// plausible-looking markup with a hole silently missing — and the only symptom
// would be an email that looks wrong in production.

const { compileScript } = require('@vue/compiler-sfc');

/**
 * Every prop must be declared, and every declared prop must carry a context the
 * engine knows. A prop nobody declared would otherwise render a sentinel into
 * the shipped HTML, or — worse — reach the output with no escaping at all.
 *
 * @param {string} name
 * @param {Object} manifest what `<name>.slots.js` exports
 * @returns {{slots: Object, variants: Object}}
 */
function checkManifest(name, manifest) {
  const slots = (manifest && manifest.slots) || {};

  if (Object.keys(slots).length === 0) {
    throw new Error(`${name}.slots.js exports no slots.`);
  }

  Object.entries(slots).forEach(([slotName, slot]) => {
    if (!slot || !slot.context) {
      throw new Error(
        `${name}.slots.js: slot "${slotName}" declares no context.`
      );
    }
  });

  // A component with no variants compiles to one template. With variants it
  // compiles to one per entry, each rendered with those props FIXED — which is
  // how a `v-if` is allowed to exist at all: the generator joins strings, it
  // never branches, so every branch has to be resolved here.
  //
  // `{ default: {} }` keeps the two cases on the same path.
  const variants = manifest.variants || { default: {} };

  return { slots, variants };
}

/**
 * Every prop the component declares must be a slot or a variant prop.
 *
 * Without this, a prop the manifest forgot renders as `undefined`: Vue drops
 * the attribute, no sentinel is created, nothing survives to be caught, and the
 * component compiles to markup with a hole silently missing.
 *
 * `defineProps` is the right place to read it from: it is what the author
 * already writes, so the two lists cannot drift without one of them being edited.
 */
function checkPropsDeclared(name, descriptor, slots, variants) {
  if (!descriptor.scriptSetup) return;

  const { bindings } = compileScript(descriptor, { id: name });
  const declared = Object.entries(bindings || {})
    .filter(([, kind]) => kind === 'props')
    .map(([prop]) => prop);

  const known = new Set(Object.keys(slots));
  Object.values(variants).forEach((fixed) =>
    Object.keys(fixed).forEach((prop) => known.add(prop))
  );

  const undeclared = declared.filter((prop) => !known.has(prop));
  if (undeclared.length) {
    throw new Error(
      `${name}.vue declares ${undeclared.map((p) => `"${p}"`).join(', ')}, ` +
        `which ${name}.slots.js neither lists as a slot nor fixes in a ` +
        'variant. A prop with no context would render as nothing at all.'
    );
  }
}

module.exports = { checkManifest, checkPropsDeclared };
