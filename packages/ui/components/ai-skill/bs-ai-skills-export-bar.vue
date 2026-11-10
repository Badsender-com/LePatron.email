<script>
import { mapMutations } from 'vuex';
import { Download } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import {
  downloadSkillsExport,
  exportFailureMessage,
} from '~/helpers/skills-export-download.js';
import { SKILL_NATURES } from '../../../shared/ai-skill/constants.js';

// What a selection exports (ADR 0018): the selected skills and expertises,
// plus the expertises the selected task skills consume, which the super admin
// can take out one by one.
export default {
  name: 'BsAiSkillsExportBar',
  components: { LucideDownload: Download },
  props: {
    skills: { type: Array, default: () => [] },
    expertiseIds: { type: Array, default: () => [] },
  },
  data() {
    return { removed: [], exporting: false };
  },
  computed: {
    count() {
      return this.skills.length + this.expertiseIds.length;
    },
    // The list gives each skill's active version with its nature and the
    // expertises it consumes (ADR 0013): only a task skill brings them.
    consumed() {
      const ids = this.skills.flatMap(({ activeVersion }) =>
        activeVersion && activeVersion.nature === SKILL_NATURES.TASK
          ? activeVersion.consumedExpertiseIds || []
          : []
      );
      return [...new Set(ids)];
    },
    added() {
      return this.consumed.filter(
        (id) => !this.expertiseIds.includes(id) && !this.removed.includes(id)
      );
    },
  },
  watch: {
    // An expertise taken out stays out only while a selected skill brings
    // it: selected again later, it is back.
    consumed(ids) {
      this.removed = this.removed.filter((id) => ids.includes(id));
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async exportSelection() {
      this.exporting = true;
      try {
        await downloadSkillsExport(this.$axios, {
          skillIds: this.skills.map((skill) => skill.skillId),
          expertiseIds: this.expertiseIds,
          withoutExpertiseIds: this.removed,
        });
        this.showSnackbar({
          text: this.$t('aiSkills.export.done'),
          color: 'success',
        });
      } catch (err) {
        this.showSnackbar({
          text: exportFailureMessage(this, err),
          color: 'error',
        });
      } finally {
        this.exporting = false;
      }
    },
  },
};
</script>

<template>
  <div v-if="count" class="bs-ai-skills-export-bar">
    <div class="bs-ai-skills-export-bar__main">
      <span class="bs-ai-skills-export-bar__count">
        {{ $tc('aiSkills.export.selected', count, { count }) }}
      </span>
      <v-btn
        color="accent"
        elevation="0"
        class="text-none"
        :loading="exporting"
        @click="exportSelection"
      >
        <lucide-download :size="16" class="mr-2" />
        {{ $t('aiSkills.export.selection') }}
      </v-btn>
    </div>
    <div v-if="added.length" class="bs-ai-skills-export-bar__added">
      <span>{{ $t('aiSkills.export.consumed') }}</span>
      <v-chip
        v-for="id in added"
        :key="id"
        small
        outlined
        close
        :close-label="$t('aiSkills.export.remove', { id })"
        @click:close="removed.push(id)"
      >
        {{ id }}
      </v-chip>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bs-ai-skills-export-bar {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--gray-300);
  border-radius: var(--r-md);
  background: var(--accent-tint-selected);

  &__main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__count {
    font-weight: 500;
    color: var(--gray-900);
  }

  &__added {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--gray-700);
  }
}
</style>
