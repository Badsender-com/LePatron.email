<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  name: 'WorkspaceForm',
  mixins: [validationMixin],
  supportedLanguages: [
    { text: 'English', value: 'en' },
    { text: 'Français', value: 'fr' },
  ],
  model: { prop: 'workspace', event: 'update' },
  props: {
    workspace: { type: Object, default: () => ({}) },
    flat: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    title: { type: String, default: '' },
    users: { type: Array, default: () => [] },
  },
  data() {
    return {
      selected: [],
      search: '',
      headers: [
        { text: this.$t('global.name'), value: 'name', align: 'center' },
        { text: this.$t('global.email'), value: 'email', align: 'center' },
      ],
    };
  },
  validations() {
    return {
      workspace: {
        name: {
          required,
          async isUnique(workspaceName) {
            const { $axios } = this;
            try {
              const workspaceWithNameExists = await $axios.$get(
                apiRoutes.workspaceByNameInGroup(workspaceName)
              );
              return !workspaceWithNameExists;
            } catch (e) {
              console.error(e);
            }
          },
        },
        description: {},
      },
    };
  },
  computed: {
    localModel: {
      get() {
        return this.workspace;
      },
      set(updatedUser) {
        this.$emit('update', updatedUser);
      },
    },
    groupId() {
      return this.$route.params.groupId;
    },
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }
      this.$emit('submit', this.workspace);
    },
  },
};
</script>

<template>
  <v-card tag="form">
    <v-card-title v-if="title">
      {{ title }}
    </v-card-title>
    <v-card-text>
      <v-row>
        <v-col cols="5">
          <v-text-field
            id="name"
            v-model="localModel.name"
            :label="$t('workspaces.name')"
            name="name"
            required
            :error-messages="nameErrors"
            @input="$v.workspace.name.$touch()"
            @blur="$v.workspace.name.$touch()"
          />
          <v-text-field
            id="description"
            v-model="localModel.description"
            :label="$t('workspaces.description')"
            name="description"
            @input="$v.workspace.description.$touch()"
            @blur="$v.workspace.description.$touch()"
          />
        </v-col>
        <v-col cols="6" class="ml-auto">
          <v-row>
            <v-col>
              <h3>{{ $t('workspaces.members') }}</h3>
            </v-col>
            <v-col>
              <v-text-field
                v-model="search"
                append-icon="mdi-magnify"
                label="Search"
                single-line
                hide-details
              />
            </v-col>
          </v-row>
          <br>
          <v-data-table
            v-model="localModel.selectedUsers"
            name="selectedUsers"
            :headers="headers"
            :items="users"
            show-select
            :search="search"
            :loading="loading"
            item-key="id"
          />
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn text large color="primary" :disabled="disabled" @click="onSubmit">
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
