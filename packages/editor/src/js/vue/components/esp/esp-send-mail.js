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
              :loading="loading"
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
    loading: false,
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
      return axios.get(getEspIds({mailingId: this.mailingId }))
          .then((response) => {
            console.log({ result: response?.data.result });
            this.espIds = (response?.data.result || []);
        }).catch((error) => {
            // handle error
            this.vm.notifier.error(this.vm.t('error-server'));
        });
    },
    handleProfileSelect(profile) {
      this.selectedProfile = profile;
      this.fetchData().then(() => {
        this.checkIfAlreadySendMailWithProfile();
        this.openModal();
      });

    },
    preventMouseLeave(event) {
      event.stopPropagation();
      event.preventDefault();
    },
    checkIfAlreadySendMailWithProfile() {
      if(!this.selectedProfile?.id || !this.espIds) {
        return;
      }
      this.type = SEND_MODE.CREATION;
      this.espIds.forEach((espId) => {
          if (espId?.profileId === this.selectedProfile?.id) {
            console.log('found match espIds');
            this.campaignId = espId.mailCampaignId.toString();
            this.type = SEND_MODE.EDIT
          }
      });

      console.log({ mailCampaign: this.campaignId });
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

      this.loading = true;
      const unprocessedHtml = this.vm.exportHTML();

      axios.post(this.vm.metadata.url.sendCampaignMail, {
        html: unprocessedHtml,
        actionType: this.type,
        profileId: profile?.id,
        type: profile.type,
        campaignId: this.campaignId,
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
        const errorCode = error.response.status;
        const handledErrorCodes = [400, 500, 402 ];
        const errorMessageCode = handledErrorCodes.includes(errorCode) ?  `error-server-${errorCode}` : 'error-server';
        console.log(errorMessageCode);
        this.vm.notifier.error(this.vm.t(errorMessageCode));

      }).finally(()=> {
        this.loading = false;
      });
    }
  },
});

module.exports = {
  EspComponent
}
