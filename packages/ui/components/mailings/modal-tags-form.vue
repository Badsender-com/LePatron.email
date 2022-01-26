<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import BsModalConfirm from '~/components/modal-confirm';

export default {
  name: 'BsModalTagsForm',

  components: {
    BsModalConfirm,
  },
  mixins: [validationMixin],
  props: {
    inputLabel: { type: String, default: '' },
  },
  data() {
    return {
      text: null,
    };
  },
  computed: {
    tagNameErrors() {
      const errors = [];
      if (!this.$v.text.$dirty) return errors;
      !this.$v.text.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
  },
  validations() {
    return {
      text: { required },
    };
  },
  methods: {
    submit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('confirm', this.text);
      this.close();
    },
    open() {
      this.$refs.deleteDialog.open();
    },
    close() {
      this.$refs.form?.reset();
      this.$refs.deleteDialog.close();
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="deleteDialog"
    :title="$t('tags.new')"
    :is-form="true"
    v-bind="$attrs"
  >
    <v-form ref="form" @submit.prevent="submit">
      <slot />
      <v-text-field
        v-model="text"
        :label="inputLabel"
        :error-messages="tagNameErrors"
        @input="$v.text.$touch()"
        @blur="$v.text.$touch()"
      />
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn elevation="0" at color="accent" @click="submit">
          {{ $t('global.createTag') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>
