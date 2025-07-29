import { required } from 'vuelidate/lib/validators';
import axios from 'axios';

const Vue = require('vue/dist/vue.common');
const { SEND_MODE } = require('../../../constant/send-mode');
const { ESP_TYPE } = require('../../../constant/esp-type');
const { TimeInput } = require('../../time-input/timeInput');
const { validationMixin } = require('vuelidate');
const styleHelper = require('../../../utils/style/styleHelper');


const AdobeComponent = Vue.component('AdobeComponent', {
  name : "AdobeComponent",
  mixins: [validationMixin],
  components: {
    TimeInput,
  },
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
        campaignMailName: '',
        type: ESP_TYPE.ADOBE,
      },
      style: styleHelper,
      folders: [],
    };
  },
  computed: {
    isEditMode() {
      return this.type === SEND_MODE.EDIT;
    },
    console: () => console,
  },
  async mounted() {
    const { campaignMailName } = this.fetchedProfile;
    document.querySelector('smart-tree').dataSource = [
      {
        label: 'Campaign Management',
        items: [
            {
                label: 'FGM',
                items: [
                  {
                    label: 'CLA ZAF',
                    items: [
                      {
                        label: 'Resources',
                        items: [
                          {
                            label: 'CLA ZAF Templates',
                            items: [
                              {
                                label: 'CLA ZAF Delivery templates',
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
            },
        ]
      },
    ];
    this.profile = {
      campaignMailName: campaignMailName ?? '',
    };

    try {
      const { data } = await axios.get('/api/profiles/adobe-folders-tree', { params : {
          profileId : this.selectedProfile.id
      }});
      this.folders = buildTreeFromFolders(data.result);
    } catch (err) {
      console.error('Erreur en récupérant les dossiers Adobe :', err);
    }

    M.updateTextFields();
  },
  methods: {
    onSubmit() {
      M.updateTextFields();
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }
      this.$emit('submit', this.profile);
    },
    handleSelectItemFromTreeView(selectedItems) {
      if (selectedItems[0]) {
        this.profile = {selectedLocation : selectedItems[0]}
      }
    },
    open(selectedFolder) {
      this.profile = { folder: selectedFolder ?? ''};
    },
    close() {
      this.profile = { selectedLocation: {} };
    },
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
              <div class="input-field col s12">
                <label>Folder delivery</label>
              </div>
              <smart-tree
                filterable
                scroll-mode="scrollbar"
                selectionMode="one"
              />
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
  validations() {
    return {
      profile: {
        campaignMailName: {
          required,
        },

      },
    };
  },
});

function buildTreeFromFolders(folders) {
  const root = {};

  folders.forEach(({ fullName, name }) => {
    const parts = fullName.split(':'); // e.g., ["nmsDeliveryModel", "France"]
    let current = root;

    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = {
          id: parts.slice(0, index + 1).join(':'), // e.g., "nmsDeliveryModel:France"
          name: part,
          children: {},
        };
      }
      current = current[part].children;
    });
  });

  const convertToArray = (node) => {
    return Object.values(node).map(({ id, name, children }) => ({
      id,
      name,
      children: convertToArray(children),
    }));
  };

  return convertToArray(root);
}

module.exports = {
  AdobeComponent,
};
