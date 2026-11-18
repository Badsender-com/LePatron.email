<script>
import { EyeOff, Lock } from 'lucide-vue';
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import { exceptionsOf, generalOf } from '~/helpers/quality-exceptions.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';

const CATALOGUE_ORDER = Object.keys(CHECKS);

// On a template's page, the general exceptions it applies: those it does not
// replace with its own.
export default {
  name: 'BsQualityAppliedGeneral',
  components: { EyeOff, Lock },
  mixins: [mixinQualityTexts],
  props: {
    // The group's `qualitySettings`.
    generalSettings: { type: Object, default: null },
    // The checks the template sets, as edited (saved or not).
    ownIds: { type: Array, default: () => [] },
    // The general settings' page.
    qualityRoute: { type: String, required: true },
  },
  computed: {
    // The general exceptions this template does not replace, as edited.
    appliedGeneral() {
      const general = exceptionsOf(this.generalSettings);
      const applied = generalOf(this.generalSettings);
      return CATALOGUE_ORDER.filter(
        (id) => general[id] && !this.ownIds.includes(id)
      ).map((id) => ({
        id,
        state: applied[id].state,
        text: this.appliedText(id, applied[id]),
      }));
    },
  },
};
</script>

<template>
  <section class="applied">
    <h2 class="applied__title">
      {{ $t('qualitySettings.template.applied') }}
    </h2>
    <i18n
      v-if="appliedGeneral.length"
      path="qualitySettings.template.appliedFrom"
      tag="p"
      class="applied__intro"
    >
      <template #link>
        <nuxt-link
          :to="qualityRoute"
          v-text="$t('qualitySettings.template.appliedFromLink')"
        />
      </template>
    </i18n>
    <p v-else class="applied__intro">
      {{ $t('qualitySettings.template.appliedNone') }}
      <nuxt-link :to="qualityRoute">
        {{ $t('qualitySettings.template.appliedLink') }}
      </nuxt-link>
    </p>
    <ul v-if="appliedGeneral.length" class="applied__list">
      <li v-for="item in appliedGeneral" :key="item.id">
        <span class="applied__name">{{ checkName(item.id) }}</span>
        <span class="applied__text">
          <lock
            v-if="item.state === 'blocking'"
            :size="14"
            class="applied__icon applied__icon--error"
          />
          <eye-off
            v-else-if="item.state === 'off'"
            :size="14"
            class="applied__icon"
          />
          {{ item.text }}
        </span>
      </li>
    </ul>
  </section>
</template>

<style lang="scss" scoped>
.applied {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--gray-300);

  &__title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--gray-900);
    margin: 0 0 8px;
  }

  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
    border: 1px solid var(--gray-300);
    border-radius: 8px;

    li {
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      gap: 4px 16px;
      padding: 14px 16px;
      font-size: 0.875rem;

      & + li {
        border-top: 1px solid var(--gray-300);
      }
    }
  }

  &__name {
    color: var(--gray-900);
  }

  &__text,
  &__intro {
    color: var(--gray-700);
    font-size: 0.875rem;
  }

  &__intro {
    margin: 0 0 12px;

    a {
      color: var(--v-accent-base);
    }
  }

  &__text {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  &__icon--error {
    color: var(--v-error-base);
  }
}
</style>
