<script>
import * as api from '~/helpers/ai-skill-routes.js';
import { Workflow } from 'lucide-vue';

export default {
  name: 'BsAiExpertiseConsumersPanel',
  components: { LucideWorkflow: Workflow },
  props: {
    // Declared skillIds (the expertise's consumedBySkills field) — free
    // slugs, so some may not resolve to an existing skill.
    skillIds: { type: Array, default: () => [] },
  },
  data() {
    return {
      loading: false,
      skillsById: {},
    };
  },
  computed: {
    rows() {
      return this.skillIds.map((id) => ({
        skillId: id,
        skill: this.skillsById[id] || null,
      }));
    },
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    statusLabel(value) {
      return value ? this.$t(`aiSkills.statuses.${value}`) : '';
    },
    async fetchData() {
      if (!this.skillIds.length) return;
      this.loading = true;
      try {
        const res = await this.$axios.$get(api.aiSkills(), {
          params: { pageSize: 200 },
        });
        this.skillsById = Object.fromEntries(
          (res.items || []).map((s) => [s.skillId, s])
        );
      } catch (err) {
        this.skillsById = {};
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
      {{ $t('aiSkills.expertise.consumedByCaption') }}
    </p>
    <v-progress-linear v-if="loading" indeterminate />
    <v-list v-else-if="rows.length > 0" dense>
      <v-list-item
        v-for="row in rows"
        :key="row.skillId"
        :to="row.skill ? `/ai-skills/${row.skillId}` : undefined"
        :inactive="!row.skill"
        class="consumer-row"
      >
        <v-list-item-content>
          <v-list-item-title v-if="row.skill">
            {{ row.skill.title }}
          </v-list-item-title>
          <v-list-item-title v-else class="text--disabled">
            {{ $t('aiSkills.expertise.unknownSkill') }}
          </v-list-item-title>
          <v-list-item-subtitle>
            <code>{{ row.skillId }}</code>
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action v-if="row.skill">
          <v-chip
            small
            :color="row.skill.status === 'ACTIVE' ? 'success' : undefined"
            :outlined="row.skill.status !== 'ACTIVE'"
            :dark="row.skill.status === 'ACTIVE'"
          >
            {{ statusLabel(row.skill.status) }}
          </v-chip>
        </v-list-item-action>
      </v-list-item>
    </v-list>
    <div v-else class="text-center pa-6">
      <lucide-workflow :size="48" class="grey--text text--lighten-1" />
      <p class="text-body-1 grey--text mt-4 mb-1">
        {{ $t('aiSkills.expertise.noConsumers') }}
      </p>
      <p class="text-caption text--secondary">
        {{ $t('aiSkills.expertise.noConsumersHint') }}
      </p>
    </div>
  </v-card>
</template>

<style lang="scss" scoped>
.consumer-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
</style>
