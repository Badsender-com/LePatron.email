<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import { GENERAL } from '~/helpers/quality-exceptions.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import mixinUnsavedChanges from '~/helpers/mixins/mixin-unsaved-changes.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsQualityExceptionsEditor from '~/components/quality/quality-exceptions-editor.vue';
import BsQualityReferenceTable from '~/components/quality/quality-reference-table.vue';
import BsQualityTemplatesTable from '~/components/quality/quality-templates-table.vue';
import { IS_ADMIN, USER } from '~/store/user';

const TABS = ['general', 'templates'];

// The quality control's settings of a group
// (docs/adr/0004-quality-settings-per-group-and-template.md): its general
// settings, the exceptions every template follows, and the list of its
// templates, each with its own exceptions. A super admin for any group, a
// company admin for their own.
export default {
  name: 'BsPageSettingsQuality',
  components: {
    BsPageHeader,
    BsModalConfirm,
    BsQualityExceptionsEditor,
    BsQualityReferenceTable,
    BsQualityTemplatesTable,
  },
  mixins: [mixinSettingsTitle, mixinUnsavedChanges],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    const [groupData, templates] = await Promise.all([
      safeFetchGroup(nuxtContext),
      nuxtContext.$axios
        .$get(apiRoutes.groupsItemTemplates(nuxtContext.params))
        .then((response) => response.items || [])
        .catch((error) => {
          console.error('[Quality] Failed to load the templates:', error);
          return [];
        }),
    ]);
    return { ...groupData, templates };
  },
  data() {
    return {
      group: {},
      templates: [],
      tab: TABS.includes(this.$route.query.tab)
        ? this.$route.query.tab
        : 'general',
      // Re-mounts the tabs when a tab change is refused.
      tabsKey: 0,
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    level() {
      return GENERAL;
    },
    showGroupBadge() {
      return this.isAdmin && this.group.name;
    },
  },
  watch: {
    '$route.query.tab'(tab) {
      if (TABS.includes(tab) && tab !== this.tab) this.tab = tab;
    },
  },
  methods: {
    onTab(tab) {
      if (tab === this.tab) return;
      const go = () => {
        if (this.$refs.editor) this.$refs.editor.reset();
        this.unsavedChanges = 0;
        this.tab = tab;
        this.$router.replace({ query: { ...this.$route.query, tab } });
      };
      if (!this.unsavedChanges) return go();
      this.tabsKey += 1;
      this.askToLeave(go);
    },

    saveGeneral(qualitySettings) {
      // Partial update: only the section this page owns travels.
      return this.$axios.$put(
        apiRoutes.groupsItem({ groupId: this.group.id }),
        {
          qualitySettings,
        }
      );
    },

    // Refetched rather than patched locally: the saved state is what the
    // server returns.
    async refreshGroup() {
      const { group } = await safeFetchGroup({
        $axios: this.$axios,
        params: this.$route.params,
        store: this.$store,
        app: { i18n: this.$i18n },
      });
      this.group = group;
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
        {{ $t('qualitySettings.title') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
      <template v-if="tab === 'general'" #actions>
        <v-btn color="accent" elevation="0" @click="$refs.editor.openAdd()">
          {{ $t('qualitySettings.addException') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-tabs
      :key="tabsKey"
      :value="tab"
      class="hub-tabs"
      background-color="transparent"
      @change="onTab"
    >
      <v-tab href="#general">{{ $t('qualitySettings.tabs.general') }}</v-tab>
      <v-tab href="#templates">
        {{ $t('qualitySettings.tabs.templates', { count: templates.length }) }}
      </v-tab>
    </v-tabs>
    <v-divider />
    <v-container fluid>
      <div class="settings-content">
        <div v-if="tab === 'general'">
          <p class="quality-intro">{{ $t('qualitySettings.general.intro') }}</p>
          <bs-quality-exceptions-editor
            ref="editor"
            :level="level"
            :settings="group.qualitySettings || null"
            :group-id="group.id || ''"
            :save="saveGeneral"
            @changes="unsavedChanges = $event"
            @saved="refreshGroup"
          />
          <bs-quality-reference-table
            :settings="group.qualitySettings || null"
          />
        </div>
        <bs-quality-templates-table
          v-else
          :templates="templates"
          :group-id="group.id || $route.params.groupId"
        />
      </div>
    </v-container>
    <bs-modal-confirm
      ref="leaveModal"
      :title="$t('qualitySettings.unsaved.leaveTitle')"
      :action-label="$t('qualitySettings.unsaved.leave')"
      @confirm="confirmLeave"
      @close="cancelLeave"
    >
      {{ $t('qualitySettings.unsaved.leaveText') }}
    </bs-modal-confirm>
  </div>
</template>

<style lang="scss" scoped>
.quality-intro {
  font-size: 0.875rem;
  color: var(--gray-700);
  max-width: 760px;
}
</style>
