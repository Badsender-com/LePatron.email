var Vue = require('vue/dist/vue.common');
var { SENDINBLUEComponent } = require('./providers/SendinBlueComponent');
var { ProfileListComponent } = require('../esp/profile-list');
var { getEspIds } = require('../../utils/apis');
var { SEND_MODE } = require('../../constant/send-mode');
var axios = require('axios');

const EspComponent = Vue.component('esp-form', {
  components: {
    SENDINBLUEComponent,
    ProfileListComponent
  },
  props: {
    vm: { type: Object, default: () => ({}) },
    type: { type: Number, default: SEND_MODE.CREATION }
  },
  template: `
    <div>
      <profile-list
        :select-profile="handleProfileSelect"
        :vm="vm"
      ></profile-list>
      <div class="material-css">
        <div id="modal1" class="modal" ref="modalRef">
          <component
            :key="selectedProfileId"
            :vm="vm"
            :type="type"
            :is="espComponent"
            v-if="!!selectedProfileId"
            :selectedProfileId="selectedProfileId"
            :campaignId="campaignId"
            :campaignMailName="''"
          >
          </component>
        </div>
      </div>
    </div>

      `,
  data: () => ({
    espComponent: 'SendinBlueComponent',
    mailingId: null,
    selectedProfileId: null,
    dialog: false,
    modalInstance: null,
    campaignId: null,
    espIds: []
  }),
  mounted() {
    console.log({ vm: this.vm });
    this.mailingId = this.vm?.metadata?.id;

    const modalRef = this.$refs.modalRef;
    const options = {};
    this.modalInstance = M.Modal.init(modalRef, options);
    this.fetchData();
  },
  methods: {
    fetchData() {
       axios.get(getEspIds({mailingId: this.mailingId }))
          .then((response)=> {
          // handle success
            console.log('success');
            this.espResult = (response?.data.result || []);
        }).catch((error) => {
            // handle error
            this.vm.notifier.success(this.vm.t('error-server'));
        });
    },
    handleProfileSelect(profile) {
      console.log({ newProfile : profile });
      this.selectedProfileId = profile.id;
      this.checkIfAlreadySendMailWithProfile();
      this.modalInstance?.open();
    },
    checkIfAlreadySendMailWithProfile() {
      console.log({
        selectedProfileId: this.selectedProfileId
      });
      if(!this.selectedProfileId || !this.espIds) {
        console.log('canceled checkIfAlreadySendMailWithProfile');
        return;
      }
      this.type = SEND_MODE.CREATION;
      this.espIds.forEach((espId) => {
          if (espId?.profileId === this.selectedProfileId) {
            console.log('found match espIds')
            this.campaignId = espId.mailCampaignId
            this.type = SEND_MODE.EDIT
          }
      });

      console.log({ type: this.type});
    },
    openModal() {
      this.modalInstance?.open();
    },
  },
});

module.exports = {
  EspComponent
}
