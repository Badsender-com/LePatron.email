<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';

export default {
  name: 'WorkspaceForm',
  mixins: [validationMixin],
  supportedLanguages: [
    { text: 'English', value: 'en' },
    { text: 'Français', value: 'fr' },
  ],
  props: {
    workspace: { type: Object, default: () => ({}) },
    groupUsers: { type: Array, default: () => [] },
    isLoading: { type: Boolean, default: false },
    title: { type: String, default: '' },
  },
  data() {
    return {
      headers: [
        { text: this.$t('global.name'), value: 'name', align: 'center' },
        { text: this.$t('global.email'), value: 'email', align: 'center' },
      ],
      submitStatus: null,
    };
  },
  validations() {
    return {
      workspaceForm: {
        name: {
          required,
        },
      },
    };
  },
  computed: {
    nameErrors() {
      const errors = [];
      if (!this.$v.workspaceForm.name.$dirty) return errors;
      !this.$v.workspaceForm.name.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
    workspaceForm() {
      const workspaceUsers = this.workspace?._users;
      return {
        name: this.workspace.name || '',
        selectedUsers: workspaceUsers
          ? this.groupUsers.filter((user) => workspaceUsers.includes(user.id))
          : [],
      };
    },
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }
      this.$emit('submit', this.workspaceForm);
    },
  },
};
</script>

<template>
  <v-card flat tile tag="form" :loading="isLoading" :disabled="isLoading">
    <v-card-title v-if="title">
      {{ title }}
    </v-card-title>
    <v-card-text>
      <v-row>
        <v-col cols="12">
          <v-text-field
            id="name"
            v-model="workspaceForm.name"
            :label="$t('workspaces.name')"
            name="name"
            required
            :error-messages="nameErrors"
            @input="$v.workspaceForm.name.$touch()"
            @blur="$v.workspaceForm.name.$touch()"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <h3>{{ $t('workspaces.members') }}</h3>

          <v-data-table
            v-model="workspaceForm.selectedUsers"
            :headers="headers"
            item-key="id"
            name="selectedUsers"
            show-select
            :items="groupUsers"
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
          </v-data-table>
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-spacer />
      <v-btn
        :loading="isLoading"
        color="accent"
        elevation="0"
        @click="onSubmit"
      >
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
