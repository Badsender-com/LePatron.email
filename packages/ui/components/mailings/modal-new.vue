<script>
import * as apiRoutes from '~/helpers/api-routes.js';
import TemplateCard from '~/routes/mailings/__partials/template-card';

export default {
  name: 'BsMailingsModalNew',
  components: { TemplateCard },
  async asyncData(nuxtContext) {
    const { $axios } = nuxtContext;
    try {
      const { items } = await $axios.$get(apiRoutes.templates());
      return {
        templates: items.filter((template) => template.hasMarkup),
        templatesIsLoading: false,
      };
    } catch (error) {
      return { templatesIsError: true, templatesIsLoading: false };
    }
  },
  data() {
    return {
      data: {},
      show: false,
      templates: [],
    };
  },
  mounted() {
    console.log({ template: this.templates });
  },
  methods: {
    open() {
      this.show = true;
    },
    close() {
      this.show = false;
    },
    action() {
      this.close();
      this.$emit('new', this.data);
    },
  },
};
</script>

<template>
  <v-dialog v-model="show" class="bs-mailings-modal-rename" width="500">
    <v-card>
      <v-card-title class="headline">
        {{ $t(`mailings.rename`) }}
      </v-card-title>
      <v-card-text>
        <v-text-field
          id="new-mailing-name"
          v-model="data.newName"
          :label="$t(`global.name`)"
          name="new-mailing-name"
        />
      </v-card-text>
      <v-container fluid>
        <p class="text-center display-1">
          {{ $t(`mailings.creationNotice`) }}
        </p>
        <div class="page-mailings-new__templates">
          <template-card
            v-for="template in templates"
            :key="template.id"
            :template="template"
          />
        </div>
      </v-container>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t(`global.cancel`) }}
        </v-btn>
        <v-btn color="primary" @click="action">
          {{ $t(`global.update`) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
