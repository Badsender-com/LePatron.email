<script>
import { mapMutations } from 'vuex';
import isEqual from 'lodash/isEqual';
import { groupsItem } from '~/helpers/api-routes.js';
import {
  statesOf,
  statesPayload,
  checksByCategory,
  qualitySettingsErrorKeyFor,
} from '~/helpers/quality-settings.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';

// The states this page offers. A state set another way (the API) is still
// shown on its check, so the page never hides what applies.
const OFFERED_STATES = ['off', 'on'];

export default {
  name: 'BsGroupQualitySettingsTab',
  props: {
    group: { type: Object, required: true },
  },
  data() {
    return {
      // Edited copy: a change must not look saved before the server confirms it.
      states: statesOf(null),
      loading: false,
    };
  },
  computed: {
    categories() {
      return checksByCategory();
    },
    savedStates() {
      return statesOf(this.group.qualitySettings);
    },
    hasUnsavedChanges() {
      return !isEqual(this.states, this.savedStates);
    },
  },
  watch: {
    group: {
      immediate: true,
      handler(group) {
        this.states = statesOf(group && group.qualitySettings);
      },
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    statesFor(id) {
      const current = this.states[id];
      return OFFERED_STATES.includes(current)
        ? OFFERED_STATES
        : OFFERED_STATES.concat(current);
    },

    onStateChange(id, state) {
      if (state) this.states = { ...this.states, [id]: state };
    },

    async onSubmit() {
      this.loading = true;
      try {
        // Partial update: only the section this page owns travels.
        await this.$axios.$put(groupsItem({ groupId: this.group.id }), {
          qualitySettings: statesPayload(this.states, this.savedStates),
        });
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
  <div class="quality-settings">
    <section class="settings-section">
      <h3 class="settings-section__title">
        {{ $t('qualitySettings.groupTitle') }}
      </h3>
      <p class="settings-section__description">
        {{ $t('qualitySettings.groupDescription') }}
      </p>

      <div
        v-for="{ category, ids } in categories"
        :key="category"
        class="quality-settings__category"
      >
        <h4 class="quality-settings__category-title">
          {{ $t(`qualitySettings.categories.${category}`) }}
        </h4>
        <div
          v-for="id in ids"
          :key="id"
          class="quality-settings__check"
          :data-check="id"
        >
          <span class="quality-settings__label">
            {{ $t(`qualitySettings.checks.${id}`) }}
          </span>
          <v-btn-toggle
            :value="states[id]"
            mandatory
            dense
            color="accent"
            role="group"
            :aria-label="`${$t('qualitySettings.stateLabel')} : ${$t(
              `qualitySettings.checks.${id}`
            )}`"
            @change="onStateChange(id, $event)"
          >
            <v-btn
              v-for="state in statesFor(id)"
              :key="state"
              :value="state"
              :disabled="loading"
              small
              text
            >
              {{ $t(`qualitySettings.states.${state}`) }}
            </v-btn>
          </v-btn-toggle>
        </div>
      </div>
    </section>

    <div class="settings-actions">
      <v-btn
        color="accent"
        elevation="0"
        :loading="loading"
        :disabled="loading || !hasUnsavedChanges"
        @click="onSubmit"
      >
        {{ $t('global.save') }}
      </v-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-section {
  &__title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--gray-900);
    margin: 0 0 0.25rem 0;
  }

  &__description {
    color: var(--gray-700);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }
}

.quality-settings {
  &__category + &__category {
    margin-top: 1.5rem;
  }

  &__category-title {
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--gray-700);
    margin: 0 0 0.5rem 0;
  }

  &__check {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.375rem 0;
    border-bottom: 1px solid var(--gray-200);
  }

  &__label {
    font-size: 0.875rem;
    color: var(--gray-900);
  }
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-300);
}
</style>
