<script>
import * as userStatusHelpers from '~/helpers/user-status.js';
import ProfilesActionsDropdown from './profiles-actions-dropdown.vue';
import ProfilesActionsDropdownItem from './profiles-actions-dropdown-item.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form';

export default {
  name: 'BsProfilesTable',
  components: {
    ProfilesActionsDropdown,
    ProfilesActionsDropdownItem,
    BsModalConfirmForm,
  },
  model: { prop: 'loading', event: 'update' },
  props: {
    profiles: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    groupId: { type: String, default: null },
  },
  data() {
    return {
      selectedProfile: {},
    };
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
    openDeleteModal(profile = {}) {
      this.selectedProfile = profile;
      this.$refs.deleteDialog.open({
        name: profile.name,
        id: profile.id,
      });
    },
    handleDelete() {
      this.$emit('delete', this.selectedProfile);
    },
    closeModal() {
      this.$refs.deleteDialog.close();
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
      :loading="loading"
      :no-data-text="$t('profiles.emptyState')"
    >
      <template #item.name="{ item }">
        <nuxt-link :to="`/groups/${groupId}/profiles/${item.id}`">
          {{ item.name }}
        </nuxt-link>
      </template>
      <template #item.type="{ item }">
        <span> {{ item.type }} </span>
      </template>
      <template #item.createdAt="{ item }">
        <span> {{ item.createdAt | preciseDateTime }} </span>
      </template>
      <template #item.actions="{ item }">
        <profiles-actions-dropdown>
          <profiles-actions-dropdown-item
            icon="edit"
            :to="`/groups/${groupId}/profiles/${item.id}`"
          >
            {{ $t('global.edit') }}
          </profiles-actions-dropdown-item>
          <profiles-actions-dropdown-item
            icon="delete"
            :on-click="() => openDeleteModal(item)"
          >
            {{ $t('profiles.delete') }}
          </profiles-actions-dropdown-item>
        </profiles-actions-dropdown>
      </template>
    </v-data-table>
    <bs-modal-confirm-form
      ref="deleteDialog"
      :with-input-confirmation="false"
      @confirm="handleDelete"
    >
      <p
        class="black--text"
        v-html="
          $t('profiles.deleteWarningMessage', {
            name: selectedProfile.name,
          })
        "
      />
    </bs-modal-confirm-form>
  </div>
</template>
