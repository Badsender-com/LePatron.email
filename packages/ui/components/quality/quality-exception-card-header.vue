<script>
import { GENERAL, isServerCheck } from '~/helpers/quality-exceptions.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import BsQualityUnsavedChip from '~/components/quality/quality-unsaved-chip.vue';

// The heading of an exception card: the check, its chips, what applies
// below it and, on a template, where its state comes from.
export default {
  name: 'BsQualityExceptionCardHeader',
  components: { BsQualityUnsavedChip },
  mixins: [mixinQualityTexts],
  props: {
    checkId: { type: String, required: true },
    level: { type: String, required: true },
    // The exception as edited.
    exception: { type: Object, required: true },
    // Not saved yet: a new exception, or a changed one.
    isNew: { type: Boolean, default: false },
    isDirty: { type: Boolean, default: false },
    // "Réglage général : …", on a template only.
    baseText: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    // A check of the technical settings, which this user cannot set.
    locked: { type: Boolean, default: false },
  },
  computed: {
    isGeneral() {
      return this.level === GENERAL;
    },
    ownState() {
      return !this.isGeneral && Boolean(this.exception.state);
    },
    isServer() {
      return isServerCheck(this.checkId);
    },
    onlineTipId() {
      return `qx-online-tip-${this.checkId}`;
    },
  },
};
</script>

<template>
  <div class="qx-card-header">
    <div class="qx-card-header__title">
      <span class="qx-card-header__name">{{ checkName(checkId) }}</span>
      <span class="qx-card-header__category">{{ categoryName(checkId) }}</span>
      <v-tooltip v-if="isServer" bottom max-width="320">
        <template #activator="{ on, attrs }">
          <v-chip
            x-small
            outlined
            tabindex="0"
            :aria-describedby="onlineTipId"
            v-bind="attrs"
            v-on="on"
          >
            {{ $t('qualitySettings.card.online') }}
          </v-chip>
        </template>
        {{ $t('qualitySettings.card.onlineTip') }}
      </v-tooltip>
      <!-- The tooltip is only rendered once open: what a screen reader
           reads on focus lives here. -->
      <span v-if="isServer" :id="onlineTipId" class="d-sr-only">
        {{ $t('qualitySettings.card.onlineTip') }}
      </span>
      <bs-quality-unsaved-chip
        v-if="isDirty"
        :label="
          isNew
            ? $t('qualitySettings.card.new')
            : $t('qualitySettings.card.unsaved')
        "
      />
    </div>
    <p v-if="baseText" class="qx-card-header__base">{{ baseText }}</p>
    <p v-if="locked" class="qx-card-header__base">
      {{ $t('qualitySettings.card.techOnly') }}
    </p>
    <p v-if="!isGeneral" class="qx-card-header__base">
      {{
        ownState
          ? $t('qualitySettings.page.stateOwn')
          : $t('qualitySettings.page.stateGeneral')
      }}
      <v-btn
        v-if="ownState && !locked"
        x-small
        text
        color="accent"
        class="qx-card-header__restore"
        :disabled="disabled"
        @click="$emit('restore-state')"
      >
        {{ $t('qualitySettings.page.restoreState') }}
      </v-btn>
    </p>
  </div>
</template>

<style lang="scss" scoped>
.qx-card-header {
  min-width: 0;

  &__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    min-width: 0;
  }

  &__name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--gray-900);
  }

  &__category {
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  &__base {
    margin: 2px 0 0;
    font-size: 0.75rem;
    color: var(--gray-700);
  }

  &__restore {
    margin-left: 4px;
    text-transform: none;
    letter-spacing: normal;
  }
}
</style>
