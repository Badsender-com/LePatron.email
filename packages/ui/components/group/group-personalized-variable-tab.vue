<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import BsModalConfirm from '~/components/modal-confirm';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { mapMutations } from 'vuex';

import {
  getPersonalizedVariables,
  deletePersonalizedVariable,
  postPersonalizedVariables,
} from '~/helpers/api-routes';

export default {
  name: 'GroupPersonalizedVariableTab',
  components: {
    BsModalConfirm,
  },
  mixins: [validationMixin],
  data() {
    return {
      variables: [],
      loading: false,
      error: null,
      deleteIndex: null,
    };
  },
  validations: {
    variables: {
      $each: {
        label: { required },
        variable: { required },
      },
    },
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    tableHeaders() {
      return [
        {
          align: 'right',
          value: 'status',
          sortable: false,
          width: '2rem',
        },
        {
          text: this.$t('personalizedVariables.label'),
          align: 'left',
          value: 'label',
          sortable: false,
        },
        {
          text: this.$t('personalizedVariables.variable'),
          align: 'left',
          value: 'variable',
          sortable: false,
        },
        {
          text: this.$t('personalizedVariables.actions'),
          value: 'actions',
          sortable: false,
          align: 'center',
        },
      ];
    },
    deleteVariableName() {
      return this.deleteIndex !== null
        ? this.variables[this.deleteIndex].variable
        : '';
    },
  },
  created() {
    this.getVariables();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async getVariables() {
      this.loading = true;
      try {
        const response = await this.$axios.get(
          getPersonalizedVariables(this.groupId)
        );
        this.variables = response.data.items.map((item) => ({
          ...item,
          status: 'saved',
          deleting: false,
        }));
        this.error = null;
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },
    addRow() {
      this.variables.push({
        label: '',
        variable: '',
        status: 'new',
        _id: '',
        deleting: false,
      });
    },
    openDeleteDialog(index) {
      const variable = this.variables[index];
      if (variable.status === 'new') {
        this.variables.splice(index, 1);
      } else {
        this.deleteIndex = index;
        this.$refs.deleteDialog.open();
      }
    },
    async deleteVariable() {
      this.variables[this.deleteIndex].deleting = true;
      try {
        const variable = this.variables[this.deleteIndex];
        if (variable && variable.id) {
          await this.$axios.delete(
            deletePersonalizedVariable(this.groupId, variable.id)
          );
        }
        this.variables.splice(this.deleteIndex, 1);
        this.deleteIndex = null;
        this.error = null;
        this.showSnackbar({
          text: this.$t('personalizedVariables.snackbars.deleted'),
          color: 'success',
        });
      } catch (error) {
        this.error = error;
        this.showSnackbar({
          text: this.$t('personalizedVariables.snackbars.error'),
          color: 'error',
        });
      }
    },
    async onSubmit() {
      this.$v.$touch();
      if (!this.$v.$invalid) {
        this.loading = true;
        try {
          const variablesToSubmit = this.variables
            .filter((variable) => variable.status !== 'saved')
            .map(({ label, variable, _id, status }) => ({
              label,
              variable,
              _id: status === 'modified' ? _id : undefined,
            }));
          await this.$axios.post(postPersonalizedVariables(this.groupId), {
            personalizedVariables: variablesToSubmit,
          });
          this.getVariables();
          this.error = null;
          this.showSnackbar({
            text: this.$t('personalizedVariables.snackbars.updated'),
            color: 'success',
          });
        } catch (error) {
          this.error = error;
          this.showSnackbar({
            text: this.$t('personalizedVariables.snackbars.error'),
            color: 'error',
          });
        } finally {
          this.loading = false;
        }
      }
    },
    updateVariable(index, key, value) {
      this.variables[index][key] = value;
      if (this.variables[index].status === 'saved') {
        this.variables[index].status = 'modified';
      }
      this.$v.variables.$each[index][key].$touch();
    },
    validationErrors(index, key) {
      const errors = [];
      if (!this.$v.variables.$each[index][key].$dirty) return errors;
      !this.$v.variables.$each[index][key].required &&
        errors.push(this.$t('personalizedVariables.validation.required'));
      return errors;
    },
  },
};
</script>

<template>
  <div class="group-personalized-variable-tab">
    <v-data-table
      :headers="tableHeaders"
      :items="variables"
      :loading="loading"
      :hide-default-footer="true"
      :disable-pagination="true"
      class="custom-table-class"
    >
      <template #item.status="{ item }">
        <v-icon v-if="item.status === 'new'" small color="black">
          mdi-plus
        </v-icon>
        <v-icon v-else-if="item.status === 'modified'" small color="black">
          mdi-pencil-outline
        </v-icon>
      </template>
      <template #item.label="{ item, index }">
        <v-text-field
          v-model="item.label"
          :label="$t('personalizedVariables.label')"
          :error-messages="validationErrors(index, 'label')"
          @input="updateVariable(index, 'label', $event)"
          @blur="$v.variables.$each[index].label.$touch()"
        />
      </template>
      <template #item.variable="{ item, index }">
        <v-text-field
          v-model="item.variable"
          :label="$t('personalizedVariables.variable')"
          :error-messages="validationErrors(index, 'variable')"
          @input="updateVariable(index, 'variable', $event)"
          @blur="$v.variables.$each[index].variable.$touch()"
        />
      </template>
      <template #item.actions="{ index }">
        <v-progress-circular v-if="variables[index].deleting" indeterminate />
        <v-btn v-else icon @click="openDeleteDialog(index)">
          <v-icon>mdi-delete</v-icon>
        </v-btn>
      </template>
    </v-data-table>
    <div class="button-container">
      <v-btn class="add-row-button" text @click.prevent="addRow">
        <v-icon left small color="black">
          mdi-plus
        </v-icon>
        <span>{{ $t('personalizedVariables.addRow') }}</span>
      </v-btn>
      <v-spacer />
      <v-btn elevation="0" color="accent" :disabled="loading" @click="onSubmit">
        {{ $t('personalizedVariables.save') }}
      </v-btn>
    </div>
    <bs-modal-confirm
      ref="deleteDialog"
      :title="`${$t('personalizedVariables.delete')} ${deleteVariableName}?`"
      :action-label="$t('personalizedVariables.delete')"
      @confirm="deleteVariable"
    >
      {{ $t('personalizedVariables.deleteNotice') }}
    </bs-modal-confirm>
  </div>
</template>

<style>
.group-personalized-variable-tab {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 10rem);
  gap: 2rem;
}
.custom-table-class {
  flex-grow: 1;
  overflow-y: auto;
}
.button-container {
  display: flex;
  justify-content: space-between;
}
.custom-table-class tbody tr td {
  border: none !important;
}
.custom-table-class tbody tr td:first-child {
  padding: 0 !important;
}
.add-row-button {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
</style>
