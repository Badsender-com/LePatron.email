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
    actionButtonColor: { type: String, default: 'error' },
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
    <v-card flat tile>
      <v-card-title class="bs-modal-confirm__title">
        <span v-if="$slots.titlePrefix" class="bs-modal-confirm__title-icon">
          <slot name="titlePrefix" />
        </span>
        <p v-html="title" />
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
            elevation="0"
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

/* Modal title alignment with optional icon prefix (harmonized layout). */
.bs-modal-confirm__title {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
}

.bs-modal-confirm__title-icon {
  display: inline-flex;
  align-items: center;
  color: var(--v-primary-base);
  flex-shrink: 0;
}

/* The title <p> must shrink and wrap inline; without `min-width: 0` the flex
   item refuses to shrink below its content width, which pushes the icon onto
   its own row when the title is long. */
.bs-modal-confirm__title p {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  word-break: break-word;
}
</style>
