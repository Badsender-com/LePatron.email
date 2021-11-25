<script>
export default {
  name: 'BsModalConfirm',
  props: {
    isForm: {
      type: Boolean,
      default: false,
    },
    title: { type: String, default: '' },
    modalWidth: { type: String, default: '500' },
    displaySubmitButton: { type: Boolean, default: true },
    actionLabel: { type: String, default: '' },
    actionButtonColor: { type: String, default: 'primary' },
  },
  data() {
    return { show: false };
  },
  methods: {
    open() {
      this.show = true;
    },
    close() {
      this.show = false;
      this.$emit('close');
    },
    action() {
      this.close();
      this.$emit('confirm');
    },
    onClickOutside() {
      this.$emit('click-outside');
    },
  },
};
</script>

<template>
  <v-dialog
    v-model="show"
    v-bind="$attrs"
    :width="modalWidth"
    class="bs-modal-confirm"
    @click:outside="onClickOutside"
  >
    <v-card>
      <v-card-title class="headline">
        <p class="grey--text text--darken-3" v-html="title" />
      </v-card-title>
      <v-card-text>
        <slot />
      </v-card-text>
      <template v-if="!isForm">
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn text color="primary" @click="close">
            {{ $t('global.cancel') }}
          </v-btn>
          <v-btn
            v-if="displaySubmitButton"
            flat
            :color="actionButtonColor"
            @click="action"
          >
            {{ actionLabel }}
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>

<style>
.v-card__text {
  padding-bottom: 0 !important;
}
</style>
