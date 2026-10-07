<script>
import { mapMutations } from 'vuex';
import isEqual from 'lodash/isEqual';
import { templatesItemQualitySettings } from '~/helpers/api-routes.js';
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import {
  statesOf,
  thresholdsOf,
  thresholdErrors,
  orderErrors,
  overridesOf,
  overridesPayload,
  checksByCategory,
  qualitySettingsErrorKeyFor,
} from '~/helpers/quality-settings.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import BsTextField from '~/components/form/bs-text-field.vue';

// A template's overrides of its group's quality settings
// (docs/adr/0004-quality-settings-per-group-and-template.md): each setting is
// either inherited from the group, shown as such, or set on the template.
const OFFERED_STATES = ['off', 'on'];
const INHERITED = 'inherited';

export default {
  name: 'BsTemplateQualitySettings',
  components: { BsTextField },
  props: {
    template: { type: Object, required: true },
    // The group's own settings, as stored: what an inherited value is.
    groupSettings: { type: Object, default: null },
  },
  data() {
    return {
      states: {},
      thresholds: {},
      loading: false,
    };
  },
  computed: {
    categories() {
      return checksByCategory();
    },
    groupStates() {
      return statesOf(this.groupSettings);
    },
    groupThresholds() {
      return thresholdsOf(this.groupSettings);
    },
    saved() {
      return overridesOf(this.template.qualitySettings);
    },
    hasUnsavedChanges() {
      return (
        !isEqual(this.states, this.saved.states) ||
        !isEqual(this.normalized(this.thresholds), this.saved.thresholds)
      );
    },
    invalidThresholds() {
      return thresholdErrors(this.thresholds).concat(this.misordered);
    },
    misordered() {
      return orderErrors(this.thresholds, this.groupThresholds);
    },
  },
  watch: {
    template: {
      immediate: true,
      handler(template) {
        const { states, thresholds } = overridesOf(
          template && template.qualitySettings
        );
        this.states = states;
        this.thresholds = thresholds;
      },
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    stateOptions(id) {
      const options = [
        {
          value: INHERITED,
          text: this.$t('qualitySettings.inheritedState', {
            state: this.$t(`qualitySettings.states.${this.groupStates[id]}`),
          }),
        },
      ];
      const offered = OFFERED_STATES.includes(this.states[id])
        ? OFFERED_STATES
        : OFFERED_STATES.concat(this.states[id] || []);
      offered.forEach((state) =>
        options.push({
          value: state,
          text: this.$t(`qualitySettings.states.${state}`),
        })
      );
      return options;
    },

    effectiveState(id) {
      return this.states[id] || this.groupStates[id];
    },

    groupValue(id, name) {
      const value = this.groupThresholds[id] && this.groupThresholds[id][name];
      return value === null || value === undefined
        ? CHECKS[id].thresholds[name].default
        : value;
    },

    thresholdsFor(id) {
      return Object.entries(CHECKS[id].thresholds).map(([name, threshold]) => ({
        name,
        ...threshold,
      }));
    },

    normalized(thresholds) {
      return Object.fromEntries(
        Object.entries(thresholds).map(([id, values]) => [
          id,
          Object.fromEntries(
            Object.entries(values).map(([name, value]) => [
              name,
              value === '' || value === null ? null : Number(value),
            ])
          ),
        ])
      );
    },

    isInvalid(id, name) {
      return this.invalidThresholds.includes(`${id}.${name}`);
    },

    errorFor(id, threshold) {
      if (!this.isInvalid(id, threshold.name)) return [];
      if (this.misordered.includes(`${id}.${threshold.name}`)) {
        return [this.$t('qualitySettings.orderError')];
      }
      return [
        this.$t('qualitySettings.thresholdError', {
          min: threshold.min,
          max: threshold.max,
        }),
      ];
    },

    selectedState(id) {
      return this.states[id] || INHERITED;
    },

    onStateChange(id, value) {
      this.states = {
        ...this.states,
        [id]: value === INHERITED ? null : value,
      };
    },

    onThresholdChange(id, name, value) {
      this.thresholds = {
        ...this.thresholds,
        [id]: { ...this.thresholds[id], [name]: value === '' ? null : value },
      };
    },

    async onSubmit() {
      this.loading = true;
      try {
        await this.$axios.$put(
          templatesItemQualitySettings({ templateId: this.template.id }),
          overridesPayload(this.states, this.normalized(this.thresholds))
        );
        this.showSnackbar({
          text: this.$t('qualitySettings.snackbars.updated'),
          color: 'success',
        });
        this.$emit('update');
      } catch (error) {
        this.showSnackbar({
          text: this.$t(qualitySettingsErrorKeyFor(error)),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <div class="template-quality">
    <div
      v-for="{ category, ids } in categories"
      :key="category"
      class="template-quality__category"
    >
      <h4 class="template-quality__category-title">
        {{ $t(`qualitySettings.categories.${category}`) }}
      </h4>
      <div
        v-for="id in ids"
        :key="id"
        class="template-quality__item"
        :data-template-check="id"
      >
        <div class="template-quality__check">
          <span class="template-quality__label">
            {{ $t(`qualitySettings.checks.${id}`) }}
            <span
              v-if="states[id]"
              class="template-quality__own"
              :title="$t('qualitySettings.ownSetting')"
            >
              {{ $t('qualitySettings.ownSetting') }}
            </span>
          </span>
          <v-select
            :value="selectedState(id)"
            :items="stateOptions(id)"
            :disabled="loading"
            :aria-label="`${$t('qualitySettings.stateLabel')} : ${$t(
              `qualitySettings.checks.${id}`
            )}`"
            dense
            outlined
            hide-details
            class="template-quality__state"
            @change="onStateChange(id, $event)"
          />
        </div>
        <div
          v-if="thresholdsFor(id).length && effectiveState(id) !== 'off'"
          class="template-quality__thresholds"
        >
          <bs-text-field
            v-for="threshold in thresholdsFor(id)"
            :key="threshold.name"
            :value="thresholds[id][threshold.name]"
            :label="$t(`qualitySettings.thresholds.${id}.${threshold.name}`)"
            :placeholder="String(groupValue(id, threshold.name))"
            :suffix="$t(`qualitySettings.units.${threshold.unit}`)"
            :hint="
              thresholds[id][threshold.name] === null
                ? $t('qualitySettings.inheritedValue', {
                    value: groupValue(id, threshold.name),
                  })
                : $t('qualitySettings.ownSetting')
            "
            :error-messages="errorFor(id, threshold)"
            :disabled="loading"
            type="number"
            :step="threshold.unit === 'ratio' ? 0.1 : 1"
            persistent-hint
            dense
            class="template-quality__threshold"
            @input="onThresholdChange(id, threshold.name, $event)"
          />
        </div>
      </div>
    </div>

    <div class="template-quality__actions">
      <v-btn
        color="accent"
        elevation="0"
        :loading="loading"
        :disabled="
          loading || !hasUnsavedChanges || invalidThresholds.length > 0
        "
        @click="onSubmit"
      >
        {{ $t('global.save') }}
      </v-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.template-quality {
  &__category + &__category {
    margin-top: 1.25rem;
  }

  &__category-title {
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--gray-700);
    margin: 0 0 0.5rem 0;
  }

  &__item {
    padding: 0.375rem 0;
    border-bottom: 1px solid var(--gray-200);
  }

  &__check {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__label {
    font-size: 0.875rem;
    color: var(--gray-900);
  }

  &__own {
    margin-left: 0.5rem;
    font-size: 0.75rem;
    color: var(--v-accent-base, #00acdc);
  }

  &__state {
    flex: 0 0 19rem;
  }

  &__thresholds {
    display: flex;
    flex-wrap: wrap;
    gap: 0 1rem;
    margin: 0.25rem 0 0.5rem 0;
  }

  &__threshold {
    flex: 1 1 14rem;
    max-width: 22rem;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
  }
}
</style>
