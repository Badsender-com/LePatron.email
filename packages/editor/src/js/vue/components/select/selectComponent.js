
const Vue = require('vue/dist/vue.common');
const vSelect = require('vue-select');

const SelectComponent = Vue.component('SelectComponent', {
    components: {
        VueSelect: vSelect.VueSelect
    },
    template: `
        <vue-select
           class="vue-select"
           v-bind="$attrs" 
        ></vue-select>
    `
});

module.exports = {
    SelectComponent,
};
  