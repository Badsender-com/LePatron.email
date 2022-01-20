const Vue = require('vue/dist/vue.common');
const  VueTimepicker = require( 'vue2-timepicker').default;

const TimeInput= Vue.component('TimeInput', {
    components: {
        VueTimepicker
    },
    props: {
        value: { type: String, default: () => ({})  },
    },
    methods: {
        handleInput(value) {
            this.$emit('input', value);
        }
    },
    template: `
        <vue-timepicker 
         :minute-interval="30" 
         :value="value" 
         @input="handleInput"
         v-bind="$attrs" >
         </vue-timepicker>
    `
});

module.exports = {
    TimeInput,
};
  