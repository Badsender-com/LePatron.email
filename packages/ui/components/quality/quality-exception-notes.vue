<script>
import { Lock } from 'lucide-vue';
import { GMAIL_CLIPPING_BYTES } from '../../../shared/quality/limits.js';
import {
  GENERAL,
  blocksFrom,
  hasNote,
  isServerCheck,
} from '~/helpers/quality-exceptions.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';

const BYTES_PER_KB = 1024;
// The checks whose run has the server download the images: only then does
// it read the type of an image whose address names none (the editor's
// resources.js, ADR 0009).
const IMAGE_READING_CHECKS = [
  'image-weight',
  'images-total-weight',
  'oversized-images',
];
// The checks that judge the email's metadata: an email without them gives
// them nothing to read.
const METADATA_CHECKS = ['subject', 'preheader'];

// What an exception card says under its header: an exception that changes
// nothing yet, what its state does, and the check's own notes.
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
    // A check of the technical settings this user cannot set: no link to
    // settings they cannot open, and no word of a removal on save, which
    // they cannot make.
    locked: { type: Boolean, default: false },
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
    // What the check's settings may hide: past Gmail's limit, an email is
    // clipped whatever its threshold says; without metadata, a subject
    // check has nothing to judge.
    warnings() {
      if (this.applied.state === 'off') return [];
      const warnings = [];
      const { maxKb } = this.applied.thresholds;
      if (
        this.checkId === 'html-size' &&
        maxKb * BYTES_PER_KB > GMAIL_CLIPPING_BYTES
      ) {
        warnings.push(
          this.$t('qualitySettings.notes.gmailClipping', {
            limit: this.formatNumber(GMAIL_CLIPPING_BYTES / BYTES_PER_KB),
          })
        );
      }
      if (METADATA_CHECKS.includes(this.checkId)) {
        warnings.push(this.$t('qualitySettings.notes.metadata'));
      }
      return warnings;
    },
    trackingRoute() {
      return `/groups/${this.groupId}/settings/tracking`;
    },
    blockingText() {
      const id = this.checkId;
      const parts = [
        this.$t(
          this.isGeneral
            ? 'qualitySettings.card.blocking'
            : 'qualitySettings.card.blockingTemplate'
        ),
      ];
      const from = blocksFrom(id, this.applied.thresholds);
      const { thresholds } = this.applied;
      const fromParams = from && this.levelParams(id, thresholds, from.name);
      // A server check says where it blocks in its own cases.
      if (from && !isServerCheck(id)) {
        parts.push(this.$t('qualitySettings.card.blocksFrom', fromParams));
      }
      if (isServerCheck(id)) {
        parts.push(
          this.$t('qualitySettings.card.blocksOn', {
            cases: this.$t(`qualitySettings.blocksOn.${id}`, fromParams || {}),
          })
        );
      }
      const lower = from && this.lowerShownText(id, thresholds, from.name);
      if (lower) parts.push(lower);
      if (isServerCheck(id)) {
        parts.push(
          this.$t(`qualitySettings.unverifiable.${id}`),
          this.$t('qualitySettings.serverWait')
        );
      }
      if (id === 'unsupported-image-formats') {
        parts.push(this.unnamedImagesText());
      }
      return parts.join(' ');
    },
  },
  methods: {
    // The card knows the settings of its own check only: the condition on
    // the image checks is said, not checked.
    unnamedImagesText() {
      return this.$t('qualitySettings.notes.unnamedImages', {
        checks: new Intl.ListFormat(this.$i18n.locale, {
          type: 'disjunction',
        }).format(IMAGE_READING_CHECKS.map((id) => this.checkName(id))),
      });
    },
  },
};
</script>

<template>
  <div class="qx-notes">
    <p
      v-if="changesNothing && !locked"
      class="qx-notes__unchanged"
      role="status"
    >
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
    <p v-for="warning in warnings" :key="warning" class="qx-notes__note">
      {{ warning }}
    </p>
    <p v-if="note" class="qx-notes__note">
      {{ note }}
      <nuxt-link
        v-if="checkId === 'tracking-params' && !locked"
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
