import { required } from 'vuelidate/lib/validators';

const Vue = require('vue/dist/vue.common');
const { SEND_MODE } = require('../../../constant/send-mode');
const { ESP_TYPE } = require('../../../constant/esp-type');
const { TimeInput } = require('../../time-input/timeInput');
const { validationMixin } = require('vuelidate');
const styleHelper = require('../../../utils/style/styleHelper');

const DscComponent = Vue.component('DscComponent', {
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
        planification: '',
        subject: '',
        campaignMailName: '',
        type: ESP_TYPE.DSC,
      },
      style: styleHelper,
    };
  },
  computed: {
    isEditMode() {
      return this.type === SEND_MODE.EDIT;
    },
  },
  mounted() {
    const {
      campaignMailName,
      subject,
      id,
      additionalApiData: { planification, typeCampagne },
    } = this.fetchedProfile;

    this.profile = {
      campaignMailName: campaignMailName ?? '',
      planification: planification ?? '',
      subject: subject ?? '',
      controlMail: vm.currentUser().email,
      typeCampagne: typeCampagne ?? '',
      id: this.campaignMailName,
    };
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
  },
  template: `
  <template>
    <div>
      <div class="modal-content">
        <div class="row">
          <div class="col s12">
            <h5>{{ vm.t('export-to') }} {{ selectedProfile.name }}</h5>
          </div>
          <form class="col s12">
            <div class="row" v-if="isEditMode">
              <div class="col s12">
                <div class="card-panel blue-grey lighten-5">
                  <div :style="style.flexContainer">
                    <div>
                      <i
                        class="fa fa-exclamation-circle fa-2x"
                        aria-hidden="true"
                        :style="style.colorOrange"
                      ></i>
                    </div>
                    <div :style="style.pl4">
                      <span>{{ vm.t('warning-esp-message') }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="row" :style="style.mb0">
              <div class="input-field col s12" :style="style.mb0">
                <input
                  id="campaignMailName"
                  v-model="profile.campaignMailName"
                  type="text"
                  name="campaignMailName"
                  required
                  :disabled="isEditMode"
                  :placeholder="vm.t('mailName')"
                  @input="$v.profile.campaignMailName.$touch()"
                  @blur="$v.profile.campaignMailName.$touch()"
                  :class="[
                    'validate',
                    $v.profile.campaignMailName.required ? 'valid' : 'invalid',
                  ]"
                />
                <label for="dscIdMail">{{ vm.t('mailName') }}</label>
                <span
                  v-if="!$v.profile.campaignMailName.required"
                  class="helper-text"
                  :data-error="vm.t('mail-name-required')"
                ></span>
              </div>
            </div>
            <div class="row" :style="style.mb0">
              <div class="col s12" :style="style.mb0">
                <label for="planification">{{ vm.t('planification') }}</label><br/>
                <time-input id="planification"  name="planification" v-model="profile.planification"></time-input>
              </div>
            </div>
            <div class="row" :style="style.mb0">
              <div class="input-field col s12" :style="style.mb0">
                <input
                  id="subject"
                  type="text"
                  v-model="profile.subject"
                  :placeholder="vm.t('mail-subject-required')"
                  name="subject"
                  required
                  :class="[
                    'validate',
                    $v.profile.subject.required ? 'valid' : 'invalid',
                  ]"
                  class="validate"
                />
                <label for="subject" class="active">{{
                  vm.t('mail-subject-required')
                }}</label>
                <span
                  class="helper-text"
                  :data-error="vm.t('mail-subject-required')"
                ></span>
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
  </template>

      `,
  validations() {
    return {
      profile: {
        campaignMailName: {
          required,
        },
        subject: {
          required,
        },
      },
    };
  },
});

module.exports = {
  DscComponent,
};
