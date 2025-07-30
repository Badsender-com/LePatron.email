import axios from 'axios';

const Vue = require('vue/dist/vue.common');
const { SEND_MODE } = require('../../../constant/send-mode');
const { ESP_TYPE } = require('../../../constant/esp-type');
const styleHelper = require('../../../utils/style/styleHelper');


const AdobeComponent = Vue.component('AdobeComponent', {
  name : "AdobeComponent",
  props: {
    vm: { type: Object, default: () => ({}) },
    campaignMailName: { type: String, default: null },
    isLoading: { type: Boolean, default: false },
    closeModal: { type: Function, default: () => {} },
    espId: { type: String, default: null },
    selectedProfile: { type: Object, default: () => ({}) },
    fetchedProfile: { type: Object, default: () => ({}) },
    campaignId: { type: String, default: null },
    type: { type: Number, default: SEND_MODE.CREATION },
  },
  data() {
    return {
      profile: {
        type: ESP_TYPE.ADOBE,
        fullName: '',
        delivery : '',
      },
      style: styleHelper,
      folders: [],
      deliveries: [],
      isDeliveryLoading: false,
    };
  },
  async mounted() {
    try {
      const { data } = await axios.get(`/api/profiles/${this.selectedProfile.id}/adobe-folders`);
      this.folders = buildTreeFromFolders(data.result);
      const tree = document.getElementById('folder-tree');
      tree.dataSource = this.folders;
    } catch (err) {
      console.error('Error while fetching adobe folders : ', err);
    }

    M.updateTextFields();
  },
  methods: {
    onSubmit() {
      M.updateTextFields();
      this.$emit('submit', this.profile);
    },

    async handleFolderChange(e) {
      if (!this.folders || this.folders.length === 0) return

      const selectedIndexes = e.detail.selectedIndexes;
      const indexes = `${selectedIndexes[0]}`.split('.');
      let fullName = '';
      let currentFolder = this.folders;

      indexes.forEach((index)=>{
          fullName = fullName+'/'+currentFolder[index].label
          currentFolder = currentFolder[index].items
      })
      fullName+='/'
      this.profile.fullName = fullName;

      this.isDeliveryLoading = true;
      try {
        const { data } = await axios.get(`/api/profiles/${this.selectedProfile.id}/adobe-deliveries`, { params : {
            fullName : fullName
        }});
        this.deliveries = data.result;
      } catch (err) {
        console.error('Error while fetching adobe deliveries :', err);
      }
      finally{
        this.isDeliveryLoading = false;
        document.getElementById('delivery-tree').dataSource = this.deliveries;
      }
    },

    async handleDeliveryChange(e) {
      if (!this.delivery || this.delivery.length === 0) return
      const selectedIndex = e.detail.selectedIndexes;
      this.profile.delivery = this.deliveries[selectedIndex].label;
    }
  },
  template: `
    <div>
      <div class="modal-content">
        <div class="row">
          <div class="col s12">
            <h5>{{ vm.t('export-to') }} {{ selectedProfile.name }}</h5>
          </div>
          <form class="col s12">
            <div class="row" :style="style.mb0">
              <div style="display: flex; gap: 24px;">
                <div style="flex: 1;">
                  <div class="input-field col s12 adobe-label">
                    <label>{{ vm.t('select-folder') }}</label>
                  </div>
                  <smart-tree
                    style="width:100%"
                    id="folder-tree"
                    filterable
                    scroll-mode="scrollbar"
                    selection-mode="zeroOrOne"
                    toggle-mode="click"
                    @change="handleFolderChange"
                    selection-target='leaf'
                  />
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

                <div :class="!isDeliveryLoading &&this.profile.fullName ? '' : 'adobe-loader hide'">
                  <div class="input-field col s12 adobe-label">
                    <label>{{ vm.t('select-delivery') }}</label>
                  </div>
                  <smart-tree
                    style="width:100%"
                    id="delivery-tree"
                    filterable
                    scroll-mode="scrollbar"
                    selection-mode="zeroOrOne"
                    toggle-mode="click"
                    @change="handleDeliveryChange"
                    selection-target='leaf'
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
          @click.prevent="closeModal"
          class="btn-flat waves-effect waves-light"
          name="closeAction"
        >
          {{ vm.t('close') }}
        </button>
        <button
          @click.prevent="onSubmit"
          :disabled="isLoading"
          :style="[style.mb0, style.mt0]"
          class="btn waves-effect waves-light"
          type="submit"
          name="submitAction"
        >
          <span v-if="isLoading">{{ vm.t('exporting') }}</span>
          <span v-else
            >{{ vm.t('export') }}
            <i class="fa fa-paper-plane" aria-hidden="true"></i
          ></span>
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
      if (!part ) return
      //If key does not already exist add a node
      if ( !current[part] ) {
        current[part] = { label: part, items: {}};
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
