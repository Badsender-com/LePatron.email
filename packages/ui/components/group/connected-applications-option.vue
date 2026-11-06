<script>
import { mapMutations } from 'vuex';
import { Unplug } from 'lucide-vue';

import { groupConnectedApplications } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsSettingsRow from '~/components/layout/bs-settings-row.vue';

// The AI assistants the group's users connected (ADR 0012): the group's tech
// admin revokes them all at once, say when an assistant leaks. Switching MCP
// off revokes them too, so the row lives under the switch.
export default {
  name: 'BsGroupConnectedApplicationsOption',
  components: { BsModalConfirm, BsSettingsRow, LucideUnplug: Unplug },
  props: {
    group: { type: Object, required: true },
  },
  data() {
    return { count: null, countError: false, loading: false };
  },
  computed: {
    summary() {
      if (this.countError) {
        return this.$t('connectedApplications.groupCountError');
      }
      if (this.count === null) return '';
      return this.$tc('connectedApplications.groupCount', this.count, {
        count: this.count,
      });
    },
  },
  async mounted() {
    try {
      const { count } = await this.$axios.$get(
        groupConnectedApplications({ groupId: this.group.id })
      );
      this.count = count;
    } catch (error) {
      this.countError = true;
      console.error(error);
    }
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async revokeAll() {
      this.loading = true;
      try {
        await this.$axios.$delete(
          groupConnectedApplications({ groupId: this.group.id })
        );
        this.count = 0;
        this.showSnackbar({
          text: this.$t('connectedApplications.groupRevoked'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <bs-settings-row class="bs-group-connected-applications-option">
    <template #title>{{ $t('connectedApplications.pageTitle') }}</template>
    <template #description>
      <v-progress-circular
        v-if="count === null && !countError"
        indeterminate
        size="14"
        width="2"
        color="accent"
      />
      <template v-else>{{ summary }}</template>
    </template>
    <v-btn
      v-if="count > 0"
      text
      color="error"
      class="text-none"
      :loading="loading"
      @click="$refs.revokeModal.open()"
    >
      <lucide-unplug :size="16" class="mr-2" />
      {{ $t('connectedApplications.groupRevoke') }}
    </v-btn>
    <bs-modal-confirm
      ref="revokeModal"
      :title="$t('connectedApplications.groupRevokeTitle')"
      :action-label="$t('connectedApplications.groupRevoke')"
      @confirm="revokeAll"
    >
      <p>
        {{
          $tc('connectedApplications.groupRevokeConfirm', count || 0, {
            count,
            group: group.name,
          })
        }}
      </p>
    </bs-modal-confirm>
  </bs-settings-row>
</template>
