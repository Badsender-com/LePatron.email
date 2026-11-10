<script>
// On a copy, where a skill or an expertise comes from and what the copy does
// with it (ADR 0019): an item production's follow keeps equal is kept on the
// copy, which the follow then no longer touches; a kept item follows
// production again, its work here set aside at the next follow; any of
// production's items is duplicated from one of its versions, to try
// something without touching the follow. Nothing on production.
import { mapMutations } from 'vuex';
import { Pin, RefreshCw, CopyPlus } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as api from '~/helpers/ai-skill-routes.js';
import { skillErrorMessage } from '~/helpers/ai-skill-errors.js';
import {
  copyActionsOf,
  copyOriginOf,
  duplicateChoicesOf,
  itemIdOf,
} from '~/helpers/skills-copy.js';
import { itemPath } from '~/helpers/skills-follow.js';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsAiCopyOriginChip from '~/components/ai-skill/bs-ai-copy-origin-chip.vue';

const ROUTES = {
  skill: {
    keep: api.aiSkillKeepOnCopy,
    duplicate: api.aiSkillDuplicateOnCopy,
  },
  expertise: {
    keep: api.aiExpertiseKeepOnCopy,
    duplicate: api.aiExpertiseDuplicateOnCopy,
  },
};

export default {
  name: 'BsAiCopyPanel',
  components: {
    BsModalConfirm,
    BsModalForm,
    BsSelect,
    BsAiCopyOriginChip,
    LucidePin: Pin,
    LucideRefreshCw: RefreshCw,
    LucideCopyPlus: CopyPlus,
  },
  props: {
    // `skill` or `expertise`.
    kind: { type: String, required: true },
    item: { type: Object, required: true },
    isCopy: { type: Boolean, default: false },
    // Whether the copy has completed a follow of production.
    followedOnce: { type: Boolean, default: false },
  },
  data() {
    return { busy: false, duplicateVersion: null };
  },
  computed: {
    origin() {
      return copyOriginOf(this.item, this.isCopy, this.followedOnce);
    },
    actions() {
      return copyActionsOf(this.item, this.isCopy);
    },
    versionChoices() {
      return duplicateChoicesOf(this.item).choices;
    },
    id() {
      return itemIdOf(this.kind, this.item);
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    // Runs a request of the copy; says it went through, or why not.
    async send(request, doneKey) {
      this.busy = true;
      try {
        const answer = await request();
        this.showSnackbar({ text: this.$t(doneKey), color: 'success' });
        return answer || {};
      } catch (error) {
        this.showSnackbar({
          text: skillErrorMessage(this, error),
          color: 'error',
        });
        return null;
      } finally {
        this.busy = false;
      }
    },
    async keepOnCopy() {
      const done = await this.send(
        () => this.$axios.$post(ROUTES[this.kind].keep(this.id)),
        'aiSkills.copy.keptDone'
      );
      if (done) this.$emit('changed');
    },
    askFollow() {
      this.$refs.followModal.open();
    },
    async followProduction() {
      const done = await this.send(
        () => this.$axios.$delete(ROUTES[this.kind].keep(this.id)),
        'aiSkills.copy.followDone'
      );
      if (done) this.$emit('changed');
    },
    openDuplicate() {
      this.duplicateVersion = duplicateChoicesOf(this.item).initial;
      this.$refs.duplicateModal.open();
    },
    async duplicate() {
      if (!this.duplicateVersion) return;
      const created = await this.send(
        () =>
          this.$axios.$post(ROUTES[this.kind].duplicate(this.id), {
            version: this.duplicateVersion,
          }),
        'aiSkills.copy.duplicateDone'
      );
      if (!created) return;
      this.$refs.duplicateModal.close();
      const newId = itemIdOf(this.kind, created);
      if (newId) {
        this.$router.push(`${itemPath(this.kind, newId)}?tab=versions`);
      }
    },
  },
};
</script>

<template>
  <section
    v-if="origin"
    class="bs-ai-copy-panel"
    :aria-label="$t('aiSkills.copy.panelLabel')"
  >
    <div class="bs-ai-copy-panel__origin">
      <bs-ai-copy-origin-chip
        :kind="kind"
        :item="item"
        :is-copy="isCopy"
        :followed-once="followedOnce"
      />
      <span class="bs-ai-copy-panel__explain">
        {{ $t(`aiSkills.copy.explain.${origin}`) }}
      </span>
    </div>
    <div
      v-if="actions.keep || actions.follow || actions.duplicate"
      class="bs-ai-copy-panel__actions"
    >
      <v-btn
        v-if="actions.keep"
        small
        outlined
        color="primary"
        class="text-none bs-ai-copy-panel__keep"
        :loading="busy"
        @click="keepOnCopy"
      >
        <lucide-pin :size="16" class="mr-2" />
        {{ $t('aiSkills.copy.keep') }}
      </v-btn>
      <v-btn
        v-if="actions.follow"
        small
        outlined
        color="primary"
        class="text-none bs-ai-copy-panel__follow"
        :loading="busy"
        @click="askFollow"
      >
        <lucide-refresh-cw :size="16" class="mr-2" />
        {{ $t('aiSkills.copy.follow') }}
      </v-btn>
      <v-btn
        v-if="actions.duplicate"
        small
        text
        color="primary"
        class="text-none bs-ai-copy-panel__duplicate"
        :disabled="busy"
        @click="openDuplicate"
      >
        <lucide-copy-plus :size="16" class="mr-2" />
        {{ $t('aiSkills.copy.duplicate') }}
      </v-btn>
    </div>

    <bs-modal-confirm
      ref="followModal"
      :title="$t('aiSkills.copy.followTitle')"
      :action-label="$t('aiSkills.copy.follow')"
      action-button-color="accent"
      @confirm="followProduction"
    >
      <p>{{ $t('aiSkills.copy.followConfirm') }}</p>
    </bs-modal-confirm>

    <bs-modal-form
      ref="duplicateModal"
      :title="$t('aiSkills.copy.duplicate')"
      :submit-label="$t('aiSkills.copy.duplicateSubmit')"
      :submit-disabled="!duplicateVersion"
      :loading="busy"
      @submit="duplicate"
    >
      <p class="text-caption text--secondary">
        {{ $t('aiSkills.copy.duplicateHint') }}
      </p>
      <bs-select
        v-model="duplicateVersion"
        :items="versionChoices"
        item-text="text"
        item-value="value"
        :label="$t('aiSkills.copy.duplicateVersion')"
      />
    </bs-modal-form>
  </section>
</template>

<style lang="scss" scoped>
.bs-ai-copy-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin: 0.75rem 1.5rem 0;
  padding: 0.625rem 1rem;
  border: 1px solid var(--gray-300);
  border-radius: var(--r-md);
  background: var(--surface-muted);

  &__origin {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-width: 0;
  }

  // The chip carries its own left margin in a list row.
  &__origin ::v-deep .bs-ai-copy-origin {
    margin-left: 0;
  }

  &__explain {
    font-size: 0.8125rem;
    color: var(--gray-800);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}
</style>
