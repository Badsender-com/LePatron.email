<script>
import { mapMutations } from 'vuex'

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js'
import * as apiRoutes from '~/helpers/api-routes.js'
import BsModalConfirm from '~/components/modal-confirm.vue'

export default {
  name: `bs-user-modals-confirmation`,
  components: { BsModalConfirm },
  model: { prop: `loading`, event: `updateLoading` },
  props: {
    loading: { type: Boolean, default: false },
    user: { type: Object, default: () => ({ group: {} }) },
  },
  computed: {
    localLoading: {
      get() {
        return this.loading
      },
      set(newLoading) {
        this.$emit(`updateLoading`, newLoading)
      },
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    activate(user) {
      this.$refs.activateDialog.open()
    },
    deactivate(user) {
      this.$refs.deactivateDialog.open()
    },
    resetPassword(user) {
      this.$refs.resetPasswordDialog.open()
    },
    sendPassword(user) {
      this.$refs.sendPasswordDialog.open()
    },
    resendPassword(user) {
      this.$refs.resendPasswordDialog.open()
    },
    async activateUser() {
      const { $axios } = this
      const userId = this.user.id
      if (!userId) return
      try {
        this.localLoading = true
        const user = await $axios.$put(apiRoutes.usersItemActivate({ userId }))
        this.showSnackbar({ text: this.$t('global.enabled'), color: `success` })
        this.$emit(`update`, user)
        this.$emit(`activate`, user)
      } catch (error) {
        this.showSnackbar({ text: this.$t('global.errors.errorOccured'), color: `error` })
        console.log(error)
      } finally {
        this.localLoading = false
      }
    },
    async deactivateUser() {
      const { $axios } = this
      const userId = this.user.id
      if (!userId) return
      try {
        this.localLoading = true
        const user = await $axios.$delete(apiRoutes.usersItem({ userId }))
        this.showSnackbar({ text: this.$t('global.disabled'), color: `success` })
        this.$emit(`update`, user)
        this.$emit(`deactivate`, user)
      } catch (error) {
        this.showSnackbar({ text: this.$t('global.errors.errorOccured'), color: `error` })
        console.log(error)
      } finally {
        this.localLoading = false
      }
    },
    async sendPasswordMail() {
      const { $axios } = this
      const userId = this.user.id
      if (!userId) return
      try {
        this.localLoading = true
        const user = await $axios.$delete(
          apiRoutes.usersItemPassword({ userId }),
        )
        this.showSnackbar({ text: this.$t('snackbars.emailSent'), color: `success` })
        this.$emit(`update`, user)
        this.$emit(`sendPassword`, user)
      } catch (error) {
        this.showSnackbar({ text: this.$t('global.errors.errorOccured'), color: `error` })
        console.log(error)
      } finally {
        this.localLoading = false
      }
    },
  },
}
</script>

<template>
  <aside class="bs-user-modals-confirmation">
    <bs-modal-confirm
      ref="activateDialog"
      :title="`${this.$t('global.enable')}`"
      :action-label="$t('global.enable')"
      @confirm="activateUser"
    >{{$t('users.enableNotice')}} <b>{{ user.name | capitalizeEach }}</b>?</bs-modal-confirm>
    <bs-modal-confirm
      ref="deactivateDialog"
      :title="`${this.$t('global.disable')}`"
      :action-label="$t('global.disable')"
      @confirm="deactivateUser"
    >{{this.$t('users.disableNotice')}} <b>{{ user.name | capitalizeEach }}</b>?</bs-modal-confirm>
    <bs-modal-confirm
      ref="resetPasswordDialog"
      :title="$t('users.passwordTooltip.reset')"
      :action-label="$t('users.actions.reset')"
      @confirm="sendPasswordMail"
    >{{this.$t('users.passwordNotice.reset')}} <b>{{ user.name | capitalizeEach }}</b>?</bs-modal-confirm>

    <bs-modal-confirm
      ref="sendPasswordDialog"
      :title="$t('users.passwordTooltip.send')"
      :action-label="$t('users.actions.send')"
      @confirm="sendPasswordMail"
    >{{$t('users.passwordNotice.send')}} <b>{{ user.name | capitalizeEach }}</b>?</bs-modal-confirm>

    <bs-modal-confirm
      ref="resendPasswordDialog"
      :title="$t('users.passwordTooltip.resend')"
      :action-label="$t('users.actions.resend')"
      @confirm="sendPasswordMail"
    >{{$t('users.passwordNotice.resend')}} <b>{{ user.name | capitalizeEach }}</b>?</bs-modal-confirm>
  </aside>
</template>

<style lang="scss" scoped>
</style>
