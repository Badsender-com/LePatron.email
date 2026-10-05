<script>
import BsModalConfirm from '~/components/modal-confirm';
import BsSelect from '~/components/form/bs-select';

export default {
  name: 'BsModalPromoteMember',
  components: { BsModalConfirm, BsSelect },
  props: {
    loading: { type: Boolean, default: false },
    // The members of the platform group who are not super admins yet.
    members: { type: Array, default: () => [] },
  },
  data() {
    return { userId: null };
  },
  computed: {
    items() {
      return this.members.map((member) => ({
        text: `${member.name} (${member.email})`,
        value: member.id,
      }));
    },
  },
  methods: {
    open() {
      this.userId = null;
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      if (!this.userId) return;
      this.$emit('submit', this.userId);
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('superAdmins.promote')"
    :is-form="true"
    modal-width="600"
  >
    <v-form @submit.prevent="onSubmit">
      <p class="text-body-2 text--secondary">
        {{ $t('superAdmins.promoteDescription') }}
      </p>
      <bs-select
        v-if="items.length > 0"
        v-model="userId"
        :label="$t('superAdmins.member')"
        :items="items"
        :disabled="loading"
      />
      <p v-else class="text-body-2">
        {{ $t('superAdmins.noMember') }}
      </p>
      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-btn text color="primary" :disabled="loading" @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          type="submit"
          color="accent"
          elevation="0"
          :loading="loading"
          :disabled="loading || !userId"
        >
          {{ $t('superAdmins.promoteAction') }}
        </v-btn>
      </div>
    </v-form>
  </bs-modal-confirm>
</template>

<style scoped>
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
