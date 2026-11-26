<script>
import BsModalConfirm from '~/components/modal-confirm';
import { caseVariantOf } from '~/helpers/taxonomy.js';

/**
 * The question asked when the server holds back a declared dimension whose
 * name differs from an existing one only by its case (ADR-0015): the editor
 * would show two lists, and a template reads one exact name.
 *
 * Opened over the declaration form, which stays open behind it: cancelling
 * leaves the admin where they were, free to correct the name.
 */
export default {
  name: 'BsTaxonomyCaseVariantDialog',
  components: { BsModalConfirm },
  data() {
    return {
      // The declaration held back, and the name it was compared against.
      pending: null,
    };
  },
  methods: {
    /**
     * Ask, when the refusal is this one.
     *
     * @param {Error} error the failed declaration
     * @param {Object} payload what was sent
     * @returns {boolean} whether it was this refusal, now asked about
     */
    ask(error, payload) {
      const existingName = caseVariantOf(error);
      if (!existingName) return false;
      this.pending = { name: payload.name, existingName, payload };
      this.$refs.modal.open();
      return true;
    },

    confirm() {
      const { payload } = this.pending;
      this.pending = null;
      this.$emit('confirm', { ...payload, confirmCaseVariant: true });
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('taxonomy.dimensions.caseVariant.title')"
    :action-label="$t('taxonomy.dimensions.caseVariant.confirm')"
    action-button-color="accent"
    @cancel="pending = null"
    @confirm="confirm"
  >
    <template v-if="pending">
      <p>
        {{
          $t('taxonomy.dimensions.caseVariant.message', {
            name: pending.name,
            existingName: pending.existingName,
          })
        }}
      </p>
      <p>{{ $t('taxonomy.dimensions.caseVariant.consequence') }}</p>
    </template>
  </bs-modal-confirm>
</template>
