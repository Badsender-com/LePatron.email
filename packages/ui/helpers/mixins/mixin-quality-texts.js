import { CHECKS } from '~/helpers/constants/quality-checks.js';
import { exceptionParts } from '~/helpers/quality-exceptions.js';

// How the "Contrôle qualité" pages say a check, a state or a threshold.
export default {
  methods: {
    checkName(id) {
      return this.$t(`qualitySettings.checks.${id}`);
    },

    categoryName(id) {
      return this.$t(`qualitySettings.categories.${CHECKS[id].category}`);
    },

    stateName(state) {
      return this.$t(`qualitySettings.states.${state}`);
    },

    unitName(id, name) {
      return this.$t(
        `qualitySettings.units.${CHECKS[id].thresholds[name].unit}`
      );
    },

    // The short name of a threshold ("info", "GIF"), or '' for a check with
    // a single one.
    thresholdShort(id, name) {
      const key = `qualitySettings.thresholdsShort.${id}.${name}`;
      return this.$te(key) ? this.$t(key) : '';
    },

    // "Actif · info 40 caractères · avertissement 60 caractères"
    appliedText(id, applied) {
      const parts = [this.stateName(applied.state)];
      if (applied.state !== 'off') {
        Object.entries(applied.thresholds).forEach(([name, value]) => {
          const short =
            this.thresholdShort(id, name) ||
            this.$t('qualitySettings.thresholdsShort.default');
          parts.push(`${short} ${value} ${this.unitName(id, name)}`);
        });
      }
      return parts.join(' · ');
    },

    // "Objet : Bloquant · Objet (avertissement) : 80 caractères"
    exceptionSummary(id, exception) {
      const name = this.checkName(id);
      return exceptionParts(id, exception)
        .map((part) => {
          if (part.kind === 'state') {
            return `${name} : ${this.stateName(part.state)}`;
          }
          const short = this.thresholdShort(id, part.name);
          const label = short ? `${name} (${short})` : name;
          return `${label} : ${part.value} ${this.unitName(id, part.name)}`;
        })
        .join(' · ');
    },
  },
};
