const Vue = require('vue/dist/vue.common');
const isEmail = require('validator/lib/isEmail');
const { validationMixin } = require('vuelidate');
const { ModalComponent } = require('../modal/modalComponent');
const { Select } = require('../select/selectComponent');
const { getEmailGroups, sendTestEmails } = require('../../utils/apis');
const styleHelper = require('../../utils/style/styleHelper');

const axios = require('axios');

const TestModalComponent = Vue.component('TestModal', {
  components: {
    ModalComponent,
    Select
  },
  mixins: [validationMixin],
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    inputEmailsTest: '',
    selectedEmailGroup: null,
    isLoading: false,
    isLoadingEmailGroups: false,
    subscriptions: [],
    style: styleHelper,
    emailsGroups: []
  }),
  computed: {
    disableSendTestSubmitButton () {
      return  this.isLoading || 
              this.$v.$invalid ||
              ( (!this.selectedEmailGroup || !this.selectedEmailGroup.code) && !this.inputEmailsTest)
    },
    displayEmailsGroupsSelect() {
      return !this.isLoadingEmailGroups && Array.isArray(this.emailsGroups) && this.emailsGroups.length > 0 ;
    }
  },
  mounted() {
    this.subscriptions = [
      this.vm.openTestModal.subscribe(this.handleOpenTestModalChange),
    ];
    this.fetchEmailsGroups();
    M.updateTextFields();
  },
  beforeDestroy() {
    this.subscriptions.forEach((subscription) => subscription.dispose());
  },
  methods: {
    openModal() {
      this.$refs.modalRef?.openModal();
    },
    closeModal() {
      this.inputEmailsTest = '';
      this.selectedEmailGroup = null;
      this.$refs.modalRef?.closeModal();
    },
    handleOpenTestModalChange(value) {
      if (value === true) {
        this.openModal();
      }
    },
    handleOnClose() {
      this.vm.openTestModal(false);
    },
    fetchEmailsGroups() {
      this.isLoadingEmailGroups = true;
      return axios.get(getEmailGroups({groupId: this.vm?.metadata?.groupId }))
          .then((response) => {
            const { items: emailsGroups } = response.data;
            this.emailsGroups = emailsGroups.map(emailsGroup => ({
              label: emailsGroup.name,
              code: emailsGroup.id
            }));
            M.updateTextFields();
        }).catch((error) => {
            console.error(error);
        }).finally(()=> {
          this.isLoadingEmailGroups = false;
        });
    },
    handleOnSubmit() {
      this.$v.$touch();
      
      if (!this.$v.$invalid) {
        this.sendTestData({ inputEmailsTest: this.$v.inputEmailsTest.$model});
      }
    },
    sendTestData({ inputEmailsTest }) {
      this.isLoading = true;
      let sendTestEmailsData = { 
        rcpt: inputEmailsTest,
        html: this.vm.exportHTML()
      };
      
      if(this.selectedEmailGroup && this.selectedEmailGroup?.code) {
        sendTestEmailsData = { ...sendTestEmailsData, emailsGroupId: this.selectedEmailGroup?.code }
      }
      
      return axios.post(sendTestEmails({ mailingId: this.vm?.metadata?.id }), sendTestEmailsData)
      .then( () => {
        this.vm.notifier.success(this.vm.t('send-test-success'));
      }).catch(() => {
        this.vm.notifier.error(this.vm.t('send-test-error'));
      })
      .finally(() => {
        this.isLoading = false;
        this.closeModal();
      });
    },
    handleOnInput() {
      this.$v.inputEmailsTest.$touch();
    },
    handleSelectedEmailGroup(selectedEmailGroup) {
      this.selectedEmailGroup = selectedEmailGroup;
    }
  },
  template: `
    <modal-component 
        ref="modalRef"
        :onClose="handleOnClose">
        <div class="modal-content">
            <div class="row">
            <div class="col s12">
                <h2>{{vm.t('title-send-test-mails')}}</h2>
            </div>
            <form class="col s12">
                <div class="row" :style="style.mb0">
                <div class="input-field col s12" :style="style.mb0">
                    <input
                      id="testMails"
                      v-model="inputEmailsTest"
                      type="text"
                      name="emailsTest"
                      @input="handleOnInput"
                      :class="[
                          $v.inputEmailsTest.allMustBeEmails ? 'valid' : 'invalid',
                      ]"
                      :placeholder="vm.t('placeholder-input-emails-test')"
                    >
                    <!--Insert here the recipient email address -->
                    <label for="testMails">{{ vm.t('emails-test') }}</label>
                    <span class="helper-text" :data-error="vm.t('emails-invalid')"></span>
                </div>
                </div>
                <div class="row" :style="style.mb0">
                <div class="col s12 m6" v-if="displayEmailsGroupsSelect">
                    <select
                      v-model="selectedEmailGroup"
                      :placeholder="vm.t('placeholder-emails-groups')"
                      :options="emailsGroups">
                      <!--Select email group-->
                    </select>
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
                @click.prevent="handleOnSubmit"
                :disabled="disableSendTestSubmitButton"
                :style="[style.mb0, style.mt0]"
                class="btn waves-effect waves-light"
                type="submit"
                name="submitAction">
                <span v-if="isLoading">{{ vm.t('sending-test-mails') }}</span>
                <span v-else>{{ vm.t('send-test-mails') }} <i class="fa fa-paper-plane" aria-hidden="true"></i></span>
            </button>
        </div>
    </modal-component>
    `,
  validations() {
    return {
      inputEmailsTest: {
        allMustBeEmails(value) {
          if(!value) {
            return true;
          }

          const emails = value.split(';');
          for (const address of emails) {
            if (!isEmail(address)) {
              return false;
            }
          }
          return true;
        },
      },
    };
  },
});

module.exports = {
  TestModalComponent,
};
