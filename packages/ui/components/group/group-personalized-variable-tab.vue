<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import BsModalConfirm from '~/components/modal-confirm';
import BsTextField from '~/components/form/bs-text-field.vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { mapMutations } from 'vuex';

import {
  getPersonalizedVariables,
  deletePersonalizedVariable,
  postPersonalizedVariables,
} from '~/helpers/api-routes';

import { Braces, Plus, Trash2 } from 'lucide-vue';

export default {
  name: 'GroupPersonalizedVariableTab',
  components: {
    BsModalConfirm,
    BsTextField,
    LucideBraces: Braces,
    LucidePlus: Plus,
    LucideTrash2: Trash2,
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
    deleteVariableName() {
      return this.deleteIndex !== null
        ? this.variables[this.deleteIndex].variable
        : '';
    },
    hasUnsavedChanges() {
      return this.variables.some(
        (v) => v.status === 'new' || v.status === 'modified'
      );
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
        this.showSnackbar({
          text: this.$t('personalizedVariables.snackbars.error'),
          color: 'error',
        });
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
      // Focus the new row's label input after DOM update
      this.$nextTick(() => {
        const inputs = this.$el.querySelectorAll(
          '.variables-table__row:last-child input'
        );
        if (inputs.length > 0) {
          inputs[0].focus();
        }
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
    getStatusClass(status) {
      return {
        'variables-table__status--new': status === 'new',
        'variables-table__status--modified': status === 'modified',
      };
    },
  },
};
</script>

<template>
  <div class="personalized-variables">
    <!-- Form Section Header -->
    <div class="form-section">
      <div class="form-section__header">
        <lucide-braces class="form-section__icon" :size="20" />
        <div class="form-section__title">
          <h3>{{ $t('personalizedVariables.title') }}</h3>
          <p>{{ $t('personalizedVariables.description') }}</p>
        </div>
      </div>
    </div>

    <!-- Variables Table -->
    <div class="variables-table">
      <!-- Table Header -->
      <div class="variables-table__header">
        <div class="variables-table__col variables-table__col--status" />
        <div class="variables-table__col variables-table__col--label">
          {{ $t('personalizedVariables.label') }}
        </div>
        <div class="variables-table__col variables-table__col--variable">
          {{ $t('personalizedVariables.variable') }}
        </div>
        <div class="variables-table__col variables-table__col--actions">
          {{ $t('personalizedVariables.actions') }}
        </div>
      </div>

      <!-- Loading State -->
      <div
        v-if="loading && variables.length === 0"
        class="variables-table__loading"
      >
        <v-progress-circular indeterminate color="primary" size="32" />
      </div>

      <!-- Empty State -->
      <div v-else-if="variables.length === 0" class="variables-table__empty">
        <lucide-braces :size="48" class="variables-table__empty-icon" />
        <p>{{ $t('personalizedVariables.empty') }}</p>
      </div>

      <!-- Table Rows -->
      <div
        v-for="(variable, index) in variables"
        v-else
        :key="index"
        class="variables-table__row"
      >
        <div class="variables-table__col variables-table__col--status">
          <span
            class="variables-table__status"
            :class="getStatusClass(variable.status)"
          >
            <template v-if="variable.status === 'new'">+</template>
            <template v-else-if="variable.status === 'modified'">*</template>
          </span>
        </div>
        <div class="variables-table__col variables-table__col--label">
          <bs-text-field
            :value="variable.label"
            :error-messages="validationErrors(index, 'label')"
            :disabled="loading || variable.deleting"
            hide-label
            dense
            @input="updateVariable(index, 'label', $event)"
            @blur="$v.variables.$each[index].label.$touch()"
          />
        </div>
        <div class="variables-table__col variables-table__col--variable">
          <bs-text-field
            :value="variable.variable"
            :error-messages="validationErrors(index, 'variable')"
            :disabled="loading || variable.deleting"
            hide-label
            dense
            @input="updateVariable(index, 'variable', $event)"
            @blur="$v.variables.$each[index].variable.$touch()"
          />
        </div>
        <div class="variables-table__col variables-table__col--actions">
          <v-progress-circular
            v-if="variable.deleting"
            indeterminate
            size="20"
            width="2"
          />
          <v-tooltip v-else bottom>
            <template #activator="{ on, attrs }">
              <v-btn
                icon
                small
                class="error--text"
                :disabled="loading"
                v-bind="attrs"
                v-on="on"
                @click="openDeleteDialog(index)"
              >
                <lucide-trash2 :size="18" />
              </v-btn>
            </template>
            <span>{{ $t('global.delete') }}</span>
          </v-tooltip>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <v-btn text color="primary" :disabled="loading" @click="addRow">
        <lucide-plus :size="16" class="mr-1" />
        {{ $t('personalizedVariables.addRow') }}
      </v-btn>
      <v-spacer />
      <v-btn
        color="accent"
        elevation="0"
        :loading="loading"
        :disabled="loading || !hasUnsavedChanges"
        @click="onSubmit"
      >
        {{ $t('global.save') }}
      </v-btn>
    </div>

    <!-- Delete Confirmation Modal -->
    <bs-modal-confirm
      ref="deleteDialog"
      :title="$t('personalizedVariables.deleteTitle')"
      :action-label="$t('global.delete')"
      action-button-color="error"
      action-button-elevation="0"
      @confirm="deleteVariable"
    >
      <p>
        {{
          $t('personalizedVariables.deleteNotice', {
            variable: deleteVariableName,
          })
        }}
      </p>
    </bs-modal-confirm>
  </div>
</template>

<style lang="scss" scoped>
.personalized-variables {
  max-width: 900px;
}

.form-section {
  margin-bottom: 1.5rem;

  &__header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  &__icon {
    color: #00acdc;
    margin-top: 2px;
    flex-shrink: 0;
  }

  &__title {
    h3 {
      font-size: 1rem;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
      margin: 0 0 0.25rem 0;
    }

    p {
      font-size: 0.875rem;
      color: rgba(0, 0, 0, 0.6);
      margin: 0;
    }
  }
}

.variables-table {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;

  &__header {
    display: flex;
    align-items: center;
    background: #fafafa;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__row {
    display: flex;
    align-items: flex-start;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: rgba(0, 0, 0, 0.02);
    }
  }

  &__col {
    &--status {
      width: 2rem;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: 0.5rem;
    }

    &--label {
      flex: 1;
      padding-right: 1rem;
    }

    &--variable {
      flex: 1;
      padding-right: 1rem;
    }

    &--actions {
      width: 4rem;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: 0.25rem;
    }
  }

  &__status {
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 50%;

    &--new {
      color: #4caf50;
      background: rgba(76, 175, 80, 0.1);
    }

    &--modified {
      color: #ff9800;
      background: rgba(255, 152, 0, 0.1);
    }
  }

  &__loading,
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: rgba(0, 0, 0, 0.38);
  }

  &__empty-icon {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  &__empty p {
    margin: 0;
    font-size: 0.875rem;
  }
}

.form-actions {
  display: flex;
  align-items: center;
  padding-top: 0.5rem;
}
</style>
