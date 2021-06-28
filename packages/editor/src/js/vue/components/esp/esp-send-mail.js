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
  },
  template: `
    <div>
      <profile-list
        :select-profile="handleProfileSelect"
        :vm="vm"
      ></profile-list>
      <div class="material-css">
        <div id="modal1" class="modal  modal-fixed-footer" ref="modalRef">
            <component
              :key="selectedProfile.id"
              :vm="vm"
              :type="type"
              :is="espComponent"
              v-if="!!selectedProfile"
              :selectedProfile="selectedProfile"
              :campaignId="campaignId"
              :closeModal="closeModal"
              :campaignMailName="''"
              @submit="submitEsp"
            >
            </component>
        </div>
      </div>
    </div>

      `,
  data: () => ({
    espComponent: 'SendinBlueComponent',
    mailingId: null,
    selectedProfile: null,
    dialog: false,
    modalInstance: null,
    type: SEND_MODE.CREATION,
    campaignId: null,
    espIds: []
  }),
  mounted() {
    this.mailingId = this.vm?.metadata?.id;

    const modalRef = this.$refs.modalRef;
    const options = {
      dismissible: false
    };
    this.modalInstance = M.Modal.init(modalRef, options);
    this.fetchData();
  },
  methods: {
    fetchData() {
       axios.get(getEspIds({mailingId: this.mailingId }))
          .then((response)=> {
            this.espIds = (response?.data.result || []);
        }).catch((error) => {
            // handle error
            this.vm.notifier.error(this.vm.t('error-server'));
        });
    },
    handleProfileSelect(profile) {
      this.selectedProfile = profile;
      this.fetchData();
      this.checkIfAlreadySendMailWithProfile();
      this.openModal();
    },
    checkIfAlreadySendMailWithProfile() {
      if(!this.selectedProfile?.id || !this.espIds) {
        return;
      }
      this.type = SEND_MODE.CREATION;
      this.espIds.forEach((espId) => {
          if (espId?.profileId === this.selectedProfile?.id) {
            console.log('found match espIds')
            this.campaignId = espId.mailCampaignId.toString()
            this.type = SEND_MODE.EDIT
          }
      });
    },
    openModal() {
      this.modalInstance?.open();
    },
    closeModal() {
      this.modalInstance?.close();
    },
    submitEsp(profile) {

      if(!this.vm?.metadata?.url?.sendCampaignMail) {
        return;
      }

      const unprocessedHtml = this.vm.exportHTML();

      axios.post(this.vm.metadata.url.sendCampaignMail, {
        html: unprocessedHtml,
        actionType: this.type,
        profileId: profile?.id,
        type: profile.type,
        espSendingMailData: {
          campaignMailName: profile.campaignMailName,
          subject: profile.subject,
        }
      })
        .then((response)=> {
          // handle success
          this.vm.notifier.success(this.vm.t('success-esp-send'));
          this.closeModal();
        }).catch((error) => {
        // handle error
        this.vm.notifier.error(this.vm.t('error-server'));
      });
    }
  },
});

module.exports = {
  EspComponent
}
