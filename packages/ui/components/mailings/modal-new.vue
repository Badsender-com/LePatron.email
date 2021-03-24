<script>
import * as apiRoutes from '~/helpers/api-routes.js';
import TemplateCard from '~/routes/mailings/__partials/template-card';
import BsModalConfirm from '~/components/modal-confirm';

export default {
  name: 'BsMailingsModalNew',
  components: {
    BsModalConfirm,
    TemplateCard,
  },
  data() {
    return {
      templates: [],
      selectedTemplate: {},
      isNewMailFormValid: true,
      templatesIsLoading: true,
      templatesIsError: false,
      nameRule: [
        (v) => v === this.data?.name || this.$t('forms.workspace.inputError'),
      ],
    };
  },
  async mounted() {
    this.templatesIsLoading = false;
    const { $axios } = this;
    try {
      const { items } = await $axios.$get(apiRoutes.templates());
      this.templates = items.filter((template) => template.hasMarkup);
    } catch (error) {
      this.templatesIsError = true;
    } finally {
      this.templatesIsLoading = false;
    }
  },
  methods: {
    open(workspaceId) {
      this.data = workspaceId;
      this.$refs.createNewMailModal.open();
    },
    close() {
      this.$refs.form.reset();
      this.$refs.createNewMailModal.close();
    },
    action() {
      this.$refs.form.validate();
      console.log(this.$refs.form.values());
      if (this.valid) {
        this.close();
        this.$emit('create-new-mail', {
          defaultMailName: this.$refs.form.values(),
        });
      }
    },
    selectTemplate(template) {
      this.selectedTemplate = template;
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="createNewMailModal"
    :title="`${this.$t('global.mailing')}`"
    :is-form="true"
  >
    <v-form ref="form" v-model="valid" @submit.prevent="submit">
      <mailings-breadcrumbs />
      <v-text-field
        :rules="nameRule"
        :label="this.$t('mailings.name')"
        required
      />
      <template-card
        v-for="template in templates"
        :key="template.id"
        :template="selectedTemplate"
        @click="selectTemplate"
      />
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn type="submit" color="error">
          {{ $t('global.newMailing') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>
