<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsTextField from '~/components/form/bs-text-field';
import BsSelect from '~/components/form/bs-select';
import { Status } from '~/helpers/constants/status';

export default {
  name: 'BsModalCreateGroup',
  components: {
    BsModalForm,
    BsTextField,
    BsSelect,
  },
  mixins: [validationMixin],
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      group: {
        name: '',
        status: Status.DEMO,
        defaultWorkspaceName: '',
        downloadMailingWithoutEnclosingFolder: false,
        downloadMailingWithCdnImages: false,
        downloadMailingWithFtpImages: false,
        enableEmailBuilder: true,
        enableCrmIntelligence: false,
        userHasAccessToAllWorkspaces: false,
      },
    };
  },
  validations() {
    return {
      group: {
        name: { required },
        status: { required },
      },
    };
  },
  computed: {
    nameErrors() {
      const errors = [];
      if (!this.$v.group.name.$dirty) return errors;
      !this.$v.group.name.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
    statusOptions() {
      return [
        {
          text: this.$t('forms.group.status.demo'),
          value: Status.DEMO,
        },
        {
          text: this.$t('forms.group.status.active'),
          value: Status.ACTIVE,
        },
        {
          text: this.$t('forms.group.status.inactive'),
          value: Status.INACTIVE,
        },
      ];
    },
  },
  methods: {
    open() {
      this.group = {
        name: '',
        status: Status.DEMO,
        defaultWorkspaceName: '',
        downloadMailingWithoutEnclosingFolder: false,
        downloadMailingWithCdnImages: false,
        downloadMailingWithFtpImages: false,
        enableEmailBuilder: true,
        enableCrmIntelligence: false,
        userHasAccessToAllWorkspaces: false,
      };
      this.$v.$reset();
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('submit', { ...this.group });
    },
  },
};
</script>

<template>
  <bs-modal-form
    ref="modal"
    :title="$t('global.newCompany')"
    :submit-label="$t('global.create')"
    :loading="loading"
    @submit="onSubmit"
  >
    <bs-text-field
      v-model="group.name"
      :label="$t('global.companyName')"
      :error-messages="nameErrors"
      :disabled="loading"
      required
      autofocus
      @blur="$v.group.name.$touch()"
    />

    <bs-select
      v-model="group.status"
      :label="$t('forms.group.status.label')"
      :items="statusOptions"
      :disabled="loading"
      required
    />

    <bs-text-field
      v-model="group.defaultWorkspaceName"
      :label="$t('forms.group.defaultWorkspace.label')"
      :disabled="loading"
      :hint="$t('forms.group.defaultWorkspace.hint')"
    />
  </bs-modal-form>
</template>
