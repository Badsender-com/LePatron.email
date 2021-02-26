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
  },
  data() {
    return {
      selected: [],
      headers: [
        { text: this.$t('global.name'), value: 'name', align:'left' },
        { text: this.$t('forms.user.firstname'), value: 'firstname' },
      ],
      users: [
        {
          id: 1, name: 'membre1', firstname: 'Mem',
        },
        {
          id: 2, name: 'memebre2', firstname: 'MMe',
        },
      ]
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
        <v-col cols="4">
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
        <v-col cols="6">
          <h4>{{this.$t('workspaces.members')}}</h4>
          <br/>
          <v-data-table
            v-model="selected"
            v-bind:headers="headers"
            v-bind:items="users"
            show-select
            item-key="id"
          >
            <template slot="headers" slot-scope="props">
              <tr>
                <th v-for="header in props.headers"
                    :key="header.text"
                >
                  {{ header.text }}
                </th>
              </tr>
            </template>
            <template slot="items" slot-scope="props">
              <tr :active="props.selected" @click="props.selected = !props.selected">
                <td>
                  <v-checkbox
                    primary
                    hide-details
                    :input-value="props.selected">

                  </v-checkbox>
                </td>
                <td> {{ props.item.name }}</td>
                <td class="text-right"> {{ props.item.firstname }}</td>
              </tr>
            </template>
          </v-data-table>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="4">
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
