<script>
// Where an item of a copy comes from (ADR 0019): it follows production, it
// is kept on this copy, it was written on this copy (and the copy has not
// followed production yet, or has), or it is the copy's work, set aside from
// another item, which it links to. Nothing on production.
import { copyOriginOf, COPY_ORIGINS } from '~/helpers/skills-copy.js';
import { itemPath } from '~/helpers/skills-follow.js';

const COLORS = {
  [COPY_ORIGINS.FOLLOWED]: 'accent',
  [COPY_ORIGINS.KEPT]: 'warning',
  [COPY_ORIGINS.LOCAL]: 'grey',
  [COPY_ORIGINS.NOT_FOLLOWED]: 'grey',
  [COPY_ORIGINS.COPIED]: 'secondary',
};

export default {
  name: 'BsAiCopyOriginChip',
  props: {
    // `skill` or `expertise`.
    kind: { type: String, required: true },
    item: { type: Object, default: null },
    isCopy: { type: Boolean, default: false },
    // Whether the copy has completed a follow of production.
    followedOnce: { type: Boolean, default: false },
  },
  computed: {
    origin() {
      return copyOriginOf(this.item, this.isCopy, this.followedOnce);
    },
    color() {
      return COLORS[this.origin];
    },
    originPath() {
      return this.origin === COPY_ORIGINS.COPIED
        ? itemPath(this.kind, this.item.copiedFrom)
        : null;
    },
  },
};
</script>

<template>
  <span v-if="origin" class="bs-ai-copy-origin">
    <v-chip
      x-small
      outlined
      :color="color"
      :class="`bs-ai-copy-origin__chip bs-ai-copy-origin__chip--${origin}`"
      :title="$t(`aiSkills.copy.origins.${origin}Hint`)"
    >
      {{ $t(`aiSkills.copy.origins.${origin}`) }}
    </v-chip>
    <nuxt-link
      v-if="originPath"
      :to="originPath"
      class="bs-ai-copy-origin__link"
      :aria-label="$t('aiSkills.copy.openOrigin', { id: item.copiedFrom })"
      @click.native.stop
    >
      {{ item.copiedFrom }}
    </nuxt-link>
  </span>
</template>

<style lang="scss" scoped>
.bs-ai-copy-origin {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-left: 0.5rem;

  &__link {
    font-size: 0.75rem;
  }
}
</style>
