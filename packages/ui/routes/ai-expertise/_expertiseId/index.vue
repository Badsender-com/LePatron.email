<script>
import * as acls from '~/helpers/pages-acls.js';
import * as api from '~/helpers/ai-skill-routes.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import mixinAiVersionedItem from '~/helpers/mixins/mixin-ai-versioned-item.js';
import BsAiFeedbackTab from '~/components/ai-skill/bs-ai-feedback-tab.vue';
import BsAiDetailHeader from '~/components/ai-skill/bs-ai-detail-header.vue';
import BsAiExpertiseDetailsForm from '~/components/ai-skill/bs-ai-expertise-details-form.vue';
import BsAiExpertiseVersionsPanel from '~/components/ai-skill/bs-ai-expertise-versions-panel.vue';
import BsAiActivateModal from '~/components/ai-skill/bs-ai-activate-modal.vue';
import BsAiArchiveModal from '~/components/ai-skill/bs-ai-archive-modal.vue';
import BsAiDraftChangedAlert from '~/components/ai-skill/bs-ai-draft-changed-alert.vue';
import BsAiExpertiseCloseModal from '~/components/ai-skill/bs-ai-expertise-close-modal.vue';
import {
  skillCategoryLabel,
  AUDIENCES,
} from '~/helpers/ai-skill-categories.js';
import BsAiCopyPanel from '~/components/ai-skill/bs-ai-copy-panel.vue';
import mixinAiExpertiseDetails from '~/helpers/mixins/mixin-ai-expertise-details.js';
import { fetchCopyState } from '~/helpers/skills-copy.js';

export default {
  name: 'PageAiExpertiseDetail',
  components: {
    BsAiDetailHeader,
    BsAiFeedbackTab,
    BsAiExpertiseDetailsForm,
    BsAiExpertiseVersionsPanel,
    BsAiActivateModal,
    BsAiArchiveModal,
    BsAiDraftChangedAlert,
    BsAiExpertiseCloseModal,
    BsAiCopyPanel,
  },
  mixins: [
    mixinPageTitle,
    mixinAiVersionedItem({
      key: 'exp',
      idField: 'expertiseId',
      routes: {
        item: api.aiExpertise,
        versionMinor: api.aiExpertiseVersionMinor,
        versionMajor: api.aiExpertiseVersionMajor,
        version: api.aiExpertiseVersion,
        archive: api.aiExpertiseArchive,
      },
      archivedKey: 'aiSkills.expertise.archived',
    }),
    mixinAiExpertiseDetails,
  ],
  meta: { acl: acls.ACL_PLATFORM_MANAGE, sidebarModule: 'settings' },
  async asyncData({ $axios, params, error }) {
    try {
      const [exp, copyState] = await Promise.all([
        $axios.$get(api.aiExpertise(params.expertiseId)),
        fetchCopyState($axios, api.aiSkillsFollow),
      ]);
      return { exp, savedAudience: exp.audience, isCopy: copyState.isCopy };
    } catch (err) {
      return error({ statusCode: 404, message: 'Expertise not found' });
    }
  },
  data() {
    return {
      exp: null,
      // The audience stored: keeping it to the platform company again is
      // confirmed first.
      savedAudience: null,
      // On a copy, the page says where the expertise comes from (ADR 0019).
      isCopy: false,
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
    // Still kept to the platform company, or not opened yet, as stored: the
    // publication reminds it (ADR 0013).
    platformOnly() {
      return !!this.exp && this.savedAudience !== AUDIENCES.ALL;
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
    categoryLabel(value) {
      return skillCategoryLabel(this, value);
    },
    // `silent` skips the snackbar: publishing an edited draft saves it first
    // (see askActivate) and only the activation is worth announcing.
    // Returns true when the PATCH went through.
    async saveVersion({ version, silent = false }) {
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
            // The draft as the page read it: one written since is refused.
            updatedAt: this.readAtOf(version),
          }
        );
        if (!silent) {
          this.showSnackbar({
            text: this.$t('aiSkills.version.draftSaved'),
            color: 'success',
          });
        }
        return true;
      } catch (err) {
        this.handleError(err);
        return false;
      } finally {
        this.saving = false;
      }
    },
    async askActivate({ version, dirty }) {
      // Publishing means publishing what is on screen. Activation only posts
      // changelog / release notes and then replaces the local state with the
      // server response, so an unsaved draft used to be published absent AND
      // wiped off the screen without warning (review R-04). Persist it first,
      // and give up on the publish if that save fails.
      if (dirty && !(await this.saveVersion({ version, silent: true }))) {
        return;
      }
      this.activatingVersion = version;
      // Both major AND minor go through the modal: activating any version
      // instantly changes the doctrine features consume, so the impact alert
      // must show either way. Informed consent: surface which features will
      // load this expertise. Changelog/notes required for major only.
      this.activationImpact = [];
      this.saving = true;
      try {
        const res = await this.$axios.$get(
          api.aiExpertiseActivationImpact(this.exp.expertiseId)
        );
        this.activationImpact = res.matches || [];
      } catch (err) {
        this.tellWarningUnchecked();
      } finally {
        this.saving = false;
      }
      // Pre-fill changelog / release notes from the draft, shared modal.
      this.$refs.activateModal.open(version);
    },
    // Published, and opened to all when the modal says so, in one request.
    async activateVersion(payload) {
      const { versionMajor, versionMinor } = this.activatingVersion;
      const done = await this.replaceItem(
        () =>
          this.$axios.$post(
            api.aiExpertiseActivate(
              this.exp.expertiseId,
              versionMajor,
              versionMinor
            ),
            { ...payload, updatedAt: this.readAtOf(this.activatingVersion) }
          ),
        'aiSkills.version.activated'
      );
      if (!done) return;
      this.savedAudience = this.exp.audience;
      if (this.$refs.activateModal) this.$refs.activateModal.close();
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

    <bs-ai-draft-changed-alert
      v-if="draftChanged"
      :loading="saving"
      @reload="reloadItem"
    />

    <p class="text-caption text--secondary detail-meta">
      {{ exp.expertiseId }} · {{ categoryLabel(exp.category) }} ·
      <span v-if="activeVersionLabel"
        >{{ $t('aiSkills.skill.activeVersion') }} v{{
          activeVersionLabel
        }}</span
      >
      <span v-else class="text--disabled">{{
        $t('aiSkills.skill.noActiveVersion')
      }}</span>
    </p>

    <bs-ai-copy-panel
      kind="expertise"
      :item="exp"
      :is-copy="isCopy"
      @changed="reloadItem"
    />

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
      <v-tab href="#feedback">
        {{ $t('aiSkills.feedback.tab') }}
      </v-tab>
    </v-tabs>
    <v-divider />

    <v-container fluid>
      <v-tabs-items v-model="tab" class="transparent">
        <v-tab-item value="details">
          <bs-ai-expertise-details-form
            v-model="exp"
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
        <v-tab-item value="feedback">
          <bs-ai-feedback-tab
            v-if="tab === 'feedback'"
            kind="expertise"
            :reference-id="exp.expertiseId"
          />
        </v-tab-item>
      </v-tabs-items>
    </v-container>

    <bs-ai-activate-modal
      ref="activateModal"
      :loading="saving"
      :show-impact="true"
      :impact="activationImpact"
      :is-major="!!activatingVersion && activatingVersion.versionMinor === 0"
      :platform-only="platformOnly"
      @confirm="activateVersion"
    />
    <bs-ai-archive-modal
      ref="archiveModal"
      :title="$t('aiSkills.expertise.archiveTitle')"
      :body="$t('aiSkills.expertise.archiveBody')"
      :loading="saving"
      @confirm="archive"
    />
    <bs-ai-expertise-close-modal ref="closeModal" @confirm="patchDetails()" />
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
