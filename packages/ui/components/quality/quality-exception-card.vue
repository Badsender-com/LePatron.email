<script>
import { EyeOff, Lock, Trash2 } from 'lucide-vue';
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import {
  GENERAL,
  effectiveOf,
  matchesBase,
  sameException,
  blocksFrom,
  isServerCheck,
} from '~/helpers/quality-exceptions.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import BsQualityThresholdField from '~/components/quality/quality-threshold-field.vue';

const STATES = ['off', 'on', 'blocking'];
const NOTES = ['tracking-params', 'domain-blocklists', 'dangerous-links'];

// One exception: a check whose state or thresholds differ from what applies
// below it (the recommended values, or the general settings on a template).
export default {
  name: 'BsQualityExceptionCard',
  components: { BsQualityThresholdField, EyeOff, Lock, Trash2 },
  mixins: [mixinQualityTexts],
  props: {
    checkId: { type: String, required: true },
    level: { type: String, required: true },
    // The exception as edited, and as stored (null when it is new).
    exception: { type: Object, required: true },
    saved: { type: Object, default: null },
    // What applies below it: { state, thresholds }.
    base: { type: Object, required: true },
    // "Réglage général : …", on a template only.
    baseText: { type: String, default: '' },
    errors: { type: Object, default: () => ({}) },
    groupId: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  computed: {
    states() {
      return STATES;
    },
    applied() {
      return effectiveOf(this.exception, this.base);
    },
    isGeneral() {
      return this.level === GENERAL;
    },
    isNew() {
      return !this.saved;
    },
    isDirty() {
      return !sameException(this.exception, this.saved);
    },
    changesNothing() {
      return matchesBase(this.exception, this.base);
    },
    isServer() {
      return isServerCheck(this.checkId);
    },
    note() {
      if (this.checkId === 'color-contrast' || NOTES.includes(this.checkId)) {
        return this.$t(`qualitySettings.notes.${this.checkId}`);
      }
      return '';
    },
    trackingRoute() {
      return `/groups/${this.groupId}/settings/tracking`;
    },
    blocksFromText() {
      const from = blocksFrom(this.checkId, this.applied.thresholds);
      if (!from) return '';
      return this.$t('qualitySettings.card.blocksFrom', {
        label: this.$t(
          `qualitySettings.thresholds.${this.checkId}.${from.name}`
        ),
        value: from.value,
        unit: this.unitName(this.checkId, from.name),
      });
    },
    thresholdNames() {
      return Object.keys(CHECKS[this.checkId].thresholds);
    },
    removeLabel() {
      return this.$t(
        this.isGeneral
          ? 'qualitySettings.card.removeGeneral'
          : 'qualitySettings.card.removeTemplate'
      );
    },
  },
};
</script>

<template>
  <v-card outlined class="qx-card" :data-exception="checkId">
    <div class="qx-card__head">
      <div class="qx-card__title">
        <span class="qx-card__name">{{ checkName(checkId) }}</span>
        <span class="qx-card__category">{{ categoryName(checkId) }}</span>
        <v-tooltip v-if="isServer" bottom max-width="320">
          <template #activator="{ on, attrs }">
            <v-chip x-small outlined v-bind="attrs" v-on="on">
              {{ $t('qualitySettings.card.online') }}
            </v-chip>
          </template>
          {{ $t('qualitySettings.card.onlineTip') }}
        </v-tooltip>
        <v-chip v-if="isDirty" x-small color="warning" text-color="black">
          {{
            isNew
              ? $t('qualitySettings.card.new')
              : $t('qualitySettings.card.unsaved')
          }}
        </v-chip>
      </div>
      <div class="qx-card__controls">
        <v-btn-toggle
          :value="applied.state"
          mandatory
          dense
          role="group"
          :aria-label="`${$t('qualitySettings.stateLabel')} : ${checkName(
            checkId
          )}`"
          :color="applied.state === 'blocking' ? 'error' : 'accent'"
          @change="$emit('state', $event)"
        >
          <v-btn
            v-for="state in states"
            :key="state"
            :value="state"
            :disabled="disabled"
            :aria-pressed="applied.state === state ? 'true' : 'false'"
            small
            text
          >
            <eye-off v-if="state === 'off'" :size="14" class="qx-card__icon" />
            <lock
              v-if="state === 'blocking'"
              :size="14"
              class="qx-card__icon"
            />
            {{ stateName(state) }}
          </v-btn>
        </v-btn-toggle>
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              :disabled="disabled"
              :aria-label="removeLabel"
              v-bind="attrs"
              v-on="on"
              @click="$emit('remove')"
            >
              <trash2 :size="16" />
            </v-btn>
          </template>
          {{ removeLabel }}
        </v-tooltip>
      </div>
    </div>

    <div class="qx-card__body">
      <p v-if="baseText" class="qx-card__base">{{ baseText }}</p>
      <p v-if="changesNothing" class="qx-card__unchanged" role="status">
        {{
          isGeneral
            ? $t('qualitySettings.card.unchangedGeneral')
            : $t('qualitySettings.card.unchangedTemplate')
        }}
      </p>
      <p v-if="applied.state === 'off'" class="qx-card__effect">
        {{ $t('qualitySettings.card.off') }}
      </p>
      <div v-if="applied.state === 'blocking'" class="qx-card__effect">
        <p>
          <lock :size="14" class="qx-card__icon qx-card__icon--error" />
          {{ $t('qualitySettings.card.blocking') }}
          {{ blocksFromText }}
        </p>
        <template v-if="isServer">
          <p>
            {{
              $t('qualitySettings.card.blocksOn', {
                cases: $t(`qualitySettings.blocksOn.${checkId}`),
              })
            }}
          </p>
          <p>{{ $t('qualitySettings.serverWait') }}</p>
        </template>
      </div>
      <p v-if="note" class="qx-card__note">
        {{ note }}
        <nuxt-link v-if="checkId === 'tracking-params'" :to="trackingRoute">
          {{ $t('qualitySettings.notes.trackingLink') }}
        </nuxt-link>
      </p>

      <div
        v-if="thresholdNames.length && applied.state !== 'off'"
        class="qx-card__thresholds"
      >
        <bs-quality-threshold-field
          v-for="name in thresholdNames"
          :key="name"
          :check-id="checkId"
          :name="name"
          :value="exception.thresholds[name]"
          :saved-value="saved ? saved.thresholds[name] : null"
          :base-value="base.thresholds[name]"
          :base-is-recommended="isGeneral"
          :error="errors[name] || null"
          :disabled="disabled"
          @input="$emit('threshold', name, $event)"
        />
      </div>
    </div>
  </v-card>
</template>

<style lang="scss" scoped>
.qx-card {
  border-color: var(--gray-300) !important;
  border-radius: 8px !important;

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    padding: 12px 16px;
  }

  &__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    min-width: 0;
  }

  &__name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--gray-900);
  }

  &__category {
    font-size: 0.75rem;
    color: var(--gray-700);
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__icon {
    margin-right: 4px;
    vertical-align: -2px;

    &--error {
      color: var(--v-error-base);
    }
  }

  &__body {
    padding: 0 16px 12px;
    font-size: 0.8125rem;
    color: var(--gray-900);

    p {
      margin: 0 0 4px;
    }
  }

  &__base,
  &__note {
    color: var(--gray-700);
  }

  &__unchanged {
    padding: 8px 12px;
    border-radius: 4px;
    background: var(--surface-muted, #f5f5f5);
  }

  &__thresholds {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    margin-top: 8px;
  }
}
</style>
