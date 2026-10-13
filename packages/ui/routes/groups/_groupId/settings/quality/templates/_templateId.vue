<script>
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import { TEMPLATE, exceptionsOf } from '~/helpers/quality-exceptions.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import mixinUnsavedChanges from '~/helpers/mixins/mixin-unsaved-changes.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsBreadcrumb from '~/components/layout/bs-breadcrumb.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsQualityExceptionsEditor from '~/components/quality/quality-exceptions-editor.vue';

const CATALOGUE_ORDER = Object.keys(CHECKS);

// A template's own exceptions, over the general settings of its group
// (docs/adr/0009-quality-settings-per-group-and-template.md). The template is
// looked up among its group's: an address naming another group's template
// finds nothing.
async function fetchTemplates(nuxtContext) {
  try {
    const response = await nuxtContext.$axios.$get(
      apiRoutes.groupsItemTemplates(nuxtContext.params)
    );
    return response.items || [];
  } catch (error) {
    console.error('[Quality] Failed to load the templates:', error);
    return [];
  }
}

export default {
  name: 'BsPageSettingsQualityTemplate',
  components: {
    BsPageHeader,
    BsBreadcrumb,
    BsModalConfirm,
    BsQualityExceptionsEditor,
  },
  mixins: [mixinSettingsTitle, mixinUnsavedChanges, mixinQualityTexts],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    const [groupData, templates] = await Promise.all([
      safeFetchGroup(nuxtContext),
      fetchTemplates(nuxtContext),
    ]);
    const template =
      templates.find((t) => t.id === nuxtContext.params.templateId) || null;
    return { ...groupData, template };
  },
  data() {
    return { group: {}, template: null };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    level() {
      return TEMPLATE;
    },
    qualityRoute() {
      return `/groups/${this.$route.params.groupId}/settings/quality`;
    },
    breadcrumb() {
      return [
        { text: this.$t('qualitySettings.title'), to: this.qualityRoute },
        {
          text: this.$tc('global.template', 2),
          to: `${this.qualityRoute}?tab=templates`,
        },
        { text: this.template ? this.template.name : '…', to: null },
      ];
    },
    // The general exceptions this template has not replaced.
    appliedGeneral() {
      const general = exceptionsOf(this.group.qualitySettings);
      const own = exceptionsOf(this.template && this.template.qualitySettings);
      return CATALOGUE_ORDER.filter(
        (id) => general[id] && !own[id]
      ).map((id) => ({ id, text: this.exceptionText(id, general[id]) }));
    },
  },
  methods: {
    saveTemplate(payload) {
      return this.$axios.$put(
        apiRoutes.templatesItemQualitySettings({
          templateId: this.template.id,
        }),
        payload
      );
    },

    async refresh() {
      const templates = await fetchTemplates({
        $axios: this.$axios,
        params: this.$route.params,
      });
      this.template =
        templates.find((t) => t.id === this.$route.params.templateId) || null;
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
      <template v-if="template" #actions>
        <v-btn color="accent" elevation="0" @click="$refs.editor.openAdd()">
          {{ $t('qualitySettings.addException') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <p v-if="!template" class="quality-intro">
          {{ $t('qualitySettings.template.notFound') }}
        </p>
        <template v-else>
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
            @saved="refresh"
          />

          <section class="applied">
            <h3 class="applied__title">
              {{ $t('qualitySettings.template.applied') }}
            </h3>
            <p v-if="!appliedGeneral.length" class="applied__none">
              {{ $t('qualitySettings.template.appliedNone') }}
            </p>
            <ul v-else class="applied__list">
              <li v-for="item in appliedGeneral" :key="item.id">
                <span class="applied__name">{{ checkName(item.id) }}</span>
                <span class="applied__text">{{ item.text }}</span>
              </li>
            </ul>
            <p class="applied__more">
              <template v-if="appliedGeneral.length">
                {{ $t('qualitySettings.general.others') }}
              </template>
              <nuxt-link :to="qualityRoute">
                {{ $t('qualitySettings.template.appliedLink') }}
              </nuxt-link>
            </p>
          </section>
        </template>
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

.applied {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--gray-300);

  &__title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--gray-900);
    margin: 0 0 8px;
  }

  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
    border: 1px solid var(--gray-300);
    border-radius: 8px;

    li {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 4px 16px;
      padding: 10px 16px;
      font-size: 0.8125rem;

      & + li {
        border-top: 1px solid var(--gray-300);
      }
    }
  }

  &__name {
    font-weight: 600;
    color: var(--gray-900);
  }

  &__text,
  &__none,
  &__more {
    color: var(--gray-700);
    font-size: 0.8125rem;
  }

  &__more {
    margin-top: 8px;
  }
}
</style>
