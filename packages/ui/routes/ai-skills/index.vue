<script>
import * as acls from '~/helpers/pages-acls.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsAiSkillsTab from '~/components/ai-skill/bs-ai-skills-tab.vue';
import BsAiExpertiseTab from '~/components/ai-skill/bs-ai-expertise-tab.vue';
import BsAiInvocationsTab from '~/components/ai-skill/bs-ai-invocations-tab.vue';
import { Plus } from 'lucide-vue';

const VALID_TABS = ['skills', 'expertise', 'invocations'];

export default {
  name: 'PageAiSkillsHub',
  components: {
    BsPageHeader,
    BsAiSkillsTab,
    BsAiExpertiseTab,
    BsAiInvocationsTab,
    LucidePlus: Plus,
  },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
    sidebarModule: 'settings',
  },
  data() {
    return {
      tab: this.resolveInitialTab(),
    };
  },
  head() {
    return { title: this.pageTitle };
  },
  computed: {
    pageTitle() {
      return this.$t('aiSkills.pageTitle');
    },
    addButtonLabel() {
      if (this.tab === 'expertise')
        return this.$t('aiSkills.expertise.addExpertise');
      if (this.tab === 'skills') return this.$t('aiSkills.skill.addSkill');
      return '';
    },
    showAddButton() {
      return this.tab === 'skills' || this.tab === 'expertise';
    },
  },
  watch: {
    tab(newTab) {
      const current = this.$route.query.tab || 'skills';
      if (current !== newTab) {
        this.$router.replace({ query: { ...this.$route.query, tab: newTab } });
      }
    },
    '$route.query.tab'(newVal) {
      if (newVal && VALID_TABS.includes(newVal) && newVal !== this.tab) {
        this.tab = newVal;
      }
    },
  },
  methods: {
    resolveInitialTab() {
      const q = this.$route && this.$route.query && this.$route.query.tab;
      return VALID_TABS.includes(q) ? q : 'skills';
    },
    onAdd() {
      if (this.tab === 'skills') {
        this.$refs.skillsTab.openCreate();
      } else if (this.tab === 'expertise') {
        this.$refs.expertiseTab.openCreate();
      }
    },
  },
};
</script>

<template>
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ pageTitle }}
      </template>
      <template v-if="showAddButton" #actions>
        <v-btn color="accent" elevation="0" @click="onAdd">
          <lucide-plus :size="18" class="mr-2" />
          {{ addButtonLabel }}
        </v-btn>
      </template>
    </bs-page-header>

    <v-tabs v-model="tab" class="hub-tabs" background-color="transparent">
      <v-tab href="#skills">
        {{ $t('aiSkills.tabs.skills') }}
      </v-tab>
      <v-tab href="#expertise">
        {{ $t('aiSkills.tabs.expertise') }}
      </v-tab>
      <v-tab href="#invocations">
        {{ $t('aiSkills.tabs.invocations') }}
      </v-tab>
    </v-tabs>
    <v-divider />

    <v-container fluid>
      <div class="hub-content">
        <v-tabs-items v-model="tab" class="transparent">
          <v-tab-item value="skills">
            <bs-ai-skills-tab ref="skillsTab" />
          </v-tab-item>
          <v-tab-item value="expertise">
            <bs-ai-expertise-tab ref="expertiseTab" />
          </v-tab-item>
          <v-tab-item value="invocations">
            <bs-ai-invocations-tab />
          </v-tab-item>
        </v-tabs-items>
      </div>
    </v-container>
  </div>
</template>

<style lang="scss" scoped>
.hub-tabs {
  padding: 0 1.5rem;
}
.hub-content {
  padding: 1.5rem;
}
</style>
