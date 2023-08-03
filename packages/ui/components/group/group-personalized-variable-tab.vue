<script>
import { required } from 'vuelidate/lib/validators';
import axios from 'axios';

export default {
  name: 'GroupPersonalizedVariableTab',
  data() {
    return {
      variables: [],
      loading: false,
      error: null,
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
          align: 'left',
          value: 'status',
          sortable: false,
        },
        {
          text: this.$t('variables.label'),
          align: 'left',
          value: 'label',
          sortable: false,
        },
        {
          text: this.$t('variables.variable'),
          align: 'left',
          value: 'variable',
          sortable: false,
        },
        { text: '', value: 'actions', sortable: false, align: 'center' },
      ];
    },
  },
  created() {
    this.getVariables();
  },
  methods: {
    async getVariables() {
      console.log(this.variables, 'first');
      this.loading = true;
      try {
        const response = await axios.get(
          `/api/groups/${this.groupId}/personalized-variables`
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
        _id: undefined,
        deleting: false,
      });
    },
    console() {
      return console;
    },
    async submit() {
      this.$v.$touch();
      if (!this.$v.$invalid) {
        this.loading = true;
        try {
          console.log(this.variables);
          const variablesToSubmit = this.variables
            .filter((variable) => variable.status !== 'saved')
            .map(({ label, variable, _id, status }) => ({
              label,
              variable,
              _id: status === 'modified' ? _id : undefined,
            }));
          await axios.post(
            `/api/groups/${this.groupId}/personalized-variables`,
            { personalizedVariables: variablesToSubmit }
          );
          this.variables = this.variables.map((item) => ({
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
      }
    },
    async deleteVariable(index) {
      console.log(this.variables[index]);
      this.variables[index].deleting = true;
      try {
        const variable = this.variables[index];
        if (variable.id) {
          await axios.delete(
            `/api/groups/${this.groupId}/personalized-variables/${variable.id}`
          );
        }
        this.variables.splice(index, 1);
        this.error = null;
      } catch (error) {
        this.error = error;
      }
    },
    updateVariable(index, key, value) {
      this.variables[index][key] = value;
      if (this.variables[index].status === 'saved') {
        this.variables[index].status = 'modified';
      }
      this.$v.variables.$each[index].$touch();
    },
  },
};
</script>

<template>
  <div class="bs-group-personalized-variable-tab">
    {{ console().log(variables) }}
    <v-data-table
      :headers="tableHeaders"
      :items="variables"
      :loading="loading"
      :hide-default-footer="true"
      class="custom_table_class"
    >
      <template #item.status="{ item }">
        <div>
          <v-icon v-if="item.status === 'new'" small>
            mdi-alert-outline
          </v-icon>
          <v-icon v-else-if="item.status === 'modified'" small>
            mdi-pencil-outline
          </v-icon>
        </div>
      </template>
      <template #item.label="{ item, index }">
        <v-text-field
          v-model="item.label"
          :error-messages="
            $v.variables.$each[index].label.$error
              ? [$t('validation.required')]
              : []
          "
          @input="updateVariable(index, 'label', $event)"
          @blur="$v.variables.$each[index].label.$touch()"
        />
      </template>
      <template #item.variable="{ item, index }">
        <v-text-field
          v-model="item.variable"
          :error-messages="
            $v.variables.$each[index].variable.$error
              ? [$t('validation.required')]
              : []
          "
          @input="updateVariable(index, 'variable', $event)"
          @blur="$v.variables.$each[index].variable.$touch()"
        />
      </template>
      <template #item.actions="{ index }">
        <v-progress-circular v-if="variables[index].deleting" indeterminate />
        <v-btn v-else icon @click="deleteVariable(index)">
          <v-icon>mdi-delete</v-icon>
        </v-btn>
      </template>
    </v-data-table>
    <v-btn @click="addRow">
      {{ $t('variables.addRow') }}
    </v-btn>
    <v-btn @click="submit">
      {{ $t('variables.submit') }}
    </v-btn>
    <v-alert v-if="error" type="error">
      {{ error.message }}
    </v-alert>
  </div>
</template>

<style>
.custom_table_class tbody tr td {
  border: none !important;
}
.custom_table_class thead th:first-child {
  border-radius: 6px 0 0 0;
}
.custom_table_class thead th:lsat-child {
  border-radius: 0 6px 0 0;
}
</style>
