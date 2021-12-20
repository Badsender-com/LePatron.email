<script>
import TemplateCard from '~/routes/mailings/__partials/template-card';
import BsModalConfirm from '~/components/modal-confirm';
import MailingsBreadcrumbs from '~/routes/mailings/__partials/mailings-breadcrumbs';
import mixinCreateMailing from '~/helpers/mixins/mixin-create-mailing';
import { TEMPLATE } from '~/store/template';
import { mapState } from 'vuex';

export default {
  name: 'MailingsModalNew',
  components: {
    BsModalConfirm,
    MailingsBreadcrumbs,
    TemplateCard,
  },
  mixins: [mixinCreateMailing],
  props: {
    loadingParent: { type: Boolean, default: false },
  },
  data() {
    return {
      defaultMailName: '',
      selectedTemplate: {},
      nameRule: [(v) => !!v || this.$t('forms.workspace.inputError')],
    };
  },
  computed: {
    destinationLabel() {
      return `${this.$t('global.location')} :`;
    },
    templatesHasMarkup() {
      return this.templates?.filter((template) => template.hasMarkup);
    },
    isValidToCreate() {
      return (
        !!this.selectedTemplate?.id &&
        !!this.defaultMailName &&
        !this.loadingParent
      );
    },
    ...mapState(TEMPLATE, ['templates', 'templateLoading']),
  },
  methods: {
    open() {
      this.$refs.createNewMailModal.open();
    },
    close() {
      this.$refs.form?.reset();
      this.$refs.createNewMailModal.close();
    },
    async submit() {
      this.$refs.form.validate();
      if (this.isValidToCreate) {
        await this.$emit('create-new-mail', {
          defaultMailName: this.defaultMailName,
          template: this.selectedTemplate,
        });
        if (!this.loadingParent) {
          this.close();
        }
      }
    },
    selectTemplate(template) {
      this.selectedTemplate = template;
    },
    checkIsSelectedTemplate(template) {
      return this.selectedTemplate?.id === template?.id;
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="createNewMailModal"
    modal-width="1000"
    :title="$t('global.newMailing')"
    :is-form="true"
  >
    <v-form ref="form" @submit.prevent="submit">
      <div class="d-flex align-center mb-2">
        <div class="font-weight-bold">
          {{ destinationLabel }}
        </div>
        <div class="pa-2">
          <mailings-breadcrumbs />
        </div>
      </div>

      <v-text-field
        v-model="defaultMailName"
        class="pt-1"
        :rules="nameRule"
        :label="this.$t('mailings.name')"
        required
      />

      <div class="mt-8 bs-templates_container">
        <p class="font-weight-bold">
          {{ $t('mailings.creationNotice') }}
        </p>
        <v-card
          class="d-flex flex-row justify-space-around flex-wrap-reverse"
          flat
          tile
        >
          <template-card
            v-for="template in templatesHasMarkup"
            :key="template.id"
            :is-selected="checkIsSelectedTemplate(template)"
            :template="template"
            @click="selectTemplate"
          />
        </v-card>
      </div>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn :disabled="!isValidToCreate" type="submit" color="primary">
          {{ $t('global.add') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>

<style>
.bs-templates_container {
  max-height: 500px;
  overflow: auto;
}
</style>
