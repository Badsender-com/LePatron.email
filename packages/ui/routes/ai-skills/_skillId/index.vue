<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as api from '~/helpers/ai-skill-routes.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import BsAiDetailHeader from '~/components/ai-skill/BsAiDetailHeader.vue';
import BsAiActivateModal from '~/components/ai-skill/BsAiActivateModal.vue';
import BsAiArchiveModal from '~/components/ai-skill/BsAiArchiveModal.vue';
import BsAiSkillVersionsPanel from '~/components/ai-skill/BsAiSkillVersionsPanel.vue';
import BsAiSkillTestPanel from '~/components/ai-skill/BsAiSkillTestPanel.vue';
import BsAiSkillDetailsForm from '~/components/ai-skill/BsAiSkillDetailsForm.vue';
import BsAiSkillLogsPanel from '~/components/ai-skill/BsAiSkillLogsPanel.vue';
import BsAiSkillLinkedExpertisePanel from '~/components/ai-skill/BsAiSkillLinkedExpertisePanel.vue';

export default {
  name: 'PageAiSkillDetail',
  components: {
    BsAiDetailHeader,
    BsAiActivateModal,
    BsAiArchiveModal,
    BsAiSkillVersionsPanel,
    BsAiSkillTestPanel,
    BsAiSkillDetailsForm,
    BsAiSkillLogsPanel,
    BsAiSkillLinkedExpertisePanel,
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
      versionWarnings: [],
    };
  },
  head() {
    return { title: this.pageTitle };
  },
  computed: {
    pageTitle() {
      return this.skill ? this.skill.title : this.$t('aiSkills.tabs.skills');
    },
    activeVersionLabel() {
      const av = this.skill && this.skill.activeVersion;
      if (!av || av.major == null) return null;
      return `${av.major}.${av.minor || 0}`;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    categoryLabel(value) {
      return value ? this.$t(`aiSkills.categories.${value}`) : '';
    },

    async saveDetails() {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      await this.$nextTick();
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

    async createMinorVersion() {
      this.saving = true;
      try {
        this.skill = await this.$axios.$post(
          api.aiSkillVersionMinor(this.skill.skillId)
        );
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

    async createMajorVersion(source) {
      this.saving = true;
      try {
        const body = source
          ? {
              sourceMajor: source.versionMajor,
              sourceMinor: source.versionMinor,
            }
          : {};
        this.skill = await this.$axios.$post(
          api.aiSkillVersionMajor(this.skill.skillId),
          body
        );
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

    async saveVersion({ version }) {
      this.saving = true;
      try {
        const payload = {
          systemPrompt: version.systemPrompt,
          skillBody: version.skillBody,
          inputTemplate: version.inputTemplate,
          modelHints: version.modelHints,
          changelog: version.changelog,
          releaseNotes: version.releaseNotes,
        };
        const res = await this.$axios.$patch(
          api.aiSkillVersion(
            this.skill.skillId,
            version.versionMajor,
            version.versionMinor
          ),
          payload
        );
        // Template ↔ input-schema coherence warnings (non-blocking on DRAFT
        // save; out-of-schema placeholders block at activation).
        this.versionWarnings = res.warnings || [];
        delete res.warnings;
        this.skill = res;
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

    async deleteVersion(version) {
      if (!confirm(this.$t('aiSkills.version.deleteDraftConfirm'))) return;
      this.saving = true;
      try {
        this.skill = await this.$axios.$delete(
          api.aiSkillVersion(
            this.skill.skillId,
            version.versionMajor,
            version.versionMinor
          )
        );
      } catch (err) {
        this.handleError(err);
      } finally {
        this.saving = false;
      }
    },

    askActivate(version) {
      this.activatingVersion = version;
      // Minor releases publish directly with defaults; major releases need
      // an explicit changelog/releaseNotes via the modal.
      if (version.versionMinor === 0) {
        this.$refs.activateModal.open();
      } else {
        this.activateVersion({});
      }
    },
    async activateVersion(payload) {
      this.saving = true;
      try {
        this.skill = await this.$axios.$post(
          api.aiSkillActivate(
            this.skill.skillId,
            this.activatingVersion.versionMajor,
            this.activatingVersion.versionMinor
          ),
          payload
        );
        if (this.$refs.activateModal) this.$refs.activateModal.close();
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
      <span v-if="activeVersionLabel">{{ $t('aiSkills.skill.activeVersion') }} v{{
        activeVersionLabel
      }}</span>
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
      <v-tab href="#expertise">
        {{ $t('aiSkills.skill.linkedExpertiseTab') }}
      </v-tab>
    </v-tabs>
    <v-divider />

    <v-container fluid>
      <v-tabs-items v-model="tab" class="transparent">
        <v-tab-item value="details">
          <bs-ai-skill-details-form
            :skill="skill"
            :schemas="schemas"
            :saving="saving"
            @save="saveDetails"
          />
        </v-tab-item>

        <v-tab-item value="versions">
          <v-alert
            v-for="(warning, i) in versionWarnings"
            :key="`warn-${i}`"
            type="warning"
            dense
            outlined
            class="mb-3"
          >
            {{ warning }}
          </v-alert>
          <bs-ai-skill-versions-panel
            :skill="skill"
            :saving="saving"
            @create-minor="createMinorVersion"
            @create-major="createMajorVersion(null)"
            @save="saveVersion"
            @activate="askActivate"
            @duplicate="createMajorVersion"
            @delete="deleteVersion"
          />
        </v-tab-item>

        <v-tab-item value="test">
          <bs-ai-skill-test-panel :skill-id="skill.skillId" />
        </v-tab-item>

        <v-tab-item value="logs">
          <bs-ai-skill-logs-panel
            v-if="tab === 'logs'"
            :skill-id="skill.skillId"
          />
        </v-tab-item>

        <v-tab-item value="expertise">
          <bs-ai-skill-linked-expertise-panel
            v-if="tab === 'expertise'"
            :skill-id="skill.skillId"
          />
        </v-tab-item>
      </v-tabs-items>
    </v-container>

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
</style>
