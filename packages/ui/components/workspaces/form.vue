<script>
import {validationMixin} from 'vuelidate';
import {required, maxLength, email} from 'vuelidate/lib/validators';

export default {
  name: `bs-workspace-form`,
  mixins: [validationMixin],
  supportedLanguages: [
    {text: `English`, value: `en`},
    {text: `Français`, value: `fr`},
  ],
  model: {prop: 'workspace', event: 'update'},
  props: {
    workspace: {type: Object, default: () => ({})},
    flat: {type: Boolean, default: false},
    disabled: {type: Boolean, default: false},
    loading: {type: Boolean, default: false},
    title: {type: String, default: ``},
    usersOfGroup: {type: Array, default: () => ([])}
  },
  data() {
    return {
      selected: [],
      search: '',
      headers: [
        {text: this.$t('global.name'), value: 'name', align: 'center'},
        {text: this.$t('global.email'), value: 'email', align: 'center'},
      ],
    }
  },
  validations() {
    return {
      workspace: {
        name: {required},
        description: {}
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
    nameErrors() {
      const errors = [];
      if (!this.$v.workspace.name.$dirty) {
        return errors;
      }
      !this.$v.workspace.name.required && errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
    users() {
      return this.usersOfGroup.map(user => {
        return {
          id: user.id,
          name: user.name,
          firstname: user.name
        }
      })
    }
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }
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
            v-model="localModel.name"
            id="name"
            :label="$t('workspaces.name')"
            name="name"
            required
            :error-messages="nameErrors"
            @input="$v.workspace.name.$touch()"
            @blur="$v.workspace.name.$touch()"
          />
          <v-text-field
            v-model="localModel.description"
            id="description"
            :label="$t('workspaces.description')"
            name="description"
            @input="$v.workspace.description.$touch()"
            @blur="$v.workspace.description.$touch()"
          />
        </v-col>
        <v-col cols="6" class="ml-auto">
          <v-row>
            <v-col>
              <h3>{{this.$t('workspaces.members')}}</h3>
            </v-col>
            <v-col>
              <v-text-field
                v-model="search"
                append-icon="mdi-magnify"
                label="Search"
                single-line
                hide-details
              ></v-text-field>
            </v-col>
          </v-row>
          <br/>
          <v-data-table
            v-model="localModel.selectedUsers"
            name="selectedUsers"
            :headers="headers"
            :items="usersOfGroup"
            show-select
            :search="search"
            :loading="this.loading"
            item-key="id"
          />
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider/>
    <v-card-actions>
      <v-btn
        text
        large
        color="primary"
        @click="onSubmit"
        :disabled="disabled"
      >{{ $t('global.save') }}
      </v-btn
      >
    </v-card-actions>
  </v-card>
</template>
