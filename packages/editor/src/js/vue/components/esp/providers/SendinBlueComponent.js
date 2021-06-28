import {required} from "vuelidate/lib/validators";

var Vue = require('vue/dist/vue.common');
var { SEND_MODE } = require('../../../constant/send-mode');
var { ESP_TYPE } = require('../../../constant/esp-type');
var { getCampaignDetail, getProfileDetail } = require('../../../utils/apis');
var  { validationMixin } = require('vuelidate');
var axios = require('axios');

const SENDINBLUEComponent = Vue.component('SendinBlueComponent', {
  props: {
    vm: { type: Object, default: () => ({}) },
    campaignMailName: { type: String, default: null},
    closeModal: { type: Function, default: () => {}},
    espId: { type: String, default: null  },
    selectedProfile: { type: Object, default: () => ({}) },
    campaignId: { type: String, default: null },
    type: { type: Number, default: SEND_MODE.CREATION  },
  },
  mixins: [validationMixin],
  template: `
<div>
  <div class="modal-content">
    <div class="row">
      <div class="col s12">
        <h2>{{vm.t('export-to')}} {{selectedProfile.name}}</h2>
      </div>
      <form class="col s12">
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="name"
              v-model="profile.campaignMailName"
              type="text"
              name="name"
              required
              :placeholder="vm.t('name')"
              @input="$v.profile.campaignMailName.$touch()"
              @blur="$v.profile.campaignMailName.$touch()"
              class="validate">
            <label for="name">{{ vm.t('name') }}</label>
            <span v-if="!$v.profile.campaignMailName.required" class="helper-text" :data-error="vm.t('name-required')"></span>

          </div>
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="sender-name"
              type="text"
              v-model="profile.senderName"
              disabled
              :placeholder="vm.t('sender-name')"
              name="senderName"
            >
            <label for="sender-name" class="active">{{ vm.t('sender-name') }}</label>
          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="sender-mail"
              type="text"
              v-model="profile.senderMail"
              disabled
              :placeholder="vm.t('sender-mail')"
              name="senderMail"
            >
            <label for="sender-mail" class="active">{{ vm.t('sender-mail') }}</label>
          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="subject"
              type="text"
              v-model="profile.subject"
              :placeholder="vm.t('subject')"
              name="subject"
              required
              class="validate"
            >
            <label for="subject" class="active">{{ vm.t('subject') }}</label>
            <span class="helper-text" v-if="!$v.profile.subject.required" :data-error="vm.t('subject-required')"></span>

          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="replyto"
              type="text"
              :placeholder="vm.t('replyto')"
              v-model="profile.replyTo"
              name="replyto"
              disabled>
            <label for="replyto" class="active">{{ vm.t('replyto') }}</label>
          </div>
        </div>
      </form>
    </div>
  </div>
  <div class="modal-footer">
        <button
          @click.prevent="closeModal"
          class="btn-flat waves-effect waves-light"
          name="closeAction">
          {{ vm.t('close') }}
        </button>
        <button
          @click.prevent="onSubmit"
          :style="[style.mb0, style.mt0]"
          class="btn waves-effect waves-light"
          type="submit"
          name="submitAction">
          {{ vm.t('submit') }}
        </button>
  </div>
</div>

      `,
  data: () => ({
    profile: {
      campaignMailName: '',
      senderName: '',
      senderMail: '',
      replyTo: '',
      subject: '',
      type: ESP_TYPE.SENDINBLUE,
    },
    style: {
      mb0:{
        marginBottom: 0,
      },
      mt0:{
        marginTop: 0,
      },
    }
  }),
  validations() {
    return {
      profile: {
        campaignMailName: {
          required,
        },
        subject: {
          required,
        },
      }
    }
  },
  mounted() {
    if(!!this.vm) {
      this.profile.campaignMailName = this.vm.creationName();
    }
    this.fetchData();
  },
  methods: {
    fetchData() {
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
              replyTo
            },
            subject
          } = profileResult;

          this.profile = {
            campaignMailName: this.type === SEND_MODE.CREATION ? this.profile.campaignMailName : profileResult.name,
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
      });
    },
    onSubmit() {
      M.updateTextFields();
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
