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

const FIELDS = {
  text: [
    { key: 'content', label: 'Texte', type: 'richtext' },
    { key: 'align', label: 'Alignement', type: 'align' },
    { key: 'fontSize', label: 'Taille', type: 'number', min: 8, max: 72 },
    { key: 'lineHeight', label: 'Interligne', type: 'number', min: 8, max: 96 },
    { key: 'color', label: 'Couleur', type: 'color' },
  ],
  image: [
    { key: 'src', label: 'Adresse de l’image', type: 'text' },
    { key: 'alt', label: 'Texte alternatif', type: 'text' },
    { key: 'href', label: 'Lien (optionnel)', type: 'text' },
    { key: 'width', label: 'Largeur', type: 'number', min: 20, max: 600 },
    { key: 'align', label: 'Alignement', type: 'align' },
  ],
  button: [
    { key: 'label', label: 'Libellé', type: 'text' },
    { key: 'href', label: 'Lien', type: 'text' },
    { key: 'backgroundColor', label: 'Fond', type: 'color' },
    { key: 'color', label: 'Texte', type: 'color' },
    { key: 'borderRadius', label: 'Arrondi', type: 'number', min: 0, max: 50 },
    { key: 'align', label: 'Alignement', type: 'align' },
  ],
  divider: [
    { key: 'color', label: 'Couleur', type: 'color' },
    { key: 'thickness', label: 'Épaisseur', type: 'number', min: 1, max: 12 },
  ],
  spacer: [{ key: 'height', label: 'Hauteur', type: 'number', min: 4, max: 160 }],
};

const ALIGNMENTS = [
  { value: 'left', label: 'Gauche' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Droite' },
];

const ElementSettingsComponent = Vue.component('ElementSettings', {
  components: { RichTextField: RichTextFieldComponent },
  props: {
    element: { type: Object, default: null },
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
  },
  template: `<div class="bb-settings">
  <p v-if="!element" class="bb-settings__empty">Sélectionnez un élément pour le régler.</p>
  <div v-else>
    <div v-for="field in fields" :key="field.key" class="bb-settings__field">
      <label class="bb-settings__label">{{ field.label }}</label>

      <rich-text-field
        v-if="field.type === 'richtext'"
        :key="element.id"
        :value="element[field.key]"
        @input="update(field.key, $event)" />

      <input
        v-else-if="field.type === 'text'"
        type="text"
        class="bb-settings__input"
        :value="element[field.key]"
        @input="update(field.key, $event.target.value)" />

      <input
        v-else-if="field.type === 'color'"
        type="color"
        class="bb-settings__input bb-settings__input--color"
        :value="element[field.key]"
        @input="update(field.key, $event.target.value)" />

      <input
        v-else-if="field.type === 'number'"
        type="number"
        class="bb-settings__input"
        :min="field.min"
        :max="field.max"
        :value="element[field.key]"
        @input="onNumber(field, $event)" />

      <div v-else-if="field.type === 'align'" class="bb-settings__group">
        <button
          v-for="option in alignments"
          :key="option.value"
          type="button"
          class="bb-settings__choice"
          :class="{ 'bb-settings__choice--on': element[field.key] === option.value }"
          @click.prevent="update(field.key, option.value)">{{ option.label }}</button>
      </div>
    </div>
  </div>
</div>`,
});

module.exports = { ElementSettingsComponent, FIELDS };
