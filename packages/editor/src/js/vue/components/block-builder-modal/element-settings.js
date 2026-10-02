const Vue = require('vue/dist/vue.common');
const { RichTextFieldComponent } = require('./rich-text-field');

// The settings panel of the selected element.
//
// One declarative field list per element type rather than one component per
// type: the fields are all made of the same four controls, and a table is far
// easier to extend — adding a sixth element means adding a list here, not a
// component.
//
// Values are free, as decided: roles resolved against the template theme come
// later, and they will replace a `type` here without touching the panel itself.

// Labels are i18n keys, resolved by the modal (see LABEL_KEYS below).
const FIELDS = {
  text: [
    { key: 'content', labelKey: 'block-builder-field-text', type: 'richtext' },
    { key: 'align', labelKey: 'block-builder-field-align', type: 'align' },
    {
      key: 'fontSize',
      labelKey: 'block-builder-field-font-size',
      type: 'number',
      min: 8,
      max: 72,
    },
    {
      key: 'lineHeight',
      labelKey: 'block-builder-field-line-height',
      type: 'number',
      min: 8,
      max: 96,
    },
    { key: 'color', labelKey: 'block-builder-field-color', type: 'color' },
  ],
  image: [
    { key: 'src', labelKey: 'block-builder-field-image', type: 'image' },
    { key: 'alt', labelKey: 'block-builder-field-alt', type: 'text' },
    {
      key: 'href',
      labelKey: 'block-builder-field-link-optional',
      type: 'text',
    },
    {
      key: 'width',
      labelKey: 'block-builder-field-width',
      type: 'number',
      min: 20,
      max: 600,
    },
    { key: 'align', labelKey: 'block-builder-field-align', type: 'align' },
  ],
  button: [
    { key: 'label', labelKey: 'block-builder-field-label', type: 'text' },
    { key: 'href', labelKey: 'block-builder-field-link', type: 'text' },
    {
      key: 'backgroundColor',
      labelKey: 'block-builder-field-background',
      type: 'color',
    },
    { key: 'color', labelKey: 'block-builder-field-text-color', type: 'color' },
    {
      key: 'borderRadius',
      labelKey: 'block-builder-field-radius',
      type: 'number',
      min: 0,
      max: 50,
    },
    { key: 'align', labelKey: 'block-builder-field-align', type: 'align' },
  ],
  divider: [
    { key: 'color', labelKey: 'block-builder-field-color', type: 'color' },
    {
      key: 'thickness',
      labelKey: 'block-builder-field-thickness',
      type: 'number',
      min: 1,
      max: 12,
    },
  ],
  spacer: [
    {
      key: 'height',
      labelKey: 'block-builder-field-height',
      type: 'number',
      min: 4,
      max: 160,
    },
  ],
};

const ALIGNMENTS = [
  { value: 'left', labelKey: 'block-builder-align-left' },
  { value: 'center', labelKey: 'block-builder-align-center' },
  { value: 'right', labelKey: 'block-builder-align-right' },
];

// Every key this panel reads from `labels`, so the modal can resolve them all
// without knowing the field tables.
const LABEL_KEYS = Array.from(
  new Set(
    [
      'block-builder-select-element',
      'block-builder-choose-image',
      'block-builder-change-image',
    ]
      .concat(
        ...Object.values(FIELDS).map((fields) => fields.map((f) => f.labelKey))
      )
      .concat(ALIGNMENTS.map((option) => option.labelKey))
  )
);

// Fields rendered as a plain <input>.
const INPUT_TYPES = new Set(['text', 'color', 'number']);

const ElementSettingsComponent = Vue.component('ElementSettings', {
  components: { RichTextField: RichTextFieldComponent },
  props: {
    element: { type: Object, default: null },
    // Translated by the modal, which holds the view-model, keyed by i18n key
    // (LABEL_KEYS). Passing the strings down keeps this component free of the
    // editor's i18n plumbing.
    labels: { type: Object, default: () => ({}) },
  },
  data: () => ({ alignments: ALIGNMENTS }),
  computed: {
    fields() {
      if (!this.element) return [];
      return FIELDS[this.element.type] || [];
    },
  },
  methods: {
    // Emitted rather than mutated in place, so the parent stays the single
    // owner of the state — which is what will let it move onto the Mosaico
    // model unchanged when inline editing arrives.
    update(key, value) {
      this.$emit('change', { key, value });
    },
    onNumber(field, event) {
      const parsed = Number.parseInt(event.target.value, 10);
      if (Number.isFinite(parsed)) this.update(field.key, parsed);
    },
    // Handled by the modal, which is the one holding the view-model the
    // gallery dialog lives on.
    pickImage(key) {
      this.$emit('pick-image', key);
    },
    // A method rather than a ternary in the template: an apostrophe inside a
    // Vue expression cannot be escaped when the template is itself a JS
    // template literal — `\'` becomes `'` before Vue ever sees it, and the
    // expression fails to compile, taking the whole panel down with it.
    pickLabel(field) {
      return this.label(
        this.element[field.key]
          ? 'block-builder-change-image'
          : 'block-builder-choose-image'
      );
    },
    // Ids tying each label to its control, unique per panel instance.
    controlId(field) {
      return `bb-field-${this._uid}-${field.key}`;
    },
    labelId(field) {
      return `${this.controlId(field)}-label`;
    },
    // A real <label for> where the control is an input; the others — the text
    // editor, the image picker, the alignment group — point back at the label
    // with aria-labelledby instead.
    labelTarget(field) {
      return INPUT_TYPES.has(field.type) ? this.controlId(field) : null;
    },
    // A method for the same reason: the keys hold dashes, and a template-literal
    // template is a poor place to quote them.
    label(key) {
      return this.labels[key] || key;
    },
  },
  template: `<div class="bb-settings">
  <p v-if="!element" class="bb-settings__empty">{{ label('block-builder-select-element') }}</p>
  <div v-else>
    <div v-for="field in fields" :key="field.key" class="bb-settings__field">
      <label
        :id="labelId(field)"
        :for="labelTarget(field)"
        class="bb-settings__label">{{ label(field.labelKey) }}</label>

      <rich-text-field
        v-if="field.type === 'richtext'"
        :value="element[field.key]"
        :labelledby="labelId(field)"
        @input="update(field.key, $event)" />

      <div
        v-else-if="field.type === 'image'"
        class="bb-settings__image"
        role="group"
        :aria-labelledby="labelId(field)">
        <div
          v-if="element[field.key]"
          class="bb-settings__thumb"
          :style="{ backgroundImage: 'url(' + element[field.key] + ')' }"></div>
        <button
          type="button"
          class="bb-settings__pick"
          @click.prevent="pickImage(field.key)">{{ pickLabel(field) }}</button>
      </div>

      <input
        v-else-if="field.type === 'text'"
        :id="controlId(field)"
        type="text"
        class="bb-settings__input"
        :value="element[field.key]"
        @input="update(field.key, $event.target.value)" />

      <input
        v-else-if="field.type === 'color'"
        :id="controlId(field)"
        type="color"
        class="bb-settings__input bb-settings__input--color"
        :value="element[field.key]"
        @input="update(field.key, $event.target.value)" />

      <input
        v-else-if="field.type === 'number'"
        :id="controlId(field)"
        type="number"
        class="bb-settings__input"
        :min="field.min"
        :max="field.max"
        :value="element[field.key]"
        @input="onNumber(field, $event)" />

      <div
        v-else-if="field.type === 'align'"
        class="bb-settings__group"
        role="group"
        :aria-labelledby="labelId(field)">
        <button
          v-for="option in alignments"
          :key="option.value"
          type="button"
          class="bb-settings__choice"
          :class="{ 'bb-settings__choice--on': element[field.key] === option.value }"
          :aria-pressed="String(element[field.key] === option.value)"
          @click.prevent="update(field.key, option.value)">{{ label(option.labelKey) }}</button>
      </div>
    </div>
  </div>
</div>`,
});

module.exports = { ElementSettingsComponent, FIELDS, LABEL_KEYS };
