<script>
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import * as sseHelpers from '~/helpers/server-sent-events.js';
import BsTemplateMenu from '~/components/template/menu.vue';
import BsTemplateEditForm from '~/components/template/edit-form.vue';
import BsTemplateHtmlPreview from '~/components/template/html-preview.vue';
import BsTemplateImagesList from '~/components/template/images-list.vue';

const UPDATE_AXIOS_CONFIG = Object.freeze({
  headers: { 'content-type': 'multipart/form-data' },
});

export default {
  name: 'BsPageTemplate',
  components: {
    BsTemplateMenu,
    BsTemplateEditForm,
    BsTemplateHtmlPreview,
    BsTemplateImagesList,
  },
  mixins: [mixinPageTitle],
  meta: { acl: acls.ACL_ADMIN },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const templateResponse = await $axios.$get(
        apiRoutes.templatesItem(params)
      );
      return { template: templateResponse };
    } catch (error) {
      console.log(error);
    }
  },
  data() {
    return {
      template: { group: {} },
      loading: false,
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return `template – ${this.template.name}`;
    },
    hasImages() {
      if (this.template.assets == null) return false;
      return Object.keys(this.template.assets).length > 0;
    },
  },
  mounted() {
    this.listenTemplateEvents();
  },
  beforeDestroy() {
    this.closeTemplateEvents();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    listenTemplateEvents() {
      const { $route } = this;
      const { params } = $route;
      const eventSource = new EventSource(
        apiRoutes.templatesItemEvents(params),
        {
          withCredentials: true,
        }
      );
      eventSource.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          const sseStatus = sseHelpers.getEventStatus(parsedData);
          const { payload } = parsedData;
          // update snackbar & data on end
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
          console.log(error);
          console.log(event.data);
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
      this.eventSource = false;
    },
    async updateTemplate(formData) {
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
        console.log(error);
      } finally {
        this.loading = false;
      }
    },
    async deleteTemplate() {
      const { $axios, $route } = this;
      const { params } = $route;
      try {
        this.loading = true;
        await $axios.$delete(apiRoutes.templatesItem(params));
        this.showSnackbar({
          text: this.$t('snackbars.deleted'),
          color: 'success',
        });
        this.$router.push('/templates');
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      } finally {
        this.loading = false;
      }
    },
    async generatePreviews() {
      const { $axios, $route } = this;
      const { params } = $route;
      try {
        this.loading = true;
        await $axios.$post(apiRoutes.templatesItemPreview(params));
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        // loading only error
        // • if request ok => SSE
        this.loading = false;
        console.log(error);
      }
    },
    async deleteImages() {
      const { $axios, $route } = this;
      const { params } = $route;
      try {
        this.loading = true;
        const template = await $axios.$delete(
          apiRoutes.templatesItemImages(params)
        );
        this.showSnackbar({
          text: this.$t('template.imagesRemoved'),
          color: 'success',
        });
        this.template = template;
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-template-menu
        v-model="loading"
        :template="template"
        @delete="deleteTemplate"
        @generatePreviews="generatePreviews"
      />
    </template>
    <v-row>
      <bs-template-edit-form
        v-model="template"
        :disabled="loading"
        @submit="updateTemplate"
      />
      <v-col
        v-if="template.hasMarkup"
        cols="12"
      >
        <bs-template-html-preview
          :markup="template.markup"
          :template-id="template.id"
        />
      </v-col>
      <v-col
        v-if="hasImages"
        cols="12"
      >
        <bs-template-images-list
          :assets="template.assets"
          :disabled="loading"
          :template-id="template.id"
          @delete="deleteImages"
        />
      </v-col>
    </v-row>
  </bs-layout-left-menu>
</template>
