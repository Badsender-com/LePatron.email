<script>
import * as api from '~/helpers/ai-skill-routes.js';
import { BookOpen } from 'lucide-vue';

export default {
  name: 'BsAiSkillLinkedExpertisePanel',
  components: { LucideBookOpen: BookOpen },
  props: {
    skillId: { type: String, required: true },
  },
  data() {
    return {
      loading: false,
      items: [],
    };
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    statusLabel(value) {
      return value ? this.$t(`aiSkills.statuses.${value}`) : '';
    },
    categoryLabel(value) {
      return value ? this.$t(`aiSkills.categories.${value}`) : '';
    },
    async fetchData() {
      this.loading = true;
      try {
        const res = await this.$axios.$get(api.aiExpertiseList(), {
          params: { consumedBySkill: this.skillId, pageSize: 200 },
        });
        this.items = res.items || [];
      } catch (err) {
        this.items = [];
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <v-card outlined class="pa-4">
    <p class="text-caption text--secondary mb-3">
      {{ $t('aiSkills.skill.linkedExpertiseCaption') }}
    </p>
    <v-progress-linear v-if="loading" indeterminate />
    <v-list v-else-if="items.length > 0" dense>
      <v-list-item
        v-for="e in items"
        :key="e.expertiseId"
        :to="`/ai-expertise/${e.expertiseId}`"
        class="linked-row"
      >
        <v-list-item-content>
          <v-list-item-title>{{ e.title }}</v-list-item-title>
          <v-list-item-subtitle>
            <code>{{ e.expertiseId }}</code> ·
            {{ categoryLabel(e.category) }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-chip
            small
            :color="e.status === 'ACTIVE' ? 'success' : undefined"
            :outlined="e.status !== 'ACTIVE'"
            :dark="e.status === 'ACTIVE'"
          >
            {{ statusLabel(e.status) }}
          </v-chip>
        </v-list-item-action>
      </v-list-item>
    </v-list>
    <div v-else class="text-center pa-6">
      <lucide-book-open :size="48" class="grey--text text--lighten-1" />
      <p class="text-body-1 grey--text mt-4 mb-1">
        {{ $t('aiSkills.skill.noLinkedExpertise') }}
      </p>
      <p class="text-caption text--secondary">
        {{ $t('aiSkills.skill.noLinkedExpertiseHint') }}
      </p>
    </div>
  </v-card>
</template>

<style lang="scss" scoped>
.linked-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
</style>
