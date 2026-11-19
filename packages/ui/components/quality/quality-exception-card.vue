<script>
import { EyeOff, Lock, Trash2 } from 'lucide-vue';
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import {
  GENERAL,
  adjustmentsOf,
  effectiveOf,
  isEmptyException,
  matchesBase,
  valuesEqualToBase,
  sameException,
  hasNote,
} from '~/helpers/quality-exceptions.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import BsQualityExceptionCardHeader from '~/components/quality/quality-exception-card-header.vue';
import BsQualityExceptionInheritance from '~/components/quality/quality-exception-inheritance.vue';
import BsQualityExceptionNotes from '~/components/quality/quality-exception-notes.vue';
import BsQualityThresholdField from '~/components/quality/quality-threshold-field.vue';

const STATES = ['off', 'on', 'blocking'];

// One exception: a check whose state or thresholds differ from what applies
// below it (the recommended values, or the general settings on a template).
export default {
  name: 'BsQualityExceptionCard',
  components: {
    BsQualityExceptionCardHeader,
    BsQualityExceptionInheritance,
    BsQualityExceptionNotes,
    BsQualityThresholdField,
    EyeOff,
    Lock,
    Trash2,
  },
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
    // In the general settings, the names of the templates that keep their
    // own value of what this unsaved change sets.
    keptBy: { type: Array, default: () => [] },
    groupId: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    // A check of the technical settings, which this user cannot set.
    locked: { type: Boolean, default: false },
  },
  computed: {
    states() {
      return STATES;
    },
    // On a template, as the server resolves it: its own threshold wins over
    // an inherited one it contradicts.
    applied() {
      return effectiveOf(
        this.exception,
        this.base,
        this.isGeneral ? null : this.checkId
      );
    },
    adjustments() {
      if (this.isGeneral || this.applied.state === 'off') return [];
      return adjustmentsOf(this.checkId, this.exception, this.base);
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
    // In the general settings, a value equal to the recommended one is
    // dropped on save; on a template it is kept, so only an exception that
    // sets nothing changes nothing.
    changesNothing() {
      return this.isGeneral
        ? matchesBase(this.exception, this.base)
        : isEmptyException(this.exception);
    },
    // A template's values equal to the general ones: kept, but they no
    // longer follow the general settings.
    equalToGeneral() {
      return this.isGeneral
        ? 0
        : valuesEqualToBase(this.exception, this.base).length;
    },
    showThresholds() {
      return this.thresholdNames.length > 0 && this.applied.state !== 'off';
    },
    hasBody() {
      return (
        this.showThresholds ||
        this.adjustments.length > 0 ||
        this.equalToGeneral > 0 ||
        this.keptBy.length > 0 ||
        this.changesNothing ||
        this.applied.state !== 'on' ||
        hasNote(this.checkId)
      );
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
  <v-card
    outlined
    class="qx-card"
    :class="{ 'qx-card--new': isNew }"
    :data-exception="checkId"
  >
    <div class="qx-card__head">
      <bs-quality-exception-card-header
        :check-id="checkId"
        :level="level"
        :exception="exception"
        :is-new="isNew"
        :is-dirty="isDirty"
        :base-text="baseText"
        :disabled="disabled"
        :locked="locked"
        @restore-state="$emit('restore-state')"
      />
      <div class="qx-card__controls">
        <v-btn-toggle
          :value="applied.state"
          mandatory
          dense
          role="group"
          :aria-label="
            labelValue($t('qualitySettings.stateLabel'), checkName(checkId))
          "
          :color="applied.state === 'blocking' ? 'error' : 'accent'"
          @change="$emit('state', $event)"
        >
          <v-btn
            v-for="state in states"
            :key="state"
            :value="state"
            :disabled="disabled || locked"
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
        <v-tooltip v-if="!locked" bottom>
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

    <div v-if="hasBody" class="qx-card__body">
      <bs-quality-exception-notes
        :check-id="checkId"
        :level="level"
        :applied="applied"
        :changes-nothing="changesNothing"
        :group-id="groupId"
        :locked="locked"
      />
      <bs-quality-exception-inheritance
        :check-id="checkId"
        :adjustments="adjustments"
        :equal-count="equalToGeneral"
        :kept-by="keptBy"
      />
      <div v-if="showThresholds" class="qx-card__thresholds">
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
          :disabled="disabled || locked"
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
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px 16px;
    padding: 12px 16px;
  }

  &--new {
    border-color: var(--v-accent-base) !important;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 4px;

    ::v-deep .v-btn-toggle .v-btn {
      height: 32px !important;
    }
  }

  &__icon {
    margin-right: 4px;
    vertical-align: -2px;

    &--error {
      color: var(--v-error-base);
    }
  }

  &__body {
    padding: 0 16px 14px;
    font-size: 0.875rem;
    color: var(--gray-900);

    p {
      margin: 0 0 4px;
    }
  }

  &__thresholds {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 15px;
    margin-top: 16px;
  }
}
</style>
