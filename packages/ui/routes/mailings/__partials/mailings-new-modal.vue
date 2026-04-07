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
      return Array.isArray(this.templates)
        ? this.templates.filter((template) => template.hasMarkup)
        : [];
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

      <label class="form-label">
        {{ $t('mailings.name') }}
        <span class="form-label__required">*</span>
      </label>
      <v-text-field
        v-model="defaultMailName"
        :rules="nameRule"
        solo
        flat
        dense
        hide-details="auto"
        class="form-input"
      />

      <div class="mt-8 bs-templates_container">
        <p class="font-weight-bold">
          {{ $t('mailings.creationNotice') }}
        </p>
        <v-card
          flat
          tile
          class="d-flex flex-row justify-space-around flex-wrap-reverse"
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
      <v-divider class="mt-4" />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          :disabled="!isValidToCreate"
          elevation="0"
          type="submit"
          color="accent"
        >
          {{ $t('global.add') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.bs-templates_container {
  max-height: 50vh;
  overflow: auto;
}

.form-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.6);
  margin-bottom: 0.375rem;

  &__required {
    color: #f04e23;
    margin-left: 2px;
  }
}

.form-input {
  &.v-text-field.v-text-field--solo {
    ::v-deep .v-input__slot {
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      background: #fff;
      min-height: 36px;
      padding: 0 12px;
      transition: border-color 0.2s ease;

      &:hover {
        border-color: rgba(0, 0, 0, 0.4);
      }
    }

    &.v-input--is-focused ::v-deep .v-input__slot {
      border-color: var(--v-accent-base);
    }

    &.error--text ::v-deep .v-input__slot {
      border-color: #f04e23;
    }

    ::v-deep input {
      font-size: 0.875rem;
      padding: 6px 0;
    }

    ::v-deep .v-text-field__details {
      padding: 4px 0 0 0;
      min-height: auto;
    }

    ::v-deep .v-messages__message {
      font-size: 0.75rem;
    }
  }
}
</style>
