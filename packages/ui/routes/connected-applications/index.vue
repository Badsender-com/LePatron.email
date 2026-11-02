<script>
import { mapMutations } from 'vuex';
import { Unplug } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';

// The AI assistants the user connected to LePatron (ADR 0012), each bound to
// a group, which they revoke one by one.
export default {
  name: 'PageConnectedApplications',
  components: {
    BsPageHeader,
    BsModalConfirm,
    LucideUnplug: Unplug,
  },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_USER,
  },
  async asyncData({ $axios }) {
    try {
      const { items } = await $axios.$get(apiRoutes.connectedApplications());
      return { applications: items, loadError: false };
    } catch (error) {
      console.error(error);
      return { applications: [], loadError: true };
    }
  },
  data() {
    return {
      applications: [],
      loadError: false,
      toRevoke: null,
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return this.$t('connectedApplications.pageTitle');
    },
    headers() {
      return [
        { text: this.$t('connectedApplications.name'), value: 'name' },
        { text: this.$t('connectedApplications.group'), value: 'group' },
        {
          text: this.$t('connectedApplications.connectedAt'),
          value: 'connectedAt',
        },
        {
          text: this.$t('connectedApplications.lastUsedAt'),
          value: 'lastUsedAt',
        },
        { text: '', value: 'actions', sortable: false, align: 'end' },
      ];
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    formatDate(date) {
      return new Date(date).toLocaleString(this.$i18n.locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    },
    askRevoke(application) {
      this.toRevoke = application;
      this.$refs.revokeModal.open();
    },
    async revoke() {
      const application = this.toRevoke;
      try {
        await this.$axios.$delete(
          apiRoutes.connectedApplicationsItem({ id: application.id })
        );
        this.applications = this.applications.filter(
          (candidate) => candidate.id !== application.id
        );
        this.showSnackbar({
          text: this.$t('connectedApplications.revoked'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.error(error);
      } finally {
        this.toRevoke = null;
      }
    },
  },
};
</script>

<template>
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ title }}
      </template>
    </bs-page-header>
    <v-container fluid>
      <p class="text-body-2 text--secondary">
        {{ $t('connectedApplications.description') }}
      </p>
      <v-alert v-if="loadError" type="error" outlined text>
        {{ $t('connectedApplications.loadError') }}
      </v-alert>
      <v-data-table
        :headers="headers"
        :items="applications"
        item-key="id"
        :no-data-text="$t('connectedApplications.empty')"
        hide-default-footer
        disable-pagination
      >
        <template #item.group="{ item }">
          {{ item.group.name }}
        </template>
        <template #item.connectedAt="{ item }">
          {{ formatDate(item.connectedAt) }}
        </template>
        <template #item.lastUsedAt="{ item }">
          <span v-if="item.lastUsedAt">{{ formatDate(item.lastUsedAt) }}</span>
          <span v-else class="text--secondary">
            {{ $t('connectedApplications.neverUsed') }}
          </span>
        </template>
        <template #item.actions="{ item }">
          <v-btn
            text
            small
            color="error"
            :aria-label="
              $t('connectedApplications.revokeOne', { name: item.name })
            "
            @click="askRevoke(item)"
          >
            <lucide-unplug :size="16" class="mr-1" />
            {{ $t('connectedApplications.revoke') }}
          </v-btn>
        </template>
      </v-data-table>
      <bs-modal-confirm
        ref="revokeModal"
        :title="$t('connectedApplications.revokeTitle')"
        :action-label="$t('connectedApplications.revoke')"
        @confirm="revoke"
      >
        <p v-if="toRevoke">
          {{
            $t('connectedApplications.revokeConfirm', {
              name: toRevoke.name,
              group: toRevoke.group.name,
            })
          }}
        </p>
      </bs-modal-confirm>
    </v-container>
  </div>
</template>
