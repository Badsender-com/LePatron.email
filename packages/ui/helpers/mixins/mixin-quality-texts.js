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

    // "Objet trop long : avertissement au-delà de 70 caractères"
    thresholdText(id, name, value) {
      return [
        this.$t(`qualitySettings.thresholds.${id}.${name}`),
        value,
        this.unitName(id, name),
      ].join(' ');
    },

    // What an exception sets: "Bloquant · Objet trop long : … 70 caractères"
    exceptionText(id, exception) {
      return exceptionParts(id, exception)
        .map((part) =>
          part.kind === 'state'
            ? this.stateName(part.state)
            : this.thresholdText(id, part.name, part.value)
        )
        .join(' · ');
    },
  },
};
