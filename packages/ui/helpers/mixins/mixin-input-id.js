/**
 * mixinInputId - pairs a design-system field with the label it draws itself.
 *
 * Vuetify wires `for`/`id` on its own when it renders the label, but our form
 * components draw the label above the input instead, so nothing is left for
 * Vuetify to pair. A label without `for` is decoration: clicking it does not
 * focus the field, and a screen reader announces an unnamed control.
 *
 * The consuming component must expose a `hint` prop and a `hasError` computed;
 * `describedBy` reads both to point the field at whichever description is on
 * screen.
 */

const toKebabCase = (name) =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export default {
  props: {
    // Declared rather than read off `$attrs` so the caller's id never reaches
    // the inner field twice: out of `$attrs`, binding `:id` cannot collide with
    // what `v-bind="$attrs"` spreads, whatever their order.
    //
    // The caller's id wins when there is one — `users/form.vue` passes
    // `id="email"`, `id="lang"` and others, and overriding those would break
    // whatever relies on them. The generated one is only the fallback.
    id: { type: String, default: null },
  },
  computed: {
    inputId() {
      return this.id || `${toKebabCase(this.$options.name)}-${this._uid}`;
    },
    hintId() {
      return `${this.inputId}-hint`;
    },
    errorId() {
      return `${this.inputId}-error`;
    },
    // The error replaces the hint rather than joining it, so only one of the
    // two is ever in the DOM to point at.
    describedBy() {
      if (this.hasError) return this.errorId;
      return this.hint ? this.hintId : null;
    },
  },
};
