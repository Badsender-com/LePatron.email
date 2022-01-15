
const Vue = require('vue/dist/vue.common');
const vSelect = require('vue-select');

const Select= Vue.component('Select', {
    components: {
        VueSelect: vSelect.VueSelect
    },
    props: {
        value: { type: Object, default: () => ({})  },
    },
    methods: {
        handleSelected(value) {
            this.$emit('selected', value);
        },
        handleInput(value) {
            this.$emit('input', value);
        }
    },
    template: `
        <vue-select
           :value="value" 
           @input="handleInput"
           class="vue-select"
           @option:selected="handleSelected"
           v-bind="$attrs" 
        ></vue-select>
    `
});

module.exports = {
    Select,
};
  