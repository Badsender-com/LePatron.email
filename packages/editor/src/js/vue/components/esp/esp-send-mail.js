var Vue = require('vue/dist/vue.common');
var { SENDINBLUEComponent } = require('./providers/SendinBlueComponent');
var { ProfileListComponent } = require('../esp/profile-list');
var { getEspIds } = require('../../utils/apis');
var { SEND_MODE } = require('../../constant/send-mode');
var { getCampaignDetail, getProfileDetail } = require('../../../vue/utils/apis');
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
      <div class="material-css">
        <div id="modal1" class="modal  modal-fixed-footer" ref="modalRef">
          <div class="valign-wrapper" :style="{    height: '100%', justifyContent: 'center'}" v-if="loading">
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
            <component
              :loading="loadingExport"
              :key="selectedProfile.id"
              :vm="vm"
              :type="type"
              :fetched-profile="profile"
              :is="espComponent"
              v-else-if="!!selectedProfile && !!profile.id"
              :selectedProfile="selectedProfile"
              :campaignId="campaignId"
              :closeModal="closeModal"
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
    loadingExport: false,
    selectedProfile: null,
    dialog: false,
    modalInstance: null,
    type: SEND_MODE.CREATION,
    campaignId: null,
    espIds: [],
    profile: {}
  }),
  mounted() {
    this.mailingId = this.vm?.metadata?.id;
    const modalRef = this.$refs.modalRef;
    const options = {
      dismissible: false
    };
    this.modalInstance = M.Modal.init(modalRef, options);
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
      this.loading = false;
      return axios.get(getEspIds({mailingId: this.mailingId }))
          .then((response) => {
            this.loading = false;
            this.espIds = (response?.data.result || []);
        }).catch((error) => {
            // handle error
            this.vm.notifier.error(this.vm.t('error-server'));
        }).finally(()=> {
          this.loading = true;
        });
    },
    fetchProfileData(message) {
      this.loading = true;
      let getProfileApi = this.type === SEND_MODE.CREATION ?
        getProfileDetail({ profileId: this.selectedProfile?.id })
        : getCampaignDetail({ profileId: this.selectedProfile?.id, campaignId: this.campaignId });

      axios.get(getProfileApi)
        .then( (response) => {
          // handle success

          const profileResult = response?.data?.result;

          const {
            type,
            id,
            additionalApiData: {
              senderName,
              senderMail,
              replyTo,
              contentSendType
            },
            subject
          } = profileResult;

          this.profile = {
            campaignMailName: this.type === SEND_MODE.CREATION ? this.vm.creationName() : profileResult.name,
            contentSendType: contentSendType,
            senderName,
            senderMail,
            replyTo,
            type,
            subject,
            id
          };

          M.updateTextFields();
        }).catch((error) => {
        // handle error
        this.vm.notifier.error(this.vm.t('error-server'));
      }).finally(() => {
        this.loading = false;
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
      this.modalInstance?.open();
    },
    closeModal() {
      this.modalInstance?.close();
    },
    submitEsp(data) {

      if(!this.vm?.metadata?.url?.sendCampaignMail) {
        return;
      }

      this.loadingExport = true;
      const unprocessedHtml = this.vm.exportHTML();

      axios.post(this.vm.metadata.url.sendCampaignMail, {
        html: unprocessedHtml,
        actionType: this.type,
        profileId: this.profile?.id,
        type: this.profile.type,
        contentSentType: this.profile.contentSentType,
        campaignId: this.campaignId,
        espSendingMailData: {
          campaignMailName: data.campaignMailName,
          subject: data.subject,
        }
      })
        .then((response)=> {
          // handle success
          const successText = this.profile?.contentSendType?.toString().toLowerCase()+'-success-esp-send'
          this.vm.notifier.success(this.vm.t(successText));
          this.closeModal();
        }).catch((error) => {
        // handle error
        const errorCode = error.response.status;
        const handledErrorCodes = [400, 500, 402 ];
        const errorMessageCode = handledErrorCodes.includes(errorCode) ?  `error-server-${errorCode}` : 'error-server';
        this.vm.notifier.error(this.vm.t(errorMessageCode));

      }).finally(()=> {
        this.loadingExport = false;
      });
    }
  },
});

module.exports = {
  EspComponent
}
