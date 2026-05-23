<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as api from '~/helpers/ai-skill-routes.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import BsAiDetailHeader from '~/components/ai-skill/BsAiDetailHeader.vue';
import BsAiSkillVersionModal from '~/components/ai-skill/BsAiSkillVersionModal.vue';
import BsAiActivateModal from '~/components/ai-skill/BsAiActivateModal.vue';
import BsAiArchiveModal from '~/components/ai-skill/BsAiArchiveModal.vue';
import BsAiSkillVersionsPanel from '~/components/ai-skill/BsAiSkillVersionsPanel.vue';
import BsAiSkillTestPanel from '~/components/ai-skill/BsAiSkillTestPanel.vue';
import BsAiSkillDetailsForm from '~/components/ai-skill/BsAiSkillDetailsForm.vue';
import BsAiSkillLogsPanel from '~/components/ai-skill/BsAiSkillLogsPanel.vue';

export default {
  name: 'PageAiSkillDetail',
  components: {
    BsAiDetailHeader,
    BsAiSkillVersionModal,
    BsAiActivateModal,
    BsAiArchiveModal,
    BsAiSkillVersionsPanel,
    BsAiSkillTestPanel,
    BsAiSkillDetailsForm,
    BsAiSkillLogsPanel,
  },
  mixins: [mixinPageTitle],
  meta: { acl: acls.ACL_ADMIN, sidebarModule: 'settings' },
  async asyncData({ $axios, params, error }) {
    try {
      const [skill, schemasRes] = await Promise.all([
        $axios.$get(api.aiSkill(params.skillId)),
        $axios.$get(api.aiSkillSchemas()),
      ]);
      return { skill, schemas: schemasRes.schemas || [] };
    } catch (err) {
      return error({ statusCode: 404, message: 'Skill not found' });
    }
  },
  data() {
    return {
      skill: null,
      schemas: [],
      tab: 'details',
      activatingVersion: null,
      saving: false,
    };
  },
  head() {
    return { title: this.pageTitle };
  },
  computed: {
    pageTitle() {
      return this.skill ? this.skill.title : this.$t('aiSkills.tabs.skills');
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    categoryLabel(value) {
      return value ? this.$t(`aiSkills.categories.${value}`) : '';
    },

    async saveDetails() {
      this.saving = true;
      try {
        const patch = {
          title: this.skill.title,
          description: this.skill.description,
          category: this.skill.category,
          inputSchemaId: this.skill.inputSchemaId,
          outputSchemaId: this.skill.outputSchemaId,
          intendedUseCases: this.skill.intendedUseCases,
        };
        this.skill = await this.$axios.$patch(
          api.aiSkill(this.skill.skillId),
          patch
        );
        this.showSnackbar({
          text: this.$t('global.savedSuccessfully'),
          color: 'success',
        });
      } catch (err) {
        this.handleError(err);
      } finally {
        this.saving = false;
      }
    },
    async createVersion(payload) {
      this.saving = true;
      try {
        this.skill = await this.$axios.$post(
          api.aiSkillVersions(this.skill.skillId),
          payload
        );
        this.$refs.versionModal.close();
        this.showSnackbar({
          text: this.$t('aiSkills.version.versionCreated'),
          color: 'success',
        });
      } catch (err) {
        this.handleError(err);
      } finally {
        this.saving = false;
      }
    },
    async saveVersion(version) {
      this.saving = true;
      try {
        this.skill = await this.$axios.$patch(
          api.aiSkillVersion(this.skill.skillId, version.versionNumber),
          {
            systemPrompt: version.systemPrompt,
            skillBody: version.skillBody,
            inputTemplate: version.inputTemplate,
            modelHints: version.modelHints,
          }
        );
        this.showSnackbar({
          text: this.$t('aiSkills.version.draftSaved'),
          color: 'success',
        });
      } catch (err) {
        this.handleError(err);
      } finally {
        this.saving = false;
      }
    },
    askActivate(version) {
      this.activatingVersion = version;
      this.$refs.activateModal.open();
    },
    async activateVersion(payload) {
      this.saving = true;
      try {
        this.skill = await this.$axios.$post(
          api.aiSkillActivate(
            this.skill.skillId,
            this.activatingVersion.versionNumber
          ),
          payload
        );
        this.$refs.activateModal.close();
        this.showSnackbar({
          text: this.$t('aiSkills.version.activated'),
          color: 'success',
        });
      } catch (err) {
        this.handleError(err);
      } finally {
        this.saving = false;
      }
    },
    async archive() {
      this.saving = true;
      try {
        this.skill = await this.$axios.$post(
          api.aiSkillArchive(this.skill.skillId)
        );
        this.$refs.archiveModal.close();
        this.showSnackbar({
          text: this.$t('aiSkills.skill.archived'),
          color: 'success',
        });
      } catch (err) {
        this.handleError(err);
      } finally {
        this.saving = false;
      }
    },
    handleError(err) {
      const msg =
        (err.response && err.response.data && err.response.data.message) ||
        this.$t('global.errors.errorOccured');
      this.showSnackbar({ text: msg, color: 'error' });
    },
  },
};
</script>

<template>
  <div>
    <bs-ai-detail-header
      :title="skill.title"
      :status="skill.status"
      back-to="/ai-skills?tab=skills"
      @archive="$refs.archiveModal.open()"
    />

    <p class="text-caption text--secondary detail-meta">
      {{ skill.skillId }} · {{ categoryLabel(skill.category) }} ·
      <span v-if="skill.activeVersion"
        >{{ $t('aiSkills.skill.activeVersion') }} v{{
          skill.activeVersion
        }}</span
      >
      <span v-else class="text--disabled">{{
        $t('aiSkills.skill.noActiveVersion')
      }}</span>
    </p>

    <v-tabs v-model="tab" class="detail-tabs">
      <v-tab href="#details">
        {{ $t('aiSkills.tabs.details') }}
      </v-tab>
      <v-tab href="#versions">
        {{ $t('aiSkills.tabs.versions') }}
      </v-tab>
      <v-tab href="#test">
        {{ $t('aiSkills.test.tabLabel') }}
      </v-tab>
      <v-tab href="#logs">
        {{ $t('aiSkills.logs.tabLabel') }}
      </v-tab>
    </v-tabs>
    <v-divider />

    <v-container fluid>
      <v-tabs-items v-model="tab" class="transparent">
        <!-- DETAILS -->
        <v-tab-item value="details">
          <bs-ai-skill-details-form
            :skill="skill"
            :schemas="schemas"
            :saving="saving"
            @save="saveDetails"
          />
        </v-tab-item>

        <!-- VERSIONS -->
        <v-tab-item value="versions">
          <bs-ai-skill-versions-panel
            :skill="skill"
            :saving="saving"
            @create="$refs.versionModal.open()"
            @save="saveVersion"
            @activate="askActivate"
          />
        </v-tab-item>

        <!-- TEST -->
        <v-tab-item value="test">
          <bs-ai-skill-test-panel :skill-id="skill.skillId" />
        </v-tab-item>

        <!-- LOGS -->
        <v-tab-item value="logs">
          <bs-ai-skill-logs-panel
            v-if="tab === 'logs'"
            :skill-id="skill.skillId"
          />
        </v-tab-item>
      </v-tabs-items>
    </v-container>

    <bs-ai-skill-version-modal
      ref="versionModal"
      :loading="saving"
      @submit="createVersion"
    />
    <bs-ai-activate-modal
      ref="activateModal"
      :loading="saving"
      @confirm="activateVersion"
    />
    <bs-ai-archive-modal
      ref="archiveModal"
      :title="$t('aiSkills.skill.archiveTitle')"
      :body="$t('aiSkills.skill.archiveBody')"
      :loading="saving"
      @confirm="archive"
    />
  </div>
</template>

<style lang="scss" scoped>
.detail-meta {
  padding: 0 1.5rem;
  margin-bottom: 0;
}
.detail-tabs {
  padding: 0 1.5rem;
}
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
.code-block {
  background: #f5f5f5;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  max-height: 320px;
  overflow: auto;
  margin: 0;
}
</style>
