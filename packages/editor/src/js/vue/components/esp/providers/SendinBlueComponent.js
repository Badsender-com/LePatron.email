import {required} from "vuelidate/lib/validators";

var Vue = require('vue/dist/vue.common');
var { SEND_MODE } = require('../../../constant/send-mode');
var { getCampaignDetail, getProfileDetail } = require('../../../utils/apis');
var validationMixin = require('vuelidate');
var axios = require('axios');

const SENDINBLUEComponent = Vue.component('SendinBlueComponent', {
  props: {
    vm: { type: Object, default: () => ({}) },
    campaignMailName: { type: String, default: null},
    espId: { type: String, default: null  },
    selectedProfileId: { type: String, default: null },
    campaignId: { type: String, default: null },
    type: { type: Number, default: SEND_MODE.CREATION  },
  },
  mixins: [validationMixin],
  template: `
    <div class="row">
    <form class="col s12">
      <div class="row">
        <div class="input-field col s12">
          <input
            id="name"
            v-model="profile.campaignMailName"
            type="text"
            name="name"
            class="validate">
          <label for="name">name</label>
        </div>
      </div>
      <div class="row">
        <div class="input-field col s12">
          <input
            id="sender"
            type="text"
            v-model="profile.senderName"
            name="sender"
            disabled
            class="validate">
          <label for="sender">Sender</label>
        </div>
      </div>
      <div class="row">
        <div class="input-field col s12">
          <input
            id="sender-mail"
            type="email"
            v-model="profile.senderMail"
            name="sendermail"
            class="validate"
            disabled
          >
          <label for="sender-mail">Sender mail</label>
        </div>
      </div>
      <div class="row">
        <div class="input-field col s12">
          <input
            id="subject"
            type="text"
            v-model="profile.subject"
            name="subject"
            class="validate">
          <label for="subject">Subject</label>
        </div>
      </div>
      <div class="row">
        <div class="input-field col s12">
          <input
            id="replyto"
            type="text"
            v-model="profile.replyTo"
            name="replyto"
            disabled
            class="validate">
          <label for="replyto">ReplyTo</label>
        </div>
      </div>
      <div class="row">
        <div class="input-field col s12">
          <button
            @click.prevent="onSubmit"
            class="btn waves-effect waves-light"
            type="submit"
            name="action">
            Submit
          </button>
        </div>
      </div>
    </form>
    </div>
      `,
  data: () => ({
    profile: {
      campaignMailName: '',
      senderName: '',
      senderMail: '',
      replyTo: '',
      subject: '',
      type: 'SENDINBLUE',
    },
  }),
  validations() {
    return {
      profile: {
        subject: {
          required,
        },
      }
    }
  },
  computed: {
    nameErrors() {
      const errors = [];
      if (!this.$v.profile.subject.$dirty) return errors;
      !this.$v.profile.subject.required &&
      errors.push(this.vm.t('global.errors.nameRequired'));
      return errors;
    },
  },
  mounted() {
    // TODO: Get profile detail based on mode (creation or edition)
    this.fetchData();
  },
  methods: {
    fetchData() {
      let getProfileApi = this.type === SEND_MODE.CREATION ?
        getProfileDetail({ profileId: this.selectedProfileId })
        : getCampaignDetail({ profileId: this.selectedProfileId, campaignId: this.campaignId });

      axios.get(getProfileApi)
        .then( (response) => {
          // handle success
          console.log({ response });
          console.log({ result: response?.data?.result });
          const profileResult = response?.data?.result;
          const {
            type,
            id,
            additionalApiData: {
              senderName,
              senderMail,
              replyTo
            }
          } = profileResult;
          const formattedProfileData = {
            campaignMailName: this.profile.campaignMailName,
            senderName,
            senderMail,
            replyTo,
            type,
            id
          };
          this.profile = formattedProfileData;
          console.log({
            profile: this.profile
          })
        }).catch((error) => {
        // handle error
        this.vm.notifier.success(this.vm.t('error-server'));
      });
    },
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }

      this.$emit('submit', this.profile);
    },
  },
})

module.exports = {
  SENDINBLUEComponent
}
