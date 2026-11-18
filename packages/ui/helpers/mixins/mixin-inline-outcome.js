// The outcome of saving a setting, kept for `BsSaveOutcome`: `outcome` is
// 'saved' for four seconds, then null, or 'failed' until the next try.
//
// Usage: `mixins: [mixinInlineOutcome]`, `this.markSaved()` after a save,
// `this.markFailed(detail)` after a failure, and in the template
// `<bs-save-outcome :outcome="outcome" :detail="outcomeDetail" @retry="save" />`.

const SAVED_FOR_MS = 4000;

export default {
  data() {
    return { outcome: null, outcomeDetail: '', outcomeTimer: null };
  },
  beforeDestroy() {
    clearTimeout(this.outcomeTimer);
  },
  methods: {
    clearOutcome() {
      clearTimeout(this.outcomeTimer);
      this.outcome = null;
      this.outcomeDetail = '';
    },
    markSaved() {
      clearTimeout(this.outcomeTimer);
      this.outcomeDetail = '';
      this.outcome = 'saved';
      this.outcomeTimer = setTimeout(() => {
        this.outcome = null;
      }, SAVED_FOR_MS);
    },
    markFailed(detail = '') {
      clearTimeout(this.outcomeTimer);
      this.outcomeDetail = detail;
      this.outcome = 'failed';
    },
  },
};
