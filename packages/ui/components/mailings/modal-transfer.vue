<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  name: 'BsMailingsModalTransfer',
  mixins: [validationMixin],
  model: { prop: 'dialogInfo', event: 'update' },
  props: {
    dialogInfo: {
      type: Object,
      default: () => ({ mailingId: false, templateId: false, show: false }),
    },
  },
  data() {
    return {
      userId: '',
      loadingUsersList: false,
      group: {},
      users: [],
    };
  },
  watch: {
    currentTemplateId(templateId) {
      if (!templateId) return;
      this.getUsersList(templateId);
    },
  },
  validations() {
    return {
      userId: { required },
    };
  },
  computed: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    localModel: {
      get() {
        return this.dialogInfo;
      },
      set(updatedValue) {
        this.$emit('update', updatedValue);
      },
    },
    // make a computed so we can watch in a clean manner the nested prop change
    currentTemplateId() {
      return this.dialogInfo.templateId;
    },
    userIdErrors() {
      const errors = [];
      if (!this.$v.userId.$dirty) return errors;
      !this.$v.userId.required &&
        errors.push(this.$t('global.errors.userRequired'));
      return errors;
    },
  },

  methods: {
    closeDialog() {
      this.userId = '';
      this.group = {};
      this.users = [];
      this.$v.$reset();
      this.$emit('close');
    },
    transferMailing() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('transfer', {
        mailingId: this.dialogInfo.mailingId,
        userId: this.userId,
      });
      this.closeDialog();
    },
    async getUsersList(templateId) {
      this.loadingUsersList = true;
      const { $axios } = this;
      try {
        const template = await $axios.$get(
          apiRoutes.templatesItem({ templateId })
        );
        this.group = template.group;
        const groupId = template.group.id;
        const groupUsers = await $axios.$get(
          apiRoutes.groupsItemUsers({ groupId })
        );
        this.users = groupUsers.items;
      } catch (error) {
        this.showSnackbar({
          text: this.$t('snackbars.userFetchError'),
          color: 'error',
        });
        this.closeDialog();
      } finally {
        this.loadingUsersList = false;
      }
    },
  },
};
</script>

<template>
  <v-dialog
    v-model="localModel.show"
    class="bs-mailings-modal-rename"
    width="500"
  >
    <v-card>
      <v-card-title class="headline">
        {{
          $t('mailings.transfer.label')
        }}
      </v-card-title>
      <v-card-text>
        <v-progress-linear
          :active="loadingUsersList"
          indeterminate
          color="light-blue"
        />
        <v-select
          id="transferUserId"
          v-model="userId"
          :label="$tc('global.user', 1)"
          name="transferUserId"
          :disabled="loadingUsersList"
          :items="users"
          :error-messages="userIdErrors"
          item-value="id"
          item-text="email"
          @change="$v.userId.$touch()"
          @blur="$v.userId.$touch()"
        />
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="closeDialog">
          {{
            $t(`global.cancel`)
          }}
        </v-btn>
        <v-btn
          :disabled="loadingUsersList"
          color="primary"
          flat
          @click="transferMailing"
        >
          {{ $t(`global.update`) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped></style>
