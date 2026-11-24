/**
 * A refusal the server alone can decide (a label or an identifier already
 * taken, a default already held), shown next to its field in a value's form
 * rather than in a snackbar at the other end of the screen.
 */
export default {
  data() {
    return {
      serverLabelError: null,
      serverIdentifierError: null,
      serverDefaultError: null,
    };
  },
  methods: {
    /**
     * Attach a server-side refusal to its field. Called by the parent, which is
     * the one that talks to the API.
     *
     * @param {string} field `label` or `canonicalType`
     * @param {string} message already translated
     * @returns {boolean} whether this form has that field
     */
    setFieldError(field, message) {
      if (field === 'label') {
        this.serverLabelError = message;
        this.$v.form.label.$touch();
        return true;
      }
      if (field === 'canonicalType' && !this.isEmailType) {
        this.serverIdentifierError = message;
        return true;
      }
      // The email type has no default (ADR-0024).
      if (field === 'isDefault' && !this.isEmailType) {
        this.serverDefaultError = message;
        return true;
      }
      return false;
    },
  },
};
