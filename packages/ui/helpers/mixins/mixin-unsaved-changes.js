// Asks before leaving a page with unsaved changes: another route, a reload or
// a closed tab. The page sets `unsavedChanges` and renders a BsModalConfirm
// with ref "leaveModal" wired to `confirmLeave` and `cancelLeave`.
export default {
  data() {
    return { unsavedChanges: 0, pendingLeave: null };
  },
  beforeRouteLeave(to, from, next) {
    if (!this.unsavedChanges) return next();
    this.askToLeave(
      () => next(),
      () => next(false)
    );
  },
  mounted() {
    window.addEventListener('beforeunload', this.warnBeforeUnload);
  },
  beforeDestroy() {
    window.removeEventListener('beforeunload', this.warnBeforeUnload);
  },
  methods: {
    warnBeforeUnload(event) {
      if (!this.unsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    },

    askToLeave(leave, stay = () => {}) {
      this.pendingLeave = { leave, stay };
      this.$refs.leaveModal.open();
    },

    confirmLeave() {
      const pending = this.pendingLeave;
      this.pendingLeave = null;
      if (pending) pending.leave();
    },

    // The modal closes before it confirms: staying waits a tick, so a
    // confirmation that follows wins.
    cancelLeave() {
      setTimeout(() => {
        const pending = this.pendingLeave;
        this.pendingLeave = null;
        if (pending) pending.stay();
      }, 0);
    },
  },
};
