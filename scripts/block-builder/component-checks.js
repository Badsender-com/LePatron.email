'use strict';

// What the compiler refuses before it renders anything.
//
// Every refusal here stands for a mistake that would otherwise compile to
// plausible-looking markup with a hole silently missing — and the only symptom
// would be an email that looks wrong in production.

/**
 * A default of the type the generator and the editor expect.
 *
 * The editor coerces a stored value to the type of its default, and the
 * templates format what they are given: a string size lands in arithmetic, a
 * number label breaks a `slice`. So the type is part of the contract, not a
 * detail of the literal.
 */
function checkDefault(where, slot) {
  if (slot.context === 'PX') {
    if (!Number.isInteger(slot.default)) {
      throw new Error(`${where} is PX: its default must be an integer.`);
    }
  } else if (typeof slot.default !== 'string') {
    throw new Error(
      `${where} is ${slot.context}: its default must be a string.`
    );
  }
  if (slot.fallback !== undefined && typeof slot.fallback !== 'string') {
    throw new Error(`${where}: a fallback, when given, must be a string.`);
  }
}

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
    checkDefault(`${name}.slots.js: slot "${slotName}"`, slot);
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

const quoted = (names) => names.map((n) => `"${n}"`).join(', ');

/**
 * defineProps and the manifest name the same props, both ways.
 *
 * - a prop defineProps declares and the manifest does not has no context: it
 *   would get no sentinel, render as nothing, and leave a hole in the markup.
 * - a slot the manifest declares and defineProps does not would reach the
 *   component as a stray attribute, not as a prop the template can place.
 *
 * Checked on the declarations themselves, not on the render: a prop with no
 * sentinel renders nothing, so nothing in the output could reveal it.
 */
function checkPropsDeclared(name, bindings, slots, variants) {
  const declared = Object.keys(bindings).filter(
    (prop) => bindings[prop] === 'props'
  );

  const known = new Set(Object.keys(slots));
  Object.values(variants).forEach((fixed) =>
    Object.keys(fixed).forEach((prop) => known.add(prop))
  );

  const undeclared = declared.filter((prop) => !known.has(prop));
  if (undeclared.length) {
    throw new Error(
      `${name}.vue declares ${quoted(undeclared)}, which ${name}.slots.js ` +
        'neither lists as a slot nor fixes in a variant. A prop with no ' +
        'context would render as nothing at all.'
    );
  }

  const missing = [...known].filter((prop) => !declared.includes(prop));
  if (missing.length) {
    throw new Error(
      `${name}.slots.js names ${quoted(missing)}, which ${name}.vue does not ` +
        'declare in defineProps.'
    );
  }
}

// How the compiled render reads what is NOT a declared prop: compiled with the
// script's bindings, a prop is `$props.x`; anything else is `_ctx.x`, or
// `$setup.x` for a name bound in <script setup>.
const FOREIGN_REFERENCE = /(?:\b_ctx|\$setup)\.([A-Za-z_$][\w$]*)/;

/**
 * The template reads nothing but its props.
 *
 * Read from the compiled render, which has already resolved every name the
 * template uses: an expression the compiler could not tie to a prop would
 * render as `undefined` — or not at all — with no sentinel to give it away.
 *
 * @param {string} name
 * @param {string} code the compiled render function
 */
function checkTemplateReferences(name, code) {
  const foreign = FOREIGN_REFERENCE.exec(code);
  if (foreign) {
    throw new Error(
      `${name}.vue: the template reads "${foreign[1]}", which is not a prop ` +
        'declared in defineProps. Only props reach the render — write the ' +
        'prop itself (`label`, not `props.label`).'
    );
  }
}

module.exports = { checkManifest, checkPropsDeclared, checkTemplateReferences };
