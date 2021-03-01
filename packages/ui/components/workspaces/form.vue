<script>
import { validationMixin } from 'vuelidate';
import { required, maxLength, email } from 'vuelidate/lib/validators';

export default {
  name: `bs-workspace-form`,
  mixins: [validationMixin],
  supportedLanguages: [
    { text: `English`, value: `en` },
    { text: `Français`, value: `fr` },
  ],
  props: {
    workspace: { type: Object, default: () => ({}) },
    flat: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    title: { type: String, default: `` },
    usersOfGroup: { type: Array, default: () => ([])}
  },
  data() {
    return {
      selected: [],
      headers: [
        { text: this.$t('global.name'), value: 'name', align:'left' },
        { text: this.$t('forms.user.firstname'), value: 'firstname' },
      ],
    }
  },
  validations() {
    return {
      workspace: {
        name: { required },
        description: {}
      },
    };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    nameErrors() {
      const errors = [];
      if (!this.$v.workspace.name.$dirty) return errors;
      !this.$v.workspace.name.required &&
      errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
    users() {
      return this.usersOfGroup.map(user => {
        return {
          ...user.id,
          name: user.name,
          firstname: user.name
        }
      })
    }
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit(`submit`, this.workspace);
    },
  },
};
</script>

<template>
  <v-card tag="form">
    <v-card-title v-if="title">{{ title }}</v-card-title>
    <v-card-text>
      <v-row>
        <v-col cols="5">
          <v-text-field
            v-model="workspace.name"
            id="email"
            :label="$t('workspaces.name')"
            name="name"
            required
            :error-messages="nameErrors"
            @input="$v.workspace.name.$touch()"
            @blur="$v.workspace.name.$touch()"
          />
        </v-col>
        <v-col cols="6" class="ml-auto">
          <h4>{{this.$t('workspaces.members')}}</h4>
          <br/>
          <v-data-table
            v-model="selected"
            :headers="headers"
            :items="users"
            show-select
            item-key="id"
          />

        </v-col>
      </v-row>
      <v-row>
        <v-col cols="5">
          <v-text-field
            v-model="workspace.description"
            id="description"
            :label="$t('workspaces.description')"
            name="description"
            @input="$v.workspace.description.$touch()"
            @blur="$v.workspace.description.$touch()"
          />
        </v-col>
      </v-row>

    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn
        text
        large
        color="primary"
        @click="onSubmit"
        :disabled="disabled"
      >{{ $t('global.save') }}</v-btn
      >
    </v-card-actions>
  </v-card>
</template>
