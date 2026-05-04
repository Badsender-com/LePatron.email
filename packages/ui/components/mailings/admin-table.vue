<script>
import { mapGetters } from 'vuex';
import { Mail, Pencil } from 'lucide-vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsMailingsAdminTable',
  components: {
    BsDataTable,
    LucideMail: Mail,
    LucidePencil: Pencil,
  },
  props: {
    mailings: { type: Array, default: () => [] },
    hiddenCols: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: Object, default: () => ({}) },
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    canAccessUsers() {
      return this.isAdmin || this.isGroupAdmin;
    },
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        { text: this.$t('global.author'), align: 'left', value: 'userName' },
        {
          text: this.$tc('global.template', 1),
          align: 'left',
          value: 'templateName',
        },
        { text: this.$t('global.createdAt'), value: 'createdAt' },
        { text: this.$t('global.updatedAt'), value: 'updatedAt' },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'right',
          width: '80px',
        },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
  },
  methods: {
    openMailing(item) {
      window.location.href = `/editor/${item.id}`;
    },
    goToUser(item) {
      if (!item.userId) return;
      const groupId = this.$route.params.groupId;
      const path = groupId
        ? `/groups/${groupId}/settings/users/${item.userId}`
        : `/users/${item.userId}`;
      this.$router.push(path);
    },
    goToTemplate(item) {
      if (!item.templateId) return;
      this.$router.push(`/templates/${item.templateId}`);
    },
  },
};
</script>

<template>
  <bs-data-table
    :headers="tableHeaders"
    :items="mailings"
    :loading="loading"
    v-bind="$attrs"
    v-on="$listeners"
  >
    <template #item.name="{ item }">
      <span
        class="cell-link font-weight-medium"
        @click.stop="openMailing(item)"
      >{{ item.name }}</span>
    </template>

    <template #item.userName="{ item }">
      <span
        v-if="canAccessUsers && item.userId"
        class="cell-link text--secondary"
        @click.stop="goToUser(item)"
      >{{ item.userName }}</span>
      <span v-else class="text--secondary">{{ item.userName }}</span>
    </template>

    <template #item.templateName="{ item }">
      <span
        v-if="item.templateId"
        class="cell-link text--secondary"
        @click.stop="goToTemplate(item)"
      >{{ item.templateName }}</span>
      <span v-else class="text--secondary">{{ item.templateName }}</span>
    </template>

    <template #item.createdAt="{ item }">
      <span class="text--secondary">{{
        item.createdAt | preciseDateTime
      }}</span>
    </template>

    <template #item.updatedAt="{ item }">
      <span class="text--secondary">{{
        item.updatedAt | preciseDateTime
      }}</span>
    </template>

    <template #item.actions="{ item }">
      <v-tooltip bottom>
        <template #activator="{ on, attrs }">
          <v-btn
            icon
            small
            v-bind="attrs"
            v-on="on"
            @click.stop="openMailing(item)"
          >
            <lucide-pencil :size="18" />
          </v-btn>
        </template>
        <span>{{ $t('global.edit') }}</span>
      </v-tooltip>
    </template>

    <template #empty>
      <div class="text-center pa-6">
        <lucide-mail :size="48" class="grey--text text--lighten-1" />
        <p class="text-body-1 grey--text mt-4">
          {{ $t('mailings.noMailingsAvailable') }}
        </p>
      </div>
    </template>
  </bs-data-table>
</template>

<style scoped>
.cell-link {
  cursor: pointer;
  border-radius: 2px;
}

.cell-link:hover {
  text-decoration: underline;
  color: var(--v-primary-base);
}
</style>
