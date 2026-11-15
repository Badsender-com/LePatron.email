/**
 * A refusal the server alone can decide (a label or an identifier already
 * taken), shown next to its field in a value's form
 * rather than in a snackbar at the other end of the screen.
 */
export default {
  data() {
    return {
      serverLabelError: null,
      serverIdentifierError: null,
    };
  },
  methods: {
    /**
     * Attach a server-side refusal to its field. Called by the parent, which is
     * the one that talks to the API.
     *
     * @param {string} field `label` or `canonicalType`
     * @param {string} message already translated
     * @returns {boolean} whether this form, open, has that field
     */
    setFieldError(field, message) {
      // A closed panel shows nothing: the quick add's refusal goes to the
      // snackbar instead.
      if (!this.$refs.modal || !this.$refs.modal.isOpen) return false;
      if (field === 'label') {
        this.serverLabelError = message;
        this.$v.form.label.$touch();
        return true;
      }
      if (field === 'canonicalType' && !this.isEmailType) {
        this.serverIdentifierError = message;
        return true;
      }
      return false;
    },
  },
};
