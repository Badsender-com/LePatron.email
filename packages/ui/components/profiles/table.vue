<script>
import * as userStatusHelpers from '~/helpers/user-status.js';
import ProfilesActionsDropdown from './profiles-actions-dropdown.vue';
import ProfilesActionsDropdownItem from './profiles-actions-dropdown-item.vue';

export default {
  name: 'BsProfilesTable',
  components: {
    ProfilesActionsDropdown,
    ProfilesActionsDropdownItem,
  },
  model: { prop: 'loading', event: 'update' },
  props: {
    profiles: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },

  computed: {
    tableHeaders() {
      return [
        {
          text: this.$t('profiles.name'),
          align: 'left',
          value: 'name',
          sort: (a, b) => String(b.name).localeCompare(a.name),
        },
        {
          text: this.$t('profiles.type'),
          align: 'center',
          value: 'type',
          sort: (a, b) => String(b.type).localeCompare(a.type),
        },
        {
          text: this.$t('profiles.createdAt'),
          align: 'center',
          value: 'createdAt',
        },
        {
          text: this.$t('profiles.actions'),
          value: 'actions',
          sortable: false,
          align: 'center',
          class: 'table-column-action',
        },
      ];
    },
  },
  methods: {
    getStatusIcon(item) {
      return userStatusHelpers.getStatusIcon(item.status);
    },
  },
};
</script>

<template>
  <!-- eslint-disable vue/valid-v-slot  -->
  <div class="bs-users-table">
    <v-data-table
      :headers="tableHeaders"
      :items="profiles"
      class="elevation-1"
      :loading="loading"
      :no-data-text="$t('profiles.emptyState')"
    >
      <template #item.name="{ item }">
        <span> {{ item.name }} </span>
      </template>
      <template #item.type="{ item }">
        <span> {{ item.type }} </span>
      </template>
      <template #item.createdAt="{ item }">
        <span> {{ item.createdAt }} </span>
      </template>
      <template #item.actions>
        <profiles-actions-dropdown>
          <profiles-actions-dropdown-item icon="edit" disabled>
            {{ $t('profiles.edit') }}
          </profiles-actions-dropdown-item>
          <profiles-actions-dropdown-item icon="delete" disabled>
            {{ $t('profiles.delete') }}
          </profiles-actions-dropdown-item>
        </profiles-actions-dropdown>
      </template>
    </v-data-table>
  </div>
</template>
