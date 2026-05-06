<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import BsTextField from '~/components/form/bs-text-field';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsFormSection from '~/components/layout/BsFormSection.vue';
import { Users, Info } from 'lucide-vue';

export default {
  name: 'WorkspaceForm',
  components: {
    BsDataTable,
    BsTextField,
    BsFormSection,
    LucideUsers: Users,
    LucideInfo: Info,
  },
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
      <bs-form-section>
        <template #icon>
          <lucide-info :size="20" />
        </template>
        <template #title>
          {{ $t('workspaces.sections.info') }}
        </template>
        <template #description>
          {{ $t('workspaces.sections.infoDescription') }}
        </template>
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
      </bs-form-section>

      <!-- Section: Members (header only — table lives below for flush width) -->
      <bs-form-section last>
        <template #icon>
          <lucide-users :size="20" />
        </template>
        <template #title>
          {{ $t('workspaces.members') }}
        </template>
        <template #description>
          {{ $t('workspaces.membersDescription') }}
        </template>
      </bs-form-section>
    </v-card-text>

    <!-- Members table: outside v-card-text for full-width flush rendering -->
    <bs-data-table
      v-model="formData.selectedUsers"
      :headers="headers"
      :items="groupUsers"
      item-key="id"
      show-select
      class="mb-4"
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
    </bs-data-table>

    <v-divider />
    <v-card-actions>
      <v-spacer />
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
.members-header {
  margin-bottom: 1rem;
}
</style>
