<script>
import { mapMutations } from 'vuex';
import { Download } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as api from '~/helpers/ai-skill-routes.js';
import { downloadSkillsExport } from '~/helpers/skills-export-download.js';
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
    return { consumed: [], removed: [], exporting: false };
  },
  computed: {
    count() {
      return this.skills.length + this.expertiseIds.length;
    },
    added() {
      return this.consumed.filter(
        (id) => !this.expertiseIds.includes(id) && !this.removed.includes(id)
      );
    },
  },
  watch: {
    skills: { handler: 'readConsumed', immediate: true },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    // The list does not carry versions: a skill's active version says
    // whether it is a task skill (ADR 0013), and which expertises it consumes.
    async readConsumed() {
      try {
        const docs = await Promise.all(
          this.skills.map((skill) =>
            this.$axios.$get(api.aiSkill(skill.skillId))
          )
        );
        const ids = docs.flatMap((doc) => {
          const { major, minor } = doc.activeVersion || {};
          const active = (doc.versions || []).find(
            (v) => v.versionMajor === major && v.versionMinor === minor
          );
          return active && active.nature === SKILL_NATURES.TASK
            ? active.consumedExpertiseIds || []
            : [];
        });
        this.consumed = [...new Set(ids)];
      } catch (err) {
        this.consumed = [];
      }
    },
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
          text: this.$t('aiSkills.export.failed'),
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
