<script>
import { mapMutations } from 'vuex';
import { Unplug } from 'lucide-vue';

import { groupConnectedApplications } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import BsModalConfirm from '~/components/modal-confirm.vue';

// The AI assistants the group's users connected (ADR 0012): the group's
// admin revokes them all at once, say when an assistant leaks. Shown while
// MCP is off too, as long as connections remain: turning it back on would
// revive them.
export default {
  name: 'BsGroupConnectedApplicationsOption',
  components: { BsModalConfirm, LucideUnplug: Unplug },
  props: {
    group: { type: Object, required: true },
  },
  data() {
    return { count: null, countError: false, loading: false };
  },
  computed: {
    shown() {
      return this.group.enableMcp === true || this.count > 0;
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
  <section v-if="shown" class="bs-group-connected-applications-option">
    <h3 class="text-subtitle-1 font-weight-medium">
      {{ $t('connectedApplications.pageTitle') }}
    </h3>
    <p class="text-body-2 text--secondary">
      {{ $t('connectedApplications.groupDescription') }}
    </p>
    <p v-if="countError" class="text-body-2 text--secondary">
      {{ $t('connectedApplications.groupCountError') }}
    </p>
    <p v-else class="text-body-2">
      <template v-if="count === null">…</template>
      <template v-else>
        {{ $tc('connectedApplications.groupCount', count, { count }) }}
      </template>
    </p>
    <v-btn
      outlined
      color="error"
      :loading="loading"
      :disabled="count === 0"
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
  </section>
</template>
