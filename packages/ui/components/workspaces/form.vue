<script>
import { validationMixin } from 'vuelidate';

export default {
  name: 'WorkspaceForm',
  mixins: [validationMixin],
  supportedLanguages: [
    { text: 'English', value: 'en' },
    { text: 'Français', value: 'fr' },
  ],
  props: {
    users: { type: Array, default: () => [] },
  },
  data() {
    return {
      workspaceForm: {
        name: '',
      },
      submitStatus: null,
    };
  },
  methods: {
    onSubmit() {
      this.$emit('submit', this.workspaceForm);
    },
  },
};
</script>

<template>
  <v-card tag="form">
    <!-- <v-card-title v-if="title">
      {{ title }}
    </v-card-title> -->
    <v-card-text>
      <v-row>
        <v-col cols="5">
          <v-text-field
            id="name"
            v-model="workspaceForm.name"
            name="name"
            :label="$t('workspaces.name')"
          />
        </v-col>
        <v-col cols="6" class="ml-auto">
          <v-row>
            <v-col>
              <h3>{{ $t('workspaces.members') }}</h3>
            </v-col>
          </v-row>
          <v-data-table
            item-key="id"
            name="selectedUsers"
            show-select
            :items="users"
          />
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn text large color="primary" @click="onSubmit">
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
