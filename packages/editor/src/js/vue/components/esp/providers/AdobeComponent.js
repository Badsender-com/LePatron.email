import axios from 'axios';
import { TARGET_TYPE } from '../../../constant/adobe-taget-type';

const Vue = require('vue/dist/vue.common');
const { SEND_MODE } = require('../../../constant/send-mode');
const { ESP_TYPE } = require('../../../constant/esp-type');
const styleHelper = require('../../../utils/style/styleHelper');

const AdobeComponent = Vue.component('AdobeComponent', {
  name: 'AdobeComponent',
  props: {
    vm: { type: Object, default: () => ({}) },
    isLoading: { type: Boolean, default: false },
    closeModal: { type: Function, default: () => {} },
    selectedProfile: { type: Object, default: () => ({}) },
    fetchedProfile: { type: Object, default: () => ({}) },
    type: { type: Number, default: SEND_MODE.CREATION },
    fetchedFolders: { type: Array, default: [] },
    fetchedFoldersError: {type: String, default : ""},
    exportError: {type: String, default : ""}

  },
  data() {
    return {
      profile: {
        campaignMailName: '',
        folderFullName: '',
        deliveryInternalName: '',
        type: ESP_TYPE.ADOBE,
      },
      style: styleHelper,
      folders: [],
      deliveries: [],
      deliveryErrorMessage :"",
      isFolderLoading: false,
      isDeliveryLoading: false,
    };
  },
  watch: {
    fetchedFolders: {
      immediate: true,
      handler(newFolders) {
        this.folders = buildTreeFromFolders(newFolders);
        this.$nextTick(() => {
          const folderTree = document.getElementById('folder-tree');
          if (folderTree) folderTree.dataSource = this.folders;
        });
      }
    }
  },
  async mounted() {
    this.profile.campaignMailName = this.vm.creationName();
    this.isFolderLoading = false;

    M.updateTextFields();
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  },
  beforeDestroy() {
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
  },
  computed: {
    deliveryLabel() {
      return this.selectedProfile.targetType === TARGET_TYPE.NMS_DELIVERY_MODEL
        ? this.vm.t('select-delivery-template')
        : this.vm.t('select-delivery');
    },
    deliverySearchLabel() {
      return this.selectedProfile.targetType === TARGET_TYPE.NMS_DELIVERY_MODEL
        ? this.vm.t('search-delivery-template')
        : this.vm.t('search-delivery');
    }
  },
  methods: {
    onSubmit() {
      M.updateTextFields();
      this.$emit('submit', this.profile);
    },
    handleBeforeUnload(e) {
      if (this.isLoading) {
        e.preventDefault();
        e.returnValue = this.vm?.t?.('exporting-in-progress') || 'An export is still running. Are you sure you want to leave?';
        return e.returnValue;
      }
    },
    async handleFolderChange(e) {
      if (this.folders?.length === 0) return;

      const selectedIndexes = e.detail.selectedIndexes;

      if (selectedIndexes?.length === 0) {
        this.deliveries = [];

        this.profile.folderFullName = '';

        const deliveryTree = document.getElementById('delivery-tree');
        deliveryTree.dataSource = this.deliveries;

        return;
      }

      const indexes = `${selectedIndexes[0]}`.split('.');
      let fullName = '';
      let currentFolders = this.folders;

      indexes?.forEach((index) => {
        fullName = fullName + '/' + currentFolders[index].label;
        currentFolders = currentFolders[index].items;
      });
      fullName += '/';

      this.profile.folderFullName = fullName;

      this.isDeliveryLoading = true;

      try {
        const { data } = await axios.get(
          `/api/profiles/${this.selectedProfile.id}/adobe-deliveries`,
          {
            params: {
              fullName: fullName,
            },
          }
        );
        this.deliveries = data.result;
      } catch (err) {
        console.error('Error while fetching adobe deliveries :', err);
        const logId = err?.response?.data?.logId;
        let message = this.vm.t('delivery-error');
        message = message.replace( '{logId}', logId || 'N/A' );
        this.deliveryErrorMessage = message
        this.vm?.notifier?.error?.(this.vm.t('snackbar-error'));
      } finally {
        this.isDeliveryLoading = false;
        const deliveryTree = document.getElementById('delivery-tree');
        deliveryTree.dataSource = this.deliveries;
      }
    },

    async handleDeliveryChange(e) {
      const selectedIndex = e.detail.selectedIndexes;
      this.profile.deliveryInternalName = this.deliveries?.[
        selectedIndex
      ]?.internalName;
    },
  },
  template: `
    <div>
      <!-- Overlay global si en cours de loading -->
      <div v-if="isLoading" class="loading-overlay">
        <div style="text-align:center;">
          <div class="preloader-wrapper big active">
            <div class="spinner-layer spinner-blue-only">
              <div class="circle-clipper left">
                <div class="circle"></div>
              </div>
              <div class="gap-patch">
                <div class="circle"></div>
              </div>
              <div class="circle-clipper right">
                <div class="circle"></div>
              </div>
            </div>
          </div>
          <p style="margin-top:16px; font-size:16px; color:#1976d2;">
            {{ vm.t('exporting-in-progress') }}
          </p>
        </div>
      </div>
      <!-- Modal Content -->
      <div class="modal-content">
        <div class="row">
          <div class="col s12">
            <h5>{{ vm.t('export-to') }} {{ selectedProfile.name }}</h5>
            <p v-if="fetchedFoldersError" class="red-text text-darken-1" style="margin-top: 8px; margin-bottom: 0;  user-select: text; cursor: text;">
              {{ fetchedFoldersError }}
            </p>
            <p
              v-if="deliveryErrorMessage"
              class="red-text text-darken-1"
              style="margin-top: 4px; margin-bottom: 0; user-select: text; cursor: text;"
            >
              {{ deliveryErrorMessage }}
            </p>
            <p v-if="exportError" class="red-text text-darken-1" style="margin-top: 8px; margin-bottom: 0;  user-select: text; cursor: text;">
              {{ exportError }}
            </p>
          </div>
          <form class="col s12">
            <div class="row" :style="style.mb0">
              <div style="display: flex; gap: 24px;">
                <div style="flex: 1;">
                  <div :class="fetchedFoldersError ?  'adobe-loader hide' : '' " >
                    <div class="input-field col s12 adobe-label">
                      <label>{{ vm.t('select-folder') }}</label>
                    </div>
                    <smart-tree
                      style="width:100%"
                      id="folder-tree"
                      filterable
                      scroll-mode="scrollbar"
                      selection-mode="zeroOrOne"
                      :filter-input-placeholder="vm.t('search-folder')"
                      toggle-mode="click"
                      @change="handleFolderChange"
                      selection-target='leaf'
                      :disabled="isLoading"
                      :style="isLoading ? 'pointer-events: none; opacity: 0.6;' : ''"
                    />
                  </div>
                </div>

                <div style="flex: 1;">
                <div :class="isDeliveryLoading ? 'valign-wrapper' : 'valign-wrapper adobe-loader hide' " :style="{height: '100%', justifyContent: 'center'}" >
                  <div class="preloader-wrapper small active">
                      <div class="spinner-layer spinner-green-only">
                        <div class="circle-clipper left">
                          <div class="circle"></div>
                        </div><div class="gap-patch">
                        <div class="circle"></div>
                      </div><div class="circle-clipper right">
                        <div class="circle"></div>
                      </div>
                      </div>
                    </div>
                </div>

                <div :class="!isDeliveryLoading && this.profile.folderFullName ? '' : 'adobe-loader hide'">
                  <div class="input-field col s12 adobe-label">
                    <label>{{ deliveryLabel }}</label>
                  </div>
                  <smart-tree
                    style="width:100%"
                    id="delivery-tree"
                    filterable
                    scroll-mode="scrollbar"
                    selection-mode="zeroOrOne"
                    :filter-input-placeholder="deliverySearchLabel"
                    toggle-mode="click"
                    @change="handleDeliveryChange"
                    selection-target='leaf'
                    :disabled="isLoading"
                    :style="isLoading ? 'pointer-events: none; opacity: 0.6;' : ''"
                  />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      <div class="modal-footer">
        <button
          v-if="!isLoading"
          @click.prevent="closeModal"
          class="btn-flat waves-effect waves-light"
          name="closeAction"
        >
          {{ vm.t('close') }}
        </button>
        <button
          @click.prevent="onSubmit"
          :disabled="isLoading || !profile.folderFullName || !profile.deliveryInternalName"
          :style="[style.mb0, style.mt0]"
          class="btn waves-effect waves-light"
          type="submit"
          name="submitAction"
        >
          <span v-if="isLoading">
            {{ vm.t('exporting') }}
          </span>
          <span v-else>
            {{ vm.t('export') }}
            <i class="fa fa-paper-plane" aria-hidden="true"></i>
          </span>
        </button>
      </div>
    </div>
  `,
});

function buildTreeFromFolders(folders) {
  const root = {};

  folders.forEach(({ fullName }) => {
    const parts = fullName.split('/');
    let current = root;
    parts.forEach((part, idx) => {
      //Skip if it is the first or last /
      if (!part) return;
      //If key does not already exist add a node
      if (!current[part]) {
        current[part] = { label: part, items: {} };
      }
      //If key already exists append children
      current = current[part].items;
    });
  });

  function toArray(node) {
    return Object.values(node).map(({ label, items }) => ({
      label,
      items: Object.keys(items).length ? toArray(items) : undefined,
    }));
  }

  return toArray(root);
}

module.exports = {
  AdobeComponent,
};
