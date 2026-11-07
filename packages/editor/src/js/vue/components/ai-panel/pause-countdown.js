'use strict';

/**
 * The seconds left of a pause on the AI's usage limit, counted down in the
 * analysis's progress banner (README of the boards: « pause sur quota »).
 * The session says how long it waits (`state.pausedFor`) and clears it when
 * it resumes; this only shows the time passing, said once to screen readers.
 */
const pauseCountdown = {
  data: () => ({ pauseLeft: null }),
  watch: {
    'state.pausedFor': {
      immediate: true,
      handler(seconds) {
        this.stopPauseCountdown();
        if (!seconds) return;
        this.$emit('announce', this.t('ai-panel-correction-paused', { seconds }));
        this.pauseLeft = seconds;
        this.pauseTimer = setInterval(() => {
          // Never 0 while still paused: the session resumes on its own clock.
          this.pauseLeft = Math.max(1, this.pauseLeft - 1);
        }, 1000);
      },
    },
  },
  beforeDestroy() {
    this.stopPauseCountdown();
  },
  methods: {
    stopPauseCountdown() {
      if (this.pauseTimer) clearInterval(this.pauseTimer);
      this.pauseTimer = null;
      this.pauseLeft = null;
    },
  },
};

module.exports = { pauseCountdown };
