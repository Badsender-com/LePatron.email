<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';
import TrackingParamsTab from '~/components/group/tracking-params-tab.vue';
import TemplateTrackingTab from '~/components/template/template-tracking-tab.vue';
import { IS_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsPageSettingsTracking',
  components: {
    BsPageHeader,
    TrackingParamsTab,
    TemplateTrackingTab,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: [acls.ACL_GROUP_ADMIN, acls.ACL_ADMIN],
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const [groupResponse, templatesResponse] = await Promise.all([
        $axios.$get(apiRoutes.groupsItem(params)),
        $axios.$get(apiRoutes.groupsItemTemplates(params)),
      ]);
      return {
        group: groupResponse,
        templates: templatesResponse.items || [],
      };
    } catch (error) {
      console.error(error);
      return { group: {}, templates: [] };
    }
  },
  data() {
    return {
      group: {},
      templates: [],
      expandedTemplateId: null,
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
    }),
    showGroupBadge() {
      return this.isAdmin && this.group.name;
    },
  },
  methods: {
    async refreshGroup() {
      const {
        $axios,
        $route: { params },
      } = this;
      try {
        const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
        this.group = groupResponse;
      } catch (error) {
        console.error('[Tracking] Failed to refresh group:', error);
      }
    },
    async refreshTemplates() {
      const {
        $axios,
        $route: { params },
      } = this;
      try {
        const templatesResponse = await $axios.$get(
          apiRoutes.groupsItemTemplates(params)
        );
        this.templates = templatesResponse.items || [];
      } catch (error) {
        console.error('[Tracking] Failed to refresh templates:', error);
      }
    },
    templateConfigSummary(template) {
      const cfg = template && template.trackingConfig;
      if (!cfg || !cfg.enabled) {
        return this.$t('trackingConfig.templates.statusInherits');
      }
      if (cfg.overrideGroupTracking) {
        return this.$t('trackingConfig.templates.statusOverride');
      }
      return this.$t('trackingConfig.templates.statusMerge');
    },
    toggleTemplate(templateId) {
      this.expandedTemplateId =
        this.expandedTemplateId === templateId ? null : templateId;
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
        {{ $t('trackingConfig.title') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <!-- Group-level tracking config -->
        <tracking-params-tab :group="group" @update="refreshGroup" />

        <!-- Per-template overrides -->
        <div class="templates-section">
          <h3 class="templates-section__title">
            {{ $t('trackingConfig.templates.sectionTitle') }}
          </h3>
          <p class="templates-section__description">
            {{ $t('trackingConfig.templates.sectionDescription') }}
          </p>

          <div v-if="templates.length === 0" class="templates-section__empty">
            {{ $t('trackingConfig.templates.empty') }}
          </div>

          <div v-else class="templates-list">
            <div
              v-for="template in templates"
              :key="template.id"
              class="template-row"
            >
              <button
                type="button"
                class="template-row__header"
                @click="toggleTemplate(template.id)"
              >
                <span class="template-row__name">{{ template.name }}</span>
                <span class="template-row__status">{{
                  templateConfigSummary(template)
                }}</span>
                <span
                  class="template-row__chevron"
                  :class="{
                    'template-row__chevron--expanded':
                      expandedTemplateId === template.id,
                  }"
                  aria-hidden="true"
                >
                  ›
                </span>
              </button>
              <div
                v-if="expandedTemplateId === template.id"
                class="template-row__body"
              >
                <template-tracking-tab
                  :template="template"
                  :group-tracking-config="group && group.trackingConfig"
                  @update="refreshTemplates"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </v-container>
  </div>
</template>

<style lang="scss" scoped>
.templates-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.87);
    margin: 0 0 4px 0;
  }

  &__description {
    color: rgba(0, 0, 0, 0.6);
    font-size: 14px;
    margin-bottom: 16px;
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: rgba(0, 0, 0, 0.4);
    font-style: italic;
    font-size: 14px;
    border: 1px dashed rgba(0, 0, 0, 0.12);
    border-radius: 8px;
  }
}

.templates-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-row {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;

  &__header {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.02);
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;

    &:hover {
      background: rgba(0, 172, 220, 0.05);
    }
  }

  &__name {
    flex: 1;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.87);
    font-size: 14px;
  }

  &__status {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
    font-style: italic;
  }

  &__chevron {
    font-size: 18px;
    color: rgba(0, 0, 0, 0.4);
    transition: transform 0.15s ease;
    display: inline-block;

    &--expanded {
      transform: rotate(90deg);
    }
  }

  &__body {
    padding: 16px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
  }
}
</style>
