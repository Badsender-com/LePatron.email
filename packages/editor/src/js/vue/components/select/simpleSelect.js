const Vue = require('vue/dist/vue.common');

/**
 * SimpleSelect - Native HTML select styled for the design system
 *
 * A lightweight dropdown component using native <select> element.
 * Replaces vue-select for simple use cases.
 *
 * Props:
 * - value: Object { label, code } - Selected option
 * - options: Array<{ label, code }> - Available options
 * - placeholder: String - Placeholder text when no selection
 *
 * Events:
 * - input: Emits selected option object for v-model
 */
const SimpleSelect = Vue.component('SimpleSelect', {
  props: {
    value: {
      type: Object,
      default: null,
    },
    options: {
      type: Array,
      default: () => [],
    },
    placeholder: {
      type: String,
      default: '',
    },
  },
  computed: {
    selectedCode() {
      return this.value?.code ?? '';
    },
  },
  methods: {
    handleChange(event) {
      const code = event.target.value;
      if (!code) {
        this.$emit('input', null);
        return;
      }
      const selectedOption = this.options.find((opt) => String(opt.code) === code);
      this.$emit('input', selectedOption || null);
    },
  },
  template: `
    <div class="simple-select">
      <select
        :value="selectedCode"
        @change="handleChange"
        class="simple-select__input"
      >
        <option value="" disabled>{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="option.code"
          :value="option.code"
        >
          {{ option.label }}
        </option>
      </select>
      <span class="simple-select__arrow">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </div>
  `,
});

module.exports = {
  SimpleSelect,
};
