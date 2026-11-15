<script>
import { X } from 'lucide-vue';

/**
 * BsSidePanelForm - a form in a panel sliding from the right
 *
 * The same API as BsModalForm (`title`, `submitLabel`, `loading`, `open()`,
 * `close()`, `submit`, `cancel`), for a form edited beside the list it
 * belongs to, which stays in sight (ADR-0026).
 */
export default {
  name: 'BsSidePanelForm',
  components: { LucideX: X },
  props: {
    title: { type: String, required: true },
    width: { type: [String, Number], default: 460 },
    submitLabel: { type: String, default: '' },
    cancelLabel: { type: String, default: '' },
    submitColor: { type: String, default: 'accent' },
    loading: { type: Boolean, default: false },
    submitDisabled: { type: Boolean, default: false },
    showSubmit: { type: Boolean, default: true },
    // Kept for parity with BsModalForm: a panel never closes on its own
    // while a request runs.
    persistent: { type: Boolean, default: false },
  },
  data() {
    return { isOpen: false };
  },
  computed: {
    computedSubmitLabel() {
      return this.submitLabel || this.$t('global.save');
    },
    computedCancelLabel() {
      return this.cancelLabel || this.$t('global.cancel');
    },
  },
  methods: {
    open() {
      this.isOpen = true;
      this.$emit('open');
    },
    close() {
      this.isOpen = false;
      this.$emit('close');
    },
    onCancel() {
      this.$emit('cancel');
      this.close();
    },
    onSubmit() {
      this.$emit('submit');
    },
    onInput(open) {
      if (!open && this.loading) {
        this.isOpen = true;
        return;
      }
      if (!open) this.close();
    },
  },
};
</script>

<template>
  <v-navigation-drawer
    :value="isOpen"
    class="bs-side-panel"
    right
    fixed
    temporary
    :width="width"
    @input="onInput"
  >
    <form class="bs-side-panel__form" @submit.prevent="onSubmit">
      <header class="bs-side-panel__header">
        <h2 class="bs-side-panel__title">{{ title }}</h2>
        <v-btn
          icon
          small
          :disabled="loading"
          :aria-label="computedCancelLabel"
          @click="onCancel"
        >
          <lucide-x :size="18" />
        </v-btn>
      </header>
      <div class="bs-side-panel__content">
        <slot />
      </div>
      <footer class="bs-side-panel__actions">
        <v-btn text color="primary" :disabled="loading" @click="onCancel">
          {{ computedCancelLabel }}
        </v-btn>
        <v-btn
          v-if="showSubmit"
          type="submit"
          :color="submitColor"
          elevation="0"
          :loading="loading"
          :disabled="loading || submitDisabled"
        >
          {{ computedSubmitLabel }}
        </v-btn>
      </footer>
    </form>
  </v-navigation-drawer>
</template>

<style lang="scss" scoped>
.bs-side-panel {
  max-width: 100%;

  &__form {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0 10px 0 20px;
    border-bottom: 1px solid var(--gray-300);
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--v-primary-base);
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--gray-300);
  }
}
</style>
