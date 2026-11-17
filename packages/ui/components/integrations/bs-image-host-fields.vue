<script>
/**
 * BsImageHostFields - the root folder of an image host account, under which
 * its emails' folders are created (ADR 0028). The client ID it lists the
 * folders with is a field of the form, before the secret.
 *
 * The folders come from the account itself: from the credentials being typed
 * for a new integration, from the stored secret when editing one (loaded as
 * the form opens). Emits the whole config object.
 */
import * as apiRoutes from '~/helpers/api-routes.js';
import BsSelect from '~/components/form/bs-select';
import { folderOptions } from './image-host-folders.js';
import { FolderSync } from 'lucide-vue';

export default {
  name: 'BsImageHostFields',
  components: { BsSelect, LucideFolderSync: FolderSync },
  props: {
    value: { type: Object, default: () => ({}) },
    provider: { type: String, required: true },
    /** The secret being typed, empty when the stored one is kept. */
    apiKey: { type: String, default: '' },
    /** Set when editing: the server then uses the stored secret. */
    integrationId: { type: String, default: null },
    /** { rootFolderId: [] }, from the form's validation. */
    errors: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
  },
  data() {
    return { folders: null, loadingFolders: false, loadError: '' };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    canLoad() {
      return !!this.value.clientId && (!!this.apiKey || !!this.integrationId);
    },
    // The saved root folder is not among the account's: deleted in Emarsys,
    // or another account's after the credentials changed.
    rootFolderMissing() {
      const { rootFolderId } = this.value;
      return (
        !!this.folders &&
        !!rootFolderId &&
        !this.folders.some((folder) => folder.id === rootFolderId)
      );
    },
    folderErrors() {
      return this.rootFolderMissing
        ? [this.$t('integrations.emarsys.rootFolderMissing')]
        : this.errors.rootFolderId;
    },
    // Says what to do before the folders can be chosen.
    folderPlaceholder() {
      if (this.folders) return '';
      return this.canLoad
        ? this.$t('integrations.emarsys.rootFolderPlaceholderReady')
        : this.$t('integrations.emarsys.rootFolderPlaceholder');
    },
    folderItems() {
      if (this.folders) return folderOptions(this.folders);
      // Before the folders are loaded, the chosen one still shows.
      const { rootFolderId } = this.value;
      return rootFolderId
        ? [
            {
              value: rootFolderId,
              text: this.$t('integrations.emarsys.folderNumber', {
                id: rootFolderId,
              }),
            },
          ]
        : [];
    },
  },
  watch: {
    // Loaded as the form opens on a saved integration: its secret is stored.
    integrationId: {
      immediate: true,
      handler(integrationId) {
        this.folders = null;
        this.loadError = '';
        if (integrationId) this.loadFolders();
      },
    },
  },
  methods: {
    update(key, value) {
      this.$emit('input', { ...this.value, [key]: value });
    },
    async loadFolders() {
      if (!this.canLoad) return;
      this.loadingFolders = true;
      this.loadError = '';
      try {
        const { folders } = await this.$axios.$post(
          apiRoutes.integrationImageHostFolders(this.groupId),
          {
            integrationId: this.integrationId || undefined,
            provider: this.provider,
            apiKey: this.apiKey || undefined,
            config: { clientId: this.value.clientId },
          }
        );
        this.folders = folders;
      } catch (error) {
        const code = error.response?.data?.message;
        const key = `integrations.emarsys.errors.${code}`;
        this.loadError = this.$te(key)
          ? this.$t(key)
          : this.$t('integrations.emarsys.errors.default');
      } finally {
        this.loadingFolders = false;
      }
    },
  },
};
</script>

<template>
  <div class="bs-image-host-fields">
    <div class="bs-image-host-fields__folder">
      <bs-select
        :value="value.rootFolderId"
        :items="folderItems"
        :label="$t('integrations.emarsys.rootFolder')"
        :hint="$t('integrations.emarsys.rootFolderHint')"
        :placeholder="folderPlaceholder"
        :error-messages="folderErrors"
        :disabled="disabled || !folders"
        required
        @input="update('rootFolderId', $event)"
      />
      <v-btn
        text
        small
        color="primary"
        class="bs-image-host-fields__load"
        :loading="loadingFolders"
        :disabled="disabled || !canLoad"
        @click="loadFolders"
      >
        <lucide-folder-sync :size="16" class="mr-2" />
        {{
          folders
            ? $t('integrations.emarsys.reloadFolders')
            : $t('integrations.emarsys.loadFolders')
        }}
      </v-btn>
      <p v-if="loadError" class="bs-image-host-fields__error" role="alert">
        {{ loadError }}
      </p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bs-image-host-fields__folder {
  margin-bottom: 1rem;
}

// Apart from the select: disabled until the folders load, it would grey out
// the very message that says why they did not.
.bs-image-host-fields__error {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: #f04e23;
}

// Under the select, after its hint: loading is the step before choosing.
.bs-image-host-fields__load {
  margin-top: 0.25rem;
  padding: 0 4px !important;
}
</style>
