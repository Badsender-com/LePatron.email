const Vue = require('vue/dist/vue.common');
const { SendinBlueComponent } = require('./providers/SendinBlueComponent');
const { ActitoComponent } = require('./providers/ActitoComponent');
const { ModalComponent } = require('../modal/modalComponent');
const { getEspIds } = require('../../utils/apis');
const { SEND_MODE } = require('../../constant/send-mode');
const { ESP_TYPE } = require('../../constant/esp-type');

const { getCampaignDetail, getProfileDetail } = require('../../../vue/utils/apis');
const axios = require('axios');

const EspComponent = Vue.component('EspForm', {
  components: {
    SendinBlueComponent,
    ActitoComponent,
    ModalComponent
  },
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    mailingId: null,
    isLoading: false,
    isLoadingExport: false,
    selectedProfile: null,
    type: SEND_MODE.CREATION,
    campaignId: null,
    espIds: [],
    fetchedProfile: {},
  }),
  computed: {
    espComponent() {
      switch (this.selectedProfile?.type) {
        case ESP_TYPE.ACTITO:
          return 'ActitoComponent';
        case ESP_TYPE.SENDINBLUE:
          return 'SendinBlueComponent';
        default:
          return 'SendinBlueComponent';
      }
    }
  },
  mounted() {
    this.mailingId = this.vm?.metadata?.id;
    this.fetchData();
    this.subscriptions = [
      this.vm.selectedProfile.subscribe(this.handleProfileSelect)
    ];
  },
  beforeDestroy() {
    this.subscriptions.forEach(subscription => subscription.dispose());
  },
  methods: {
    fetchData() {
      this.isLoading = true;
      return axios.get(getEspIds({mailingId: this.mailingId }))
          .then((response) => {
            this.espIds = (response?.data.result || []);
        }).catch((error) => {
            // handle error
            console.log(error);
            this.vm.notifier.error(this.vm.t('error-server'));
        }).finally(()=> {
          this.isLoading = false;
        });
    },
    fetchProfileData(message) {
      this.isLoading = true;
      const getProfileApi = this.type === SEND_MODE.CREATION ?
        getProfileDetail({ profileId: this.selectedProfile?.id })
        : getCampaignDetail({ profileId: this.selectedProfile?.id, campaignId: this.campaignId });

      axios.get(getProfileApi)
        .then( (response) => {
          // handle success

          const profileResult = response?.data?.result;

          const {
            type,
            id,
            additionalApiData,
            subject
          } = profileResult;

          this.fetchedProfile = {
            campaignMailName: this.type === SEND_MODE.CREATION ? this.vm.creationName() : profileResult.name,
            contentSendType: additionalApiData?.contentSendType,
            additionalApiData,
            type,
            subject,
            id
          };

          M.updateTextFields();
        }).catch((error) => {
        // handle error
        console.log(error);
        this.vm.notifier.error(this.vm.t('error-server'));
      }).finally(() => {
        this.isLoading = false;
      });
    },
    handleProfileSelect(profile) {
      this.selectedProfile = profile;
      this.fetchData().then(() => {
        this.checkIfAlreadySendMailWithProfile();
        this.fetchProfileData();
        this.openModal();
      });
    },
    checkIfAlreadySendMailWithProfile() {
      if(!this.selectedProfile?.id || !this.espIds) {
        return;
      }
      this.type = SEND_MODE.CREATION;
      this.espIds.forEach((espId) => {
          if (espId?.profileId === this.selectedProfile?.id) {
            this.campaignId = espId.campaignId.toString();
            this.type = SEND_MODE.EDIT
          }
      });

      if(this.type === SEND_MODE.CREATION) {
        this.campaignId = null;
      }
    },
    openModal() {
      this.$refs.modalRef?.openModal();
    },
    closeModal() {
      this.$refs.modalRef?.closeModal();
    },
    submitEsp(data) {

      if(!this.vm?.metadata?.url?.sendCampaignMail) {
        return;
      }

      this.isLoadingExport = true;
      const unprocessedHtml = this.vm.exportHTML();

      axios.post(this.vm.metadata.url.sendCampaignMail, {
        html: unprocessedHtml,
        actionType: this.type,
        profileId: this.fetchedProfile?.id,
        type: this.fetchedProfile.type,
        contentSentType: this.fetchedProfile.contentSentType,
        campaignId: this.campaignId,
        espSendingMailData: {
          campaignMailName: data.campaignMailName,
          subject: data.subject,
        }
      })
        .then((response)=> {
          // handle success
          const successText = this.fetchedProfile?.contentSendType?.toString().toLowerCase()+'-success-esp-send'
          this.vm.notifier.success(this.vm.t(successText));
          this.closeModal();
        }).catch((error) => {
        // handle error
        const errorCode = error.response.status;
        const handledErrorCodes = [400, 500, 402, 409 ];
        const errorMessageCode = handledErrorCodes.includes(errorCode) ?  `error-server-${errorCode}` : 'error-server';
        this.vm.notifier.error(this.vm.t(errorMessageCode));

      }).finally(()=> {
        this.isLoadingExport = false;
      });
    }
  },
  template: `
    <modal-component 
        ref="modalRef"
        :isLoading="isLoading"
        v-if="selectedProfile && fetchedProfile"
        >
      <component
        :isLoading="isLoadingExport"
        :key="selectedProfile.id"
        :vm="vm"
        :type="type"
        :fetched-profile="fetchedProfile"
        :is="espComponent"
        :selectedProfile="selectedProfile"
        :campaignId="campaignId"
        :closeModal="closeModal"
        @submit="submitEsp"
      >
      </component>
    </modal-component>
      `
});

module.exports = {
  EspComponent
}
