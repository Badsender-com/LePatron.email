import { CHECKS } from '~/helpers/constants/quality-checks.js';
import { exceptionParts } from '~/helpers/quality-exceptions.js';

// The state most checks have when nothing is set: the empty general settings
// name only the checks that start in another one.
const USUAL_STATE = 'on';

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

    // "0,5" in French, "1 024" too: the numbers the pages show, never the
    // ones the fields hold.
    formatNumber(value) {
      return Number(value).toLocaleString(this.$i18n.locale);
    },

    // "Objet : Bloquant", "Subject: Blocking": the punctuation is the
    // language's.
    labelValue(label, value) {
      return this.$t('qualitySettings.labelValue', { label, value });
    },

    // The short name of a threshold ("info", "GIF"), or '' for a check with
    // a single one.
    thresholdShort(id, name) {
      const key = `qualitySettings.thresholdsShort.${id}.${name}`;
      return this.$te(key) ? this.$t(key) : '';
    },

    // "40 caractères"
    thresholdValue(id, name, value) {
      return `${this.formatNumber(value)} ${this.unitName(id, name)}`;
    },

    // { value, unit, level } of one threshold, for the blocking sentences.
    levelParams(id, thresholds, name) {
      return {
        value: this.formatNumber(thresholds[name]),
        unit: this.unitName(id, name),
        level: this.thresholdShort(id, name),
      };
    },

    // "Au-delà de 40 caractères (info), le résultat s'affiche sans bloquer.":
    // the level under the one that blocks, said only when it starts below it.
    // Brought up to it (a template's 50/50), it shows nothing on its own.
    lowerShownText(id, thresholds, blockingName) {
      const [pair] = CHECKS[id].ordered || [];
      if (!pair || pair[1] !== blockingName) return '';
      if (!(thresholds[pair[0]] < thresholds[blockingName])) return '';
      return this.$t(
        'qualitySettings.card.lowerShown',
        this.levelParams(id, thresholds, pair[0])
      );
    },

    // "Actif · info 40 caractères · avertissement 60 caractères"
    appliedText(id, applied) {
      const parts = [this.stateName(applied.state)];
      if (applied.state !== 'off') {
        Object.entries(applied.thresholds).forEach(([name, value]) => {
          const short =
            this.thresholdShort(id, name) ||
            this.$t('qualitySettings.thresholdsShort.default');
          parts.push(`${short} ${this.thresholdValue(id, name, value)}`);
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
            return this.labelValue(name, this.stateName(part.state));
          }
          const short = this.thresholdShort(id, part.name);
          const label = short ? `${name} (${short})` : name;
          return this.labelValue(
            label,
            this.thresholdValue(id, part.name, part.value)
          );
        })
        .join(' · ');
    },

    // "Tous sont actifs, sauf « Paramètres de tracking obligatoires »,
    // bloquant.", from the catalogue's default states.
    defaultStatesText() {
      const others = Object.keys(CHECKS)
        .filter((id) => CHECKS[id].defaultState !== USUAL_STATE)
        .map((id) =>
          this.$t('qualitySettings.general.defaultStateOf', {
            name: this.checkName(id),
            state: this.stateName(CHECKS[id].defaultState).toLocaleLowerCase(
              this.$i18n.locale
            ),
          })
        );
      if (!others.length) {
        return this.$t('qualitySettings.general.emptyDetailAll');
      }
      return this.$t('qualitySettings.general.emptyDetail', {
        others: new Intl.ListFormat(this.$i18n.locale, {
          type: 'conjunction',
        }).format(others),
      });
    },
  },
};
