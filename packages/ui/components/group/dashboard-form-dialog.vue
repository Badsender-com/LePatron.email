<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';

function createEmptyForm(overrides = {}) {
  return {
    name: '',
    description: '',
    integrationId: null,
    providerDashboardId: null,
    ...overrides,
  };
}

export default {
  name: 'BsDashboardFormDialog',
  mixins: [validationMixin],
  props: {
    value: {
      type: Boolean,
      default: false,
    },
    dashboard: {
      type: Object,
      default: null,
    },
    integrations: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      form: createEmptyForm(),
    };
  },
  validations: {
    form: {
      name: { required },
      integrationId: { required },
      providerDashboardId: { required },
    },
  },
  computed: {
    visible: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
    isEditing() {
      return this.dashboard !== null;
    },
    title() {
      return this.isEditing
        ? this.$t('crmIntelligence.admin.editDashboard')
        : this.$t('crmIntelligence.admin.addDashboard');
    },
  },
  watch: {
    value(isOpen) {
      if (isOpen) {
        this.initForm();
      }
    },
  },
  methods: {
    initForm() {
      if (this.dashboard) {
        this.form = {
          name: this.dashboard.name,
          description: this.dashboard.description || '',
          integrationId:
            this.dashboard.integration && this.dashboard.integration.id
              ? this.dashboard.integration.id
              : null,
          providerDashboardId: this.dashboard.providerDashboardId,
        };
      } else {
        this.form = createEmptyForm({
          integrationId:
            this.integrations.length === 1 ? this.integrations[0].id : null,
        });
      }
      this.$v.form.$reset();
    },
    save() {
      this.$v.form.$touch();
      if (this.$v.form.$invalid) return;

      this.$emit('save', {
        name: this.form.name,
        description: this.form.description,
        integrationId: this.form.integrationId,
        providerDashboardId: parseInt(this.form.providerDashboardId, 10),
      });
    },
    close() {
      this.$emit('input', false);
    },
  },
};
</script>

<template>
  <v-dialog
    :value="visible"
    max-width="600"
    persistent
    @input="visible = $event"
  >
    <v-card>
      <v-card-title>
        {{ title }}
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="form.name"
          :label="$t('crmIntelligence.admin.dashboardName')"
          outlined
          dense
          class="mb-3"
          :error-messages="
            $v.form.name.$dirty && !$v.form.name.required
              ? $t('crmIntelligence.admin.dashboardNameRequired')
              : ''
          "
        />

        <v-textarea
          v-model="form.description"
          :label="$t('crmIntelligence.admin.dashboardDescription')"
          outlined
          dense
          rows="2"
          class="mb-3"
        />

        <v-select
          v-model="form.integrationId"
          :items="integrations"
          :label="$t('crmIntelligence.admin.selectIntegration')"
          item-text="name"
          item-value="id"
          outlined
          dense
          class="mb-3"
          :error-messages="
            $v.form.integrationId.$dirty && !$v.form.integrationId.required
              ? $t('crmIntelligence.admin.integrationRequired')
              : ''
          "
        >
          <template #item="{ item }">
            <v-list-item-content>
              <v-list-item-title>{{ item.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ item.apiHost }}</v-list-item-subtitle>
            </v-list-item-content>
          </template>
        </v-select>

        <v-text-field
          v-model.number="form.providerDashboardId"
          :label="$t('crmIntelligence.admin.dashboardId')"
          :hint="$t('crmIntelligence.admin.dashboardIdHint')"
          type="number"
          outlined
          dense
          persistent-hint
          :error-messages="
            $v.form.providerDashboardId.$dirty &&
              !$v.form.providerDashboardId.required
              ? $t('crmIntelligence.admin.dashboardIdRequired')
              : ''
          "
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn color="accent" elevation="0" :loading="loading" @click="save">
          <v-icon left>
            mdi-content-save
          </v-icon>
          {{ $t('global.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
