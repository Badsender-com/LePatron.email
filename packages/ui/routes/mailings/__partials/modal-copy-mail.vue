<script>
import BsModalConfirm from '~/components/modal-confirm';

export default {
  name: 'ModalCopyMail',
  components: {
    BsModalConfirm,
  },
  props: {
    confirmationInputLabel: { type: String, default: '' },
    selectedLocation: {},
  },
  data() {
    return {
      items: [
        {
          name: '.git',
        },
        {
          name: 'node_modules',
        },
        {
          name: 'public',
          children: [
            {
              name: 'static',
              children: [
                {
                  name: 'logo.png',
                  file: 'png',
                },
              ],
            },
            {
              name: 'favicon.ico',
              file: 'png',
            },
            {
              name: 'index.html',
              file: 'html',
            },
          ],
        },
        {
          name: '.gitignore',
          file: 'txt',
        },
        {
          name: 'babel.config.js',
          file: 'js',
        },
        {
          name: 'package.json',
          file: 'json',
        },
        {
          name: 'README.md',
          file: 'md',
        },
        {
          name: 'vue.config.js',
          file: 'js',
        },
        {
          name: 'yarn.lock',
          file: 'txt',
        },
      ],
    };
  },
  computed: {
    valid() {
      return !!this.selectedLocation?.id;
    },
  },
  methods: {
    submit() {
      if (this.valid) {
        this.close();
        this.$emit('confirm', this.data);
      }
    },
    open(item) {
      this.data = item;
      this.$refs.copyMailDialog.open();
    },
    close() {
      this.$refs.form.reset();
      this.$refs.copyMailDialog.close();
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="copyMailDialog"
    :title="`${this.$t('global.copyMailTitle')} ${data.name}`"
    :is-form="true"
  >
    <v-form ref="form" v-model="valid" @submit.prevent="submit">
      <slot />
      <template>
        <v-treeview
          v-model="tree"
          :open="initiallyOpen"
          :items="items"
          activatable
          item-key="name"
          open-on-click
        >
          <template #prepend="{ item, open }">
            <v-icon v-if="!item.file">
              {{ open ? 'mdi-folder-open' : 'mdi-folder' }}
            </v-icon>
            <v-icon v-else>
              {{ files[item.file] }}
            </v-icon>
          </template>
        </v-treeview>
      </template>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn type="submit" color="error">
          {{ $t('global.delete') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>
