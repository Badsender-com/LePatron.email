<script>
import { mapGetters } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import { overrideCount } from '~/helpers/quality-settings.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupQualitySettingsTab from '~/components/group/quality-settings-tab.vue';
import BsTemplateQualitySettings from '~/components/template/template-quality-settings.vue';
import { IS_ADMIN, USER } from '~/store/user';

// The quality control's settings of a group and of its templates
// (docs/adr/0004-quality-settings-per-group-and-template.md): a super admin
// for any group, a company admin for their own.
export default {
  name: 'BsPageSettingsQuality',
  components: {
    BsPageHeader,
    BsGroupQualitySettingsTab,
    BsTemplateQualitySettings,
  },
  mixins: [mixinSettingsTitle],
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
    async refreshTemplates() {
      try {
        const response = await this.$axios.$get(
          apiRoutes.groupsItemTemplates(this.$route.params)
        );
        this.templates = response.items || [];
      } catch (error) {
        console.error('[Quality] Failed to refresh the templates:', error);
      }
    },
    templateSummary(template) {
      const count = overrideCount(template && template.qualitySettings);
      return count
        ? this.$t('qualitySettings.templateOverrides', { count })
        : this.$t('qualitySettings.templateInherits');
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
        {{ $t('qualitySettings.title') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <bs-group-quality-settings-tab :group="group" @update="refreshGroup" />

        <div class="templates-section">
          <h3 class="templates-section__title">
            {{ $t('qualitySettings.templatesTitle') }}
          </h3>
          <p class="templates-section__description">
            {{ $t('qualitySettings.templatesDescription') }}
          </p>

          <div v-if="templates.length === 0" class="templates-section__empty">
            {{ $t('qualitySettings.templatesEmpty') }}
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
                :aria-expanded="
                  expandedTemplateId === template.id ? 'true' : 'false'
                "
                @click="toggleTemplate(template.id)"
              >
                <span class="template-row__name">{{ template.name }}</span>
                <span class="template-row__status">{{
                  templateSummary(template)
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
                <bs-template-quality-settings
                  :template="template"
                  :group-settings="group && group.qualitySettings"
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
  border-top: 1px solid var(--gray-300);

  &__title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--gray-900);
    margin: 0 0 0.25rem 0;
  }

  &__description {
    color: var(--gray-700);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: var(--gray-700);
    font-style: italic;
    font-size: 0.875rem;
    border: 1px dashed var(--gray-300);
    border-radius: 8px;
  }
}

.templates-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-row {
  border: 1px solid var(--gray-300);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;

  &__header {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    background: var(--gray-50, #fafafa);
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }

  &__name {
    flex: 1;
    font-weight: 600;
    color: var(--gray-900);
  }

  &__status {
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  &__chevron {
    transition: transform 0.2s ease;

    &--expanded {
      transform: rotate(90deg);
    }
  }

  &__body {
    padding: 16px;
    border-top: 1px solid var(--gray-300);
  }
}
</style>
