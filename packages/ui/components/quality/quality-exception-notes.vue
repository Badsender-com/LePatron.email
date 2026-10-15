<script>
import { Lock } from 'lucide-vue';
import {
  GENERAL,
  blocksFrom,
  hasNote,
  isServerCheck,
} from '~/helpers/quality-exceptions.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';

// What an exception card says under its header: an exception that changes
// nothing yet, what its state does, and the check's own note.
export default {
  name: 'BsQualityExceptionNotes',
  components: { Lock },
  mixins: [mixinQualityTexts],
  props: {
    checkId: { type: String, required: true },
    level: { type: String, required: true },
    // What applies with the exception: { state, thresholds }.
    applied: { type: Object, required: true },
    changesNothing: { type: Boolean, default: false },
    groupId: { type: String, default: '' },
  },
  computed: {
    isGeneral() {
      return this.level === GENERAL;
    },
    note() {
      return hasNote(this.checkId)
        ? this.$t(`qualitySettings.notes.${this.checkId}`)
        : '';
    },
    trackingRoute() {
      return `/groups/${this.groupId}/settings/tracking`;
    },
    blockingText() {
      const parts = [
        this.$t(
          this.isGeneral
            ? 'qualitySettings.card.blocking'
            : 'qualitySettings.card.blockingTemplate'
        ),
      ];
      const from = blocksFrom(this.checkId, this.applied.thresholds);
      if (from) {
        parts.push(
          this.$t('qualitySettings.card.blocksFrom', {
            value: from.value,
            unit: this.unitName(this.checkId, from.name),
            level: this.thresholdShort(this.checkId, from.name),
          })
        );
      }
      if (isServerCheck(this.checkId)) {
        parts.push(
          this.$t('qualitySettings.card.blocksOn', {
            cases: this.$t(`qualitySettings.blocksOn.${this.checkId}`),
          }),
          this.$t('qualitySettings.serverWait')
        );
      }
      return parts.join(' ');
    },
  },
};
</script>

<template>
  <div class="qx-notes">
    <p v-if="changesNothing" class="qx-notes__unchanged" role="status">
      {{
        isGeneral
          ? $t('qualitySettings.card.unchangedGeneral')
          : $t('qualitySettings.card.unchangedTemplate')
      }}
    </p>
    <p v-if="applied.state === 'off'">{{ $t('qualitySettings.card.off') }}</p>
    <p v-if="applied.state === 'blocking'" class="qx-notes__blocking">
      <lock :size="14" class="qx-notes__lock" />
      <span>{{ blockingText }}</span>
    </p>
    <p v-if="note" class="qx-notes__note">
      {{ note }}
      <nuxt-link
        v-if="checkId === 'tracking-params'"
        :to="trackingRoute"
        v-text="$t('qualitySettings.notes.trackingLink')"
      />
    </p>
  </div>
</template>

<style lang="scss" scoped>
.qx-notes {
  p {
    margin: 0 0 4px;
  }

  &__unchanged {
    padding: 8px 12px;
    border-radius: 4px;
    background: var(--surface-muted, #f5f5f5);
  }

  &__blocking {
    display: flex;
    gap: 6px;
    align-items: flex-start;
  }

  &__lock {
    flex: 0 0 14px;
    margin-top: 2px;
    color: var(--v-error-base);
  }

  &__note {
    color: var(--gray-700);

    a {
      color: var(--v-accent-base);
    }
  }
}
</style>
