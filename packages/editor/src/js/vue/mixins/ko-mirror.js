'use strict';

/**
 * The bridge from Knockout to Vue (ADR 0020). Vue cannot observe a Knockout
 * observable: `mirror` reads it at once, then on each of its notifications,
 * and the subscriptions end with the component.
 *
 * Knockout notifies on every write of an object, even the same one, where a
 * Vue `watch` only sees a new reference: a side effect of a change goes in
 * `onChange`, which is called on notifications only, never on the first read.
 */
module.exports = {
  beforeDestroy() {
    (this.$_koMirror_subscriptions || []).forEach((subscription) =>
      subscription.dispose()
    );
    this.$_koMirror_subscriptions = [];
  },
  methods: {
    /**
     * @param {Function} observable - a Knockout observable, or a plain getter
     *   read once; nothing when missing
     * @param {Function} assign - receives the value, at once and on change
     * @param {Function} [onChange] - receives the value on change only
     */
    mirror(observable, assign, onChange) {
      // A late callback after the component went: nothing left to update.
      if (!observable || this._isDestroyed) return;
      assign(observable());
      if (typeof observable.subscribe !== 'function') return;
      if (!this.$_koMirror_subscriptions) this.$_koMirror_subscriptions = [];
      this.$_koMirror_subscriptions.push(
        observable.subscribe((value) => {
          assign(value);
          if (onChange) onChange(value);
        })
      );
    },
  },
};
