<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import {
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
} from '~/helpers/constants/table-config.js';
import BsTextField from '~/components/form/bs-text-field';
import { Users } from 'lucide-vue';

export default {
  name: 'WorkspaceForm',
  components: {
    BsTextField,
    LucideUsers: Users,
  },
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
  mixins: [validationMixin],
  props: {
    workspace: { type: Object, default: () => ({}) },
    groupUsers: { type: Array, default: () => [] },
    isLoading: { type: Boolean, default: false },
    isEdit: { type: Boolean, default: false },
  },
  data() {
    return {
      formData: {
        name: '',
        selectedUsers: [],
      },
      headers: [
        { text: this.$t('global.name'), value: 'name', align: 'left' },
        { text: this.$t('global.email'), value: 'email', align: 'left' },
      ],
    };
  },
  validations() {
    return {
      formData: {
        name: {
          required,
        },
      },
    };
  },
  computed: {
    nameErrors() {
      const errors = [];
      if (!this.$v.formData.name.$dirty) return errors;
      !this.$v.formData.name.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
  },
  watch: {
    workspace: {
      immediate: true,
      deep: true,
      handler(newWorkspace) {
        if (newWorkspace) {
          this.formData.name = newWorkspace.name || '';
          // Pre-select users that are already in the workspace
          const workspaceUserIds = newWorkspace._users || [];
          this.formData.selectedUsers = this.groupUsers.filter((user) =>
            workspaceUserIds.includes(user.id)
          );
        }
      },
    },
    groupUsers: {
      immediate: true,
      handler(newUsers) {
        // Re-compute selected users when groupUsers changes
        if (this.workspace && this.workspace._users && newUsers.length > 0) {
          this.formData.selectedUsers = newUsers.filter((user) =>
            this.workspace._users.includes(user.id)
          );
        }
      },
    },
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }
      this.$emit('submit', this.formData);
    },
    onCancel() {
      this.$emit('cancel');
    },
    toggleUserSelection(user) {
      // Group admins are always selected and can't be toggled
      if (user.isGroupAdmin) return;

      const index = this.formData.selectedUsers.findIndex(
        (u) => u.id === user.id
      );
      if (index === -1) {
        this.formData.selectedUsers.push(user);
      } else {
        this.formData.selectedUsers.splice(index, 1);
      }
    },
    isUserSelected(user) {
      return (
        user.isGroupAdmin ||
        this.formData.selectedUsers.some((u) => u.id === user.id)
      );
    },
  },
};
</script>

<template>
  <v-card flat tile tag="form" :loading="isLoading" :disabled="isLoading">
    <v-card-text>
      <!-- Section: Workspace Info -->
      <div class="form-section">
        <h3 class="form-section__title">
          {{ $t('workspaces.sections.info') }}
        </h3>
        <p class="form-section__description">
          {{ $t('workspaces.sections.infoDescription') }}
        </p>
        <v-row>
          <v-col cols="12" md="6">
            <bs-text-field
              v-model="formData.name"
              :label="$t('workspaces.name')"
              required
              :error-messages="nameErrors"
              @blur="$v.formData.name.$touch()"
            />
          </v-col>
        </v-row>
      </div>

      <!-- Section: Members -->
      <div class="form-section">
        <h3 class="form-section__title">
          {{ $t('workspaces.members') }}
        </h3>
        <p class="form-section__description">
          {{ $t('workspaces.membersDescription') }}
        </p>

        <v-data-table
          v-model="formData.selectedUsers"
          :headers="headers"
          :items="groupUsers"
          item-key="id"
          show-select
          :items-per-page="25"
          :hide-default-footer="groupUsers.length <= $options.TABLE_PAGINATION_THRESHOLD"
          :footer-props="$options.TABLE_FOOTER_PROPS"
          class="users-table"
          @click:row="toggleUserSelection"
        >
          <template #item.data-table-select="{ item, isSelected, select }">
            <v-tooltip left :disabled="!item.isGroupAdmin">
              <template #activator="{ on }">
                <v-simple-checkbox
                  :value="isSelected || item.isGroupAdmin"
                  :readonly="item.isGroupAdmin"
                  :disabled="item.isGroupAdmin"
                  v-on="on"
                  @input="select($event)"
                />
              </template>
              <span>{{ $t('workspaces.userIsGroupAdmin') }}</span>
            </v-tooltip>
          </template>

          <template #item.name="{ item }">
            <span :class="{ 'font-weight-medium': isUserSelected(item) }">
              {{ item.name }}
            </span>
          </template>

          <template #no-data>
            <div class="text-center pa-6">
              <lucide-users :size="48" class="grey--text text--lighten-1" />
              <p class="text-body-1 grey--text mt-4">
                {{ $t('workspaces.noUsersAvailable') }}
              </p>
            </div>
          </template>
        </v-data-table>
      </div>
    </v-card-text>

    <v-divider />
    <v-card-actions>
      <v-spacer />
      <v-btn text color="primary" :disabled="isLoading" @click="onCancel">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn
        :loading="isLoading"
        color="accent"
        elevation="0"
        @click="onSubmit"
      >
        {{ isEdit ? $t('global.save') : $t('global.create') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style lang="scss" scoped>
.form-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  &__title {
    font-size: 1.1rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
    margin-bottom: 0.25rem;
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 1rem;
  }
}

.users-table {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;

  ::v-deep tbody tr {
    cursor: pointer;

    &:hover {
      background-color: rgba(0, 172, 220, 0.05) !important;
    }
  }

  // Disabled row for group admins (always selected)
  ::v-deep tbody tr.v-data-table__selected {
    background-color: rgba(0, 172, 220, 0.08) !important;
  }
}
</style>
