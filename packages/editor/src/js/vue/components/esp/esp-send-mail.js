const Vue = require('vue/dist/vue.common');
const { SendinBlueComponent } = require('./providers/SendinBlueComponent');
const { ActitoComponent } = require('./providers/ActitoComponent');
const { AdobeComponent } = require('./providers/AdobeComponent');
const { DscComponent } = require('./providers/DscComponent');
const { ModalComponent } = require('../modal/modalComponent');
const { getEspIds } = require('../../utils/apis');
const { SEND_MODE } = require('../../constant/send-mode');
const { ESP_TYPE } = require('../../constant/esp-type');
const {
  getErrorsForControlQuality,
  displayErrors,
} = require('../../../ext/badsender-control-quality');

const {
  getCampaignDetail,
  getProfileDetail,
} = require('../../../vue/utils/apis');
const axios = require('axios');

const EspComponent = Vue.component('EspForm', {
  components: {
    SendinBlueComponent,
    ActitoComponent,
    AdobeComponent,
    DscComponent,
    ModalComponent,
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
    folders: [],
  }),
  computed: {
    espComponent() {
      switch (this.selectedProfile?.type) {
        case ESP_TYPE.ACTITO:
          return 'ActitoComponent';
        case ESP_TYPE.SENDINBLUE:
          return 'SendinBlueComponent';
        case ESP_TYPE.DSC:
          return 'DscComponent';
        case ESP_TYPE.ADOBE:
          return 'AdobeComponent';
        default:
          return 'SendinBlueComponent';
      }
    },
  },
  mounted() {
    this.mailingId = this.vm?.metadata?.id;
    this.fetchData();
    this.subscriptions = [
      this.vm.selectedProfile.subscribe(this.handleProfileSelect),
    ];
  },
  beforeDestroy() {
    this.subscriptions.forEach((subscription) => subscription.dispose());
  },
  methods: {
    async fetchData() {
      this.isLoading = true;

      if (this.selectedProfile?.type === ESP_TYPE.ADOBE) {
        try {
          const { data } = await axios.get(
            `/api/profiles/${this.selectedProfile.id}/adobe-folders`
          );
          this.folders = data.result;
        } catch (err) {
          console.error('Error while fetching adobe folders : ', err);
        }
      }

      return axios
        .get(getEspIds({ mailingId: this.mailingId }))
        .then((response) => {
          this.espIds = response?.data.result || [];
        })
        .catch((error) => {
          // handle error
          console.log(error);
          this.vm.notifier.error(this.vm.t('error-server'));
        })
        .finally(() => {
          this.isLoading = false;
        });
    },
    fetchProfileData(message) {
      this.isLoading = true;
      const getProfileApi =
        this.type === SEND_MODE.CREATION
          ? getProfileDetail({ profileId: this.selectedProfile?.id })
          : getCampaignDetail({
              profileId: this.selectedProfile?.id,
              campaignId: this.campaignId,
            });

      axios
        .get(getProfileApi)
        .then((response) => {
          // handle success

          const profileResult = response?.data?.result;

          const { type, id, additionalApiData, subject } = profileResult;

          this.fetchedProfile = {
            campaignMailName:
              this.type === SEND_MODE.CREATION
                ? this.vm.creationName()
                : profileResult.name,
            contentSendType: additionalApiData?.contentSendType,
            additionalApiData,
            type,
            subject,
            id,
          };

          M.updateTextFields();
        })
        .catch((error) => {
          // handle error
          console.log(error);

          /*
            If the campaign for this profile should exist but was not found on DSC,
            Then it was probably deleted on DSC's side.
            So we allow the user to create a new one
          */
          if (error.response.status === 404) {
            this.type = SEND_MODE.CREATION;
            this.fetchProfileData(message);
            return;
          }

          this.vm.notifier.error(this.vm.t('error-server'));
        })
        .finally(() => {
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
      if (!this.selectedProfile?.id || !this.espIds) {
        return;
      }
      this.type = SEND_MODE.CREATION;
      this.espIds.forEach((espId) => {
        if (espId?.profileId === this.selectedProfile?.id) {
          this.campaignId = espId.campaignId.toString();
          this.type = SEND_MODE.EDIT;
        }
      });

      if (this.type === SEND_MODE.CREATION) {
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
      if (!this.vm?.metadata?.url?.sendCampaignMail) {
        return;
      }

      this.isLoadingExport = true;
      const unprocessedHtml = this.vm.exportHTML();

      axios
        .post(this.vm.metadata.url.sendCampaignMail, {
          html: unprocessedHtml,
          actionType: this.type,
          profileId: this.fetchedProfile?.id,
          type: this.fetchedProfile.type,
          contentSentType: this.fetchedProfile.contentSentType,
          campaignId: this.campaignId,
          espSendingMailData: {
            campaignMailName: data?.campaignMailName,
            adobe: {
              folderFullName: data?.folderFullName,
              deliveryInternalName: data?.deliveryInternalName,
            },
            subject: data?.subject,
            planification: data?.planification,
            typeCampagne: data?.typeCampagne,
          },
        })
        .then((response) => {
          // handle success
          const successText =
            this.fetchedProfile?.contentSendType?.toString().toLowerCase() +
            '-success-esp-send';
          this.vm.notifier.success(this.vm.t(successText));
          const errors = getErrorsForControlQuality(this.vm);
          if (errors && errors.length > 0) {
            displayErrors(errors, this.vm);
          } else {
            $('.error-message').remove();
          }
          this.closeModal();
        })
        .catch((error) => {
          // Fallback to previous error handling
          const errorMessageKey = this.getErrorMessageKeyFromError(error);
          this.vm.notifier.error(this.vm.t(errorMessageKey));
        })
        .finally(() => {
          this.isLoadingExport = false;
        });
    },
    getErrorMessageKeyFromError(error) {
      const errorCode = error.response.status;
      const errorData = error.response.data;
      const defaultErrorMessageKey = 'error-server'; // Fallback error message key

      // Custom error handling logic based on the error response
      if (errorCode === 400) {
        if (errorData.includes('BADSENDER_ID_FORMAT_ERROR')) {
          return 'error-bad-sender-id-format';
        }
        if (errorData.includes('La combinaison code campagne')) {
          return 'error-invalid-campaign-combination';
        }
      }

      // Standard error message keys for known status codes
      const handledErrorCodes = {
        400: 'error-server-400',
        402: 'error-server-402',
        409: 'error-server-409',
        500: 'error-server-500',
      };

      return handledErrorCodes[errorCode] || defaultErrorMessageKey;
    },
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
        :fetchedFolders="folders"
        @submit="submitEsp"
      >
      </component>
    </modal-component>
      `,
});

module.exports = {
  EspComponent,
};
