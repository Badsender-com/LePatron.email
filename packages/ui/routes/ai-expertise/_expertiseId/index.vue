<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as api from '~/helpers/ai-skill-routes.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import BsAiDetailHeader from '~/components/ai-skill/BsAiDetailHeader.vue';
import BsAiExpertiseDetailsForm from '~/components/ai-skill/BsAiExpertiseDetailsForm.vue';
import BsAiExpertiseVersionsPanel from '~/components/ai-skill/BsAiExpertiseVersionsPanel.vue';
import BsAiActivateModal from '~/components/ai-skill/BsAiActivateModal.vue';
import BsAiArchiveModal from '~/components/ai-skill/BsAiArchiveModal.vue';

export default {
  name: 'PageAiExpertiseDetail',
  components: {
    BsAiDetailHeader,
    BsAiExpertiseDetailsForm,
    BsAiExpertiseVersionsPanel,
    BsAiActivateModal,
    BsAiArchiveModal,
  },
  mixins: [mixinPageTitle],
  meta: { acl: acls.ACL_ADMIN, sidebarModule: 'settings' },
  async asyncData({ $axios, params, error }) {
    try {
      const exp = await $axios.$get(api.aiExpertise(params.expertiseId));
      return { exp };
    } catch (err) {
      return error({ statusCode: 404, message: 'Expertise not found' });
    }
  },
  data() {
    return {
      exp: null,
      // Landing tab / auto-expanded version come from the query — the create
      // flow redirects here with ?tab=versions&expand=1.0 (§4).
      tab: this.$route.query.tab === 'versions' ? 'versions' : 'details',
      autoExpandVersion: this.$route.query.expand || null,
      activatingVersion: null,
      activationImpact: [],
      saving: false,
    };
  },
  head() {
    return { title: this.pageTitle };
  },
  computed: {
    pageTitle() {
      return this.exp ? this.exp.title : this.$t('aiSkills.tabs.expertise');
    },
    activeVersionLabel() {
      const av = this.exp && this.exp.activeVersion;
      if (!av || av.major == null) return null;
      return `${av.major}.${av.minor || 0}`;
    },
    activeVersion() {
      const av = this.exp && this.exp.activeVersion;
      if (!av || av.major == null) return null;
      return (this.exp.versions || []).find(
        (v) => v.versionMajor === av.major && v.versionMinor === (av.minor || 0)
      );
    },
    sections() {
      return (this.activeVersion && this.activeVersion.sections) || [];
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    categoryLabel(value) {
      return value ? this.$t(`aiSkills.categories.${value}`) : '';
    },
    handleError(err) {
      const msg =
        (err.response && err.response.data && err.response.data.message) ||
        this.$t('global.errors.errorOccured');
      this.showSnackbar({ text: msg, color: 'error' });
    },
    async saveDetails() {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      await this.$nextTick();
      this.saving = true;
      try {
        this.exp = await this.$axios.$patch(
          api.aiExpertise(this.exp.expertiseId),
          {
            title: this.exp.title,
            description: this.exp.description,
            category: this.exp.category,
            scope: this.exp.scope,
            isTransversal: this.exp.isTransversal,
            appliesToEmailTypes: this.exp.appliesToEmailTypes,
            appliesToLanguages: this.exp.appliesToLanguages,
          }
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
        this.exp = await this.$axios.$post(
          api.aiExpertiseVersionMinor(this.exp.expertiseId)
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
        this.exp = await this.$axios.$post(
          api.aiExpertiseVersionMajor(this.exp.expertiseId),
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
        this.exp = await this.$axios.$patch(
          api.aiExpertiseVersion(
            this.exp.expertiseId,
            version.versionMajor,
            version.versionMinor
          ),
          {
            body: version.body,
            examplesGood: version.examplesGood,
            examplesBad: version.examplesBad,
            changelog: version.changelog,
            releaseNotes: version.releaseNotes,
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
    async deleteVersion(version) {
      if (!confirm(this.$t('aiSkills.version.deleteDraftConfirm'))) return;
      this.saving = true;
      try {
        this.exp = await this.$axios.$delete(
          api.aiExpertiseVersion(
            this.exp.expertiseId,
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
    async askActivate(version) {
      this.activatingVersion = version;
      // Both major AND minor go through the modal: activating any version
      // instantly changes the doctrine features consume, so the impact alert
      // must show either way. Informed consent: surface which features will
      // load this expertise. Changelog/notes required for major only.
      this.activationImpact = [];
      try {
        const res = await this.$axios.$get(
          api.aiExpertiseActivationImpact(this.exp.expertiseId)
        );
        this.activationImpact = res.matches || [];
      } catch (err) {
        this.activationImpact = [];
      }
      // Pre-fill changelog / release notes from the draft, shared modal.
      this.$refs.activateModal.open(version);
    },
    async activateVersion(payload) {
      this.saving = true;
      try {
        this.exp = await this.$axios.$post(
          api.aiExpertiseActivate(
            this.exp.expertiseId,
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
        this.exp = await this.$axios.$post(
          api.aiExpertiseArchive(this.exp.expertiseId)
        );
        this.$refs.archiveModal.close();
        this.showSnackbar({
          text: this.$t('aiSkills.expertise.archived'),
          color: 'success',
        });
      } catch (err) {
        this.handleError(err);
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<template>
  <div>
    <bs-ai-detail-header
      :title="exp.title"
      :status="exp.status"
      back-to="/ai-skills?tab=expertise"
      @archive="$refs.archiveModal.open()"
    />

    <p class="text-caption text--secondary detail-meta">
      {{ exp.expertiseId }} · {{ categoryLabel(exp.category) }} ·
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
      <v-tab href="#sections">
        {{ $t('aiSkills.expertise.sectionsTab') }}
      </v-tab>
    </v-tabs>
    <v-divider />

    <v-container fluid>
      <v-tabs-items v-model="tab" class="transparent">
        <v-tab-item value="details">
          <bs-ai-expertise-details-form
            :expertise="exp"
            :saving="saving"
            @save="saveDetails"
          />
        </v-tab-item>
        <v-tab-item value="versions">
          <bs-ai-expertise-versions-panel
            :expertise="exp"
            :auto-expand-version="autoExpandVersion"
            :saving="saving"
            @create-minor="createMinorVersion"
            @create-major="createMajorVersion(null)"
            @save="saveVersion"
            @activate="askActivate"
            @duplicate="createMajorVersion"
            @delete="deleteVersion"
          />
        </v-tab-item>
        <v-tab-item value="sections">
          <v-card outlined class="pa-4">
            <p class="text-caption text--secondary mb-3">
              {{ $t('aiSkills.expertise.sectionsCaption') }}
            </p>
            <v-list v-if="sections.length > 0" dense>
              <v-list-item
                v-for="s in sections"
                :key="s.id"
                class="section-row"
              >
                <v-list-item-content>
                  <v-list-item-title>{{ s.title }}</v-list-item-title>
                  <v-list-item-subtitle>
                    <code>{{ s.id }}</code>
                  </v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
            </v-list>
            <p v-else class="text--disabled text-center my-4">
              {{ $t('aiSkills.expertise.noSections') }}
            </p>
          </v-card>
        </v-tab-item>
      </v-tabs-items>
    </v-container>

    <bs-ai-activate-modal
      ref="activateModal"
      :loading="saving"
      :show-impact="true"
      :impact="activationImpact"
      :is-major="!!activatingVersion && activatingVersion.versionMinor === 0"
      @confirm="activateVersion"
    />
    <bs-ai-archive-modal
      ref="archiveModal"
      :title="$t('aiSkills.expertise.archiveTitle')"
      :body="$t('aiSkills.expertise.archiveBody')"
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
.section-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
</style>
