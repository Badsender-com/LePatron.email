<script>
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import { Pencil, Trash2, Send } from 'lucide-vue';

export default {
  name: 'BsProfilesTable',
  LucideSend: Send,
  components: {
    BsDataTable,
    BsModalConfirmForm,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
  },
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
        },
        {
          text: this.$t('profiles.type'),
          align: 'left',
          value: 'type',
        },
        {
          text: this.$t('profiles.createdAt'),
          align: 'left',
          value: 'createdAt',
        },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'center',
        },
      ];
    },
  },
  methods: {
    goToProfile(profile) {
      this.$router.push(`/groups/${this.groupId}/profiles/${profile.id}`);
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
  },
};
</script>

<template>
  <div>
    <bs-data-table
      :headers="tableHeaders"
      :items="profiles"
      :loading="loading"
      :empty-icon="$options.LucideSend"
      :empty-message="$t('profiles.emptyState')"
      clickable
      @click:row="goToProfile"
    >
      <template #item.name="{ item }">
        <span class="font-weight-medium">{{ item.name }}</span>
      </template>

      <template #item.type="{ item }">
        <v-chip small outlined>
          {{ item.type }}
        </v-chip>
      </template>

      <template #item.createdAt="{ item }">
        {{ item.createdAt | preciseDateTime }}
      </template>

      <template #item.actions="{ item }">
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              v-bind="attrs"
              v-on="on"
              @click.stop="goToProfile(item)"
            >
              <lucide-pencil :size="18" />
            </v-btn>
          </template>
          <span>{{ $t('global.edit') }}</span>
        </v-tooltip>

        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              class="error--text"
              v-bind="attrs"
              v-on="on"
              @click.stop="openDeleteModal(item)"
            >
              <lucide-trash2 :size="18" />
            </v-btn>
          </template>
          <span>{{ $t('global.delete') }}</span>
        </v-tooltip>
      </template>
    </bs-data-table>

    <bs-modal-confirm-form
      ref="deleteDialog"
      :title="`${$t('global.delete')} ?`"
      :action-label="$t('global.delete')"
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
