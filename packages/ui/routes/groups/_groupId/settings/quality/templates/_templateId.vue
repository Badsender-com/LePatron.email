<script>
import { mapGetters } from 'vuex';
import { EyeOff, Lock, Plus } from 'lucide-vue';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import {
  TEMPLATE,
  exceptionsOf,
  generalOf,
} from '~/helpers/quality-exceptions.js';
import { loadQualitySettings } from '~/helpers/quality-settings.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import mixinUnsavedChanges from '~/helpers/mixins/mixin-unsaved-changes.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsBreadcrumb from '~/components/layout/bs-breadcrumb.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsQualityExceptionsEditor from '~/components/quality/quality-exceptions-editor.vue';
import { CAN, USER } from '~/store/user';
import { CAPABILITIES } from '../../../../../../../shared/access/roles.js';

const CATALOGUE_ORDER = Object.keys(CHECKS);

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
    EyeOff,
    Lock,
    Plus,
    BsPageHeader,
    BsBreadcrumb,
    BsModalConfirm,
    BsQualityExceptionsEditor,
  },
  mixins: [mixinSettingsTitle, mixinUnsavedChanges, mixinQualityTexts],
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
    // The general exceptions this template does not replace, as edited.
    appliedGeneral() {
      const general = exceptionsOf(this.group.qualitySettings);
      const applied = generalOf(this.group.qualitySettings);
      return CATALOGUE_ORDER.filter(
        (id) => general[id] && !this.ownIds.includes(id)
      ).map((id) => ({
        id,
        state: applied[id].state,
        text: this.appliedText(id, applied[id]),
      }));
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
      <template v-if="template" #actions>
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

          <section class="applied">
            <h2 class="applied__title">
              {{ $t('qualitySettings.template.applied') }}
            </h2>
            <i18n
              v-if="appliedGeneral.length"
              path="qualitySettings.template.appliedFrom"
              tag="p"
              class="applied__intro"
            >
              <template #link>
                <nuxt-link
                  :to="qualityRoute"
                  v-text="$t('qualitySettings.template.appliedFromLink')"
                />
              </template>
            </i18n>
            <p v-else class="applied__intro">
              {{ $t('qualitySettings.template.appliedNone') }}
              <nuxt-link :to="qualityRoute">
                {{ $t('qualitySettings.template.appliedLink') }}
              </nuxt-link>
            </p>
            <ul v-if="appliedGeneral.length" class="applied__list">
              <li v-for="item in appliedGeneral" :key="item.id">
                <span class="applied__name">{{ checkName(item.id) }}</span>
                <span class="applied__text">
                  <lock
                    v-if="item.state === 'blocking'"
                    :size="14"
                    class="applied__icon applied__icon--error"
                  />
                  <eye-off
                    v-else-if="item.state === 'off'"
                    :size="14"
                    class="applied__icon"
                  />
                  {{ item.text }}
                </span>
              </li>
            </ul>
          </section>
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
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      gap: 4px 16px;
      padding: 14px 16px;
      font-size: 0.875rem;

      & + li {
        border-top: 1px solid var(--gray-300);
      }
    }
  }

  &__name {
    color: var(--gray-900);
  }

  &__text,
  &__intro {
    color: var(--gray-700);
    font-size: 0.875rem;
  }

  &__intro {
    margin: 0 0 12px;

    a {
      color: var(--v-accent-base);
    }
  }

  &__text {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  &__icon--error {
    color: var(--v-error-base);
  }
}
</style>
