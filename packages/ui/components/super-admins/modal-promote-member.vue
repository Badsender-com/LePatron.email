<script>
import BsModalForm from '~/components/modal/bs-modal-form.vue';

export default {
  name: 'BsModalPromoteMember',
  components: { BsModalForm },
  props: {
    loading: { type: Boolean, default: false },
    // The members of the platform group who are not super admins yet.
    members: { type: Array, default: () => [] },
  },
  data() {
    return { userId: null };
  },
  computed: {
    // A deactivated member would become a deactivated super admin, which
    // counts for nothing: only active members are offered.
    candidates() {
      return this.members.filter((member) => !member.isDeactivated);
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
  <bs-modal-form
    ref="modal"
    :title="$t('superAdmins.promote')"
    :submit-label="$t('superAdmins.promoteAction')"
    :loading="loading"
    :submit-disabled="!userId"
    width="600"
    @submit="onSubmit"
  >
    <p class="text-caption text--secondary">
      {{ $t('superAdmins.promoteDescription') }}
    </p>
    <v-autocomplete
      v-if="candidates.length > 0"
      v-model="userId"
      :label="$t('superAdmins.member')"
      :items="candidates"
      item-text="name"
      item-value="id"
      :disabled="loading"
      outlined
      dense
      hide-details="auto"
    >
      <template #item="{ item }">
        <v-list-item-content>
          <v-list-item-title>{{ item.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ item.email }}</v-list-item-subtitle>
        </v-list-item-content>
      </template>
    </v-autocomplete>
    <p v-else class="text-body-2">
      {{ $t('superAdmins.noMember') }}
    </p>
  </bs-modal-form>
</template>
