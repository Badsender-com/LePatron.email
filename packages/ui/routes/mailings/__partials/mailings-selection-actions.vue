<script>
import ModalMoveMail from '~/routes/mailings/__partials/modal-move-mail';
import { moveManyMails } from '~/helpers/api-routes';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  name: 'MailingsSelectionActions',
  components: { ModalMoveMail },
  props: {
    mailingsSelection: { type: Array, default: () => [] },
    tags: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      deleteDialog: false,
    };
  },
  computed: {
    selectionLength() {
      return this.mailingsSelection.length;
    },
    hasSelection() {
      return this.selectionLength > 0;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    openMoveManyMailsDialog() {
      this.$refs.moveManyMailsDialog.open({
        workspace: {
          id: this.workspace?.id,
        },
      });
    },
    closeMoveManyMailsDialog() {
      this.$refs.moveManyMailsDialog.close();
    },
    async moveManyMails({ destinationWorkspaceId, _ }) {
      try {
        await this.$axios.$post(moveManyMails(), {
          mailingsIds: this.mailingsSelection?.map((mail) => mail?.id),
          workspaceId: destinationWorkspaceId,
        });
        this.$router.push({
          query: { wid: destinationWorkspaceId },
        });
        this.showSnackbar({
          text: this.$t('mailings.moveMailSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
      this.closeMoveManyMailsDialog();
    },
  },
};
</script>

<template>
  <div>
    <v-alert v-if="hasSelection" text dense color="info">
      <div class="bs-mailing-selection-actions">
        <span class="bs-mailing-selection-actions__count">{{
          $tc('mailings.selectedCount', selectionLength, {
            count: selectionLength,
          })
        }}</span>

        <div class="bs-mailing-selection-actions__actions">
          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                icon
                color="info"
                v-on="on"
                @click="openMoveManyMailsDialog"
              >
                <v-icon>drive_file_move</v-icon>
              </v-btn>
            </template>
            <span>{{
              $tc('mailings.moveCount', selectionLength, {
                count: selectionLength,
              })
            }}</span>
          </v-tooltip>
        </div>
      </div>
    </v-alert>
    <modal-move-mail
      ref="moveManyMailsDialog"
      :is-moving-many-mails="true"
      :confirmation-title-label="`${this.$t(
        'global.moveManyMail'
      )} (${selectionLength})`"
      @confirm="moveManyMails"
    >
      <p
        class="black--text"
        v-html="$t('mailings.moveMailConfirmationMessage')"
      />
    </modal-move-mail>
  </div>
</template>

<style lang="scss" scoped>
.bs-mailing-selection-actions {
  display: flex;
  align-items: center;
}
.bs-mailing-selection-actions__count {
  margin-right: auto;
}
</style>
