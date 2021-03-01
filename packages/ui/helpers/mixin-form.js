export default {
  methods: {
    requiredErrors(fieldName, scope) {
      const errors = [];
      if (!scope[fieldName].$dirty) return errors;
      !scope[fieldName].required && errors.push(this.$t('errors.required'));
      return errors;
    },
    isValidForm() {
      this.$v.$touch();
      return !this.$v.$invalid;
    },
  },
};
