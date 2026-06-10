<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { IS_ADMIN, USER } from '~/store/user';
import { SET_ACTIVE_MODULE, SET_LAST_GROUP_ID } from '~/store/sidebar';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import * as sseHelpers from '~/helpers/server-sent-events.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsTemplateForm from '~/components/template/form.vue';
import { Trash2 } from 'lucide-vue';

const UPDATE_AXIOS_CONFIG = Object.freeze({
  headers: { 'content-type': 'multipart/form-data' },
});

export default {
  name: 'BsPageTemplate',
  components: {
    BsPageHeader,
    BsTemplateForm,
    LucideTrash2: Trash2,
  },
  mixins: [mixinPageTitle],
  meta: { acl: acls.ACL_ADMIN },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const templateResponse = await $axios.$get(
        apiRoutes.templatesItem(params)
      );
      // Fetch the group for the settings nav
      let group = templateResponse.group || {};
      if (group.id) {
        try {
          const groupResponse = await $axios.$get(
            apiRoutes.groupsItem({ groupId: group.id })
          );
          group = groupResponse;
        } catch (error) {
          console.error('Failed to fetch group details:', error);
        }
      }
      return { template: templateResponse, group };
    } catch (error) {
      console.error(error);
      return {
        template: { name: '', description: '', group: {} },
        group: {},
      };
    }
  },
  data() {
    return {
      template: { name: '', description: '', group: {} },
      group: {},
      loading: false,
      eventSource: null,
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    title() {
      return `${this.$tc('global.template', 1)} – ${this.template.name}`;
    },
    pageTitle() {
      return this.template.name || this.$tc('global.template', 1);
    },
    groupName() {
      return this.group.name || '';
    },
    showGroupBadge() {
      return this.isAdmin && this.groupName;
    },
    backRoute() {
      if (this.group.id) {
        return `/groups/${this.group.id}/settings/templates`;
      }
      return '/templates';
    },
  },
  mounted() {
    // Sidebar lives outside this page; tell it which group context applies
    // and force the SETTINGS module so navigation stays coherent on /templates/:id.
    this.$store.commit(`sidebar/${SET_ACTIVE_MODULE}`, 'settings');
    if (this.group?.id) {
      this.$store.commit(`sidebar/${SET_LAST_GROUP_ID}`, this.group.id);
    }
    if (this.template.id) {
      this.listenTemplateEvents();
    }
  },
  beforeDestroy() {
    this.closeTemplateEvents();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    // SSE for template processing feedback
    listenTemplateEvents() {
      const { $route } = this;
      const { params } = $route;
      const eventSource = new EventSource(
        apiRoutes.templatesItemEvents(params),
        { withCredentials: true }
      );
      eventSource.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          const sseStatus = sseHelpers.getEventStatus(parsedData);
          const { payload } = parsedData;

          if (sseStatus.isCreate || sseStatus.isUpdate) {
            this.loading = true;
            this.showSnackbar({ text: payload.message, color: 'info' });
          } else if (sseStatus.isError) {
            this.loading = false;
            this.showSnackbar({ text: payload.message, color: 'error' });
          } else if (sseStatus.isEnd) {
            this.loading = false;
            this.showSnackbar({ text: payload.message, color: 'success' });
            if (payload.template !== null) {
              this.template = payload.template;
            }
          }
        } catch (error) {
          console.error(error);
        }
      };
      eventSource.onerror = (event) => {
        console.dir({ eventSourceError: event });
      };
      this.eventSource = eventSource;
    },

    closeTemplateEvents() {
      if (!this.eventSource) return;
      this.eventSource.close();
      this.eventSource = null;
    },

    // Form submission
    async onSubmit(formData) {
      const { $axios, $route } = this;
      const { params } = $route;
      try {
        this.loading = true;
        const template = await $axios.$put(
          apiRoutes.templatesItem(params),
          formData,
          UPDATE_AXIOS_CONFIG
        );
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
        this.template = template;
        this.mixinPageTitleUpdateTitle(this.title);
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.error(error);
      } finally {
        this.loading = false;
      }
    },

    // Delete template
    async onDelete() {
      const { $axios, $route } = this;
      const { params } = $route;
      try {
        this.loading = true;
        await $axios.$delete(apiRoutes.templatesItem(params));
        this.showSnackbar({
          text: this.$t('snackbars.deleted'),
          color: 'success',
        });
        this.$router.push(this.backRoute);
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.error(error);
      } finally {
        this.loading = false;
      }
    },

    // Delete images
    async onDeleteImages() {
      const { $axios, $route } = this;
      const { params } = $route;
      try {
        this.loading = true;
        const template = await $axios.$delete(
          apiRoutes.templatesItemImages(params)
        );
        this.showSnackbar({
          text: this.$t('templates.imagesRemoved'),
          color: 'success',
        });
        this.template = template;
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.error(error);
      } finally {
        this.loading = false;
      }
    },

    // Open delete confirmation (accessed via $refs from form)
    confirmDelete() {
      this.$refs.templateForm.confirmDelete();
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
        {{ pageTitle }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ groupName }}
        </v-chip>
      </template>
      <template #actions>
        <v-btn
          outlined
          color="error"
          :disabled="loading"
          @click="confirmDelete"
        >
          <lucide-trash2 :size="18" class="mr-2" />
          {{ $t('global.delete') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid>
      <bs-template-form
        ref="templateForm"
        :template="template"
        :groups="[]"
        :is-edit-mode="true"
        :disabled="loading"
        @submit="onSubmit"
        @delete="onDelete"
        @deleteImages="onDeleteImages"
      />
    </v-container>
  </div>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
