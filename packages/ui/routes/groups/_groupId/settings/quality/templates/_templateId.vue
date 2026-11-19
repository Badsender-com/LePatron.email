<script>
import { mapGetters } from 'vuex';
import { Plus } from 'lucide-vue';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { TEMPLATE } from '~/helpers/quality-exceptions.js';
import { loadQualitySettings } from '~/helpers/quality-settings.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import mixinUnsavedChanges from '~/helpers/mixins/mixin-unsaved-changes.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsBreadcrumb from '~/components/layout/bs-breadcrumb.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsQualityAppliedGeneral from '~/components/quality/quality-applied-general.vue';
import BsQualityExceptionsEditor from '~/components/quality/quality-exceptions-editor.vue';
import { CAN, USER } from '~/store/user';
import { CAPABILITIES } from '../../../../../../../shared/access/roles.js';

// A template's own exceptions, over the general settings of its group
// (docs/adr/0009-quality-settings-per-group-and-template.md). The template is
// looked up among its group's: an address naming another group's template
// finds nothing. A list that cannot be read is a load error, never a
// template not found: one asks to try again, the other to go back.
async function loadPage(nuxtContext) {
  const { group, templates, loadError } = await loadQualitySettings(
    nuxtContext
  );
  const template =
    templates.find((t) => t.id === nuxtContext.params.templateId) || null;
  return { group, template, loadError };
}

export default {
  name: 'BsPageSettingsQualityTemplate',
  components: {
    Plus,
    BsPageHeader,
    BsBreadcrumb,
    BsModalConfirm,
    BsQualityAppliedGeneral,
    BsQualityExceptionsEditor,
  },
  mixins: [mixinSettingsTitle, mixinUnsavedChanges],
  meta: {
    acl: acls.ACL_GROUP_MANAGE,
  },
  asyncData(nuxtContext) {
    return loadPage(nuxtContext);
  },
  data() {
    return {
      group: {},
      template: null,
      loadError: false,
      reloading: false,
      // The checks the template sets, as edited (saved or not).
      ownIds: [],
    };
  },
  head() {
    const parts = [this.$t('qualitySettings.title'), this.settingsTitle];
    if (this.template) parts.unshift(this.template.name);
    return { title: parts.join(' · ') };
  },
  computed: {
    ...mapGetters(USER, { can: CAN }),
    showGroupBadge() {
      return this.can(CAPABILITIES.PLATFORM_MANAGE) && this.group.name;
    },
    level() {
      return TEMPLATE;
    },
    qualityRoute() {
      return `/groups/${this.$route.params.groupId}/settings/quality`;
    },
    templatesRoute() {
      return `${this.qualityRoute}?tab=templates`;
    },
    breadcrumb() {
      return [
        { text: this.$t('qualitySettings.title'), to: this.qualityRoute },
        {
          text: this.$tc('global.template', 2),
          to: this.templatesRoute,
        },
        { text: this.template ? this.template.name : '…', to: null },
      ];
    },
  },
  methods: {
    async reload() {
      this.reloading = true;
      try {
        Object.assign(
          this,
          await loadPage({
            $axios: this.$axios,
            params: this.$route.params,
            store: this.$store,
            app: { i18n: this.$i18n },
          })
        );
      } finally {
        this.reloading = false;
      }
    },

    saveTemplate(payload) {
      return this.$axios.$put(
        apiRoutes.templatesItemQualitySettings({
          templateId: this.template.id,
        }),
        payload
      );
    },

    // The PUT answers with the template's settings as stored now: nothing
    // to refetch.
    onSaved(response) {
      this.template = {
        ...this.template,
        qualitySettings: (response && response.qualitySettings) || null,
      };
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
      <template #breadcrumb>
        <bs-breadcrumb :items="breadcrumb" />
      </template>
      <!-- Only with the editor mounted: a group that cannot be read leaves
           the template found but the editor out. -->
      <template v-if="template && !loadError" #actions>
        <v-btn color="accent" elevation="0" @click="$refs.editor.openAdd()">
          <plus :size="16" class="mr-1" />
          {{ $t('qualitySettings.addException') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <v-alert v-if="loadError" type="error" outlined role="alert">
          {{ $t('qualitySettings.page.loadError') }}
          <template #append>
            <v-btn text color="error" :loading="reloading" @click="reload">
              {{ $t('qualitySettings.page.retry') }}
            </v-btn>
          </template>
        </v-alert>
        <p v-else-if="!template" class="quality-intro">
          {{ $t('qualitySettings.template.notFound') }}
          <nuxt-link :to="templatesRoute">
            {{ $t('qualitySettings.page.backToTemplates') }}
          </nuxt-link>
        </p>
        <template v-else>
          <div class="quality-template__heading">
            <h1 class="quality-template__title">{{ template.name }}</h1>
            <v-chip v-if="showGroupBadge" small outlined color="accent">
              {{ group.name }}
            </v-chip>
          </div>
          <p class="quality-intro">
            {{ $t('qualitySettings.template.intro') }}
          </p>
          <bs-quality-exceptions-editor
            ref="editor"
            :level="level"
            :settings="template.qualitySettings || null"
            :general-settings="group.qualitySettings || null"
            :group-id="$route.params.groupId"
            :save="saveTemplate"
            @changes="unsavedChanges = $event"
            @exceptions="ownIds = $event"
            @saved="onSaved"
          />

          <bs-quality-applied-general
            :general-settings="group.qualitySettings || null"
            :own-ids="ownIds"
            :quality-route="qualityRoute"
          />
        </template>
      </div>
    </v-container>
    <bs-modal-confirm
      ref="leaveModal"
      persistent
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
.quality-template__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.quality-template__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
}

.quality-intro {
  margin: 8px 0 16px;
  font-size: 0.875rem;
  color: var(--gray-700);
}
</style>
