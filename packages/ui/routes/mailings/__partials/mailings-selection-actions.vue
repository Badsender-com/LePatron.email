<script>
import ModalMoveMail from '~/routes/mailings/__partials/modal-move-mail';
import BsModalConfirm from '~/components/modal-confirm';
import MailingsTagsMenu from '~/components/mailings/tags-menu.vue';
import { moveManyMails, mailingsItem } from '~/helpers/api-routes';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  name: 'MailingsSelectionActions',
  components: { ModalMoveMail, BsModalConfirm, MailingsTagsMenu },
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
    openDeleteSelectionModal() {
      this.$refs.deleteSelectionDialog.open();
    },
    closeMoveManyMailsDialog() {
      this.$refs.moveManyMailsDialog.close();
    },
    async handleMultipleDelete() {
      const { $route } = this;
      try {
        const mailSelectionDeletionPromises = this.mailingsSelection.map(
          (mailing) =>
            this.$axios.$delete(mailingsItem({ mailingId: mailing.id }), {
              data: {
                workspaceId: $route.query.wid,
              },
            })
        );
        await Promise.all(mailSelectionDeletionPromises);

        this.$emit('on-refetch');
        this.showSnackbar({
          text: this.$t('mailings.deleteManySuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      }
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
          text: this.$t('mailings.moveManySuccessful'),
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
          <mailings-tags-menu
            :tags="tags"
            :mailings-selection="mailingsSelection"
            @create="$emit(`createTag`, $event)"
            @update="$emit(`updateTags`, $event)"
          />
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
          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                icon
                color="info"
                v-on="on"
                @click="openDeleteSelectionModal"
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </template>
            <span>{{
              $tc('mailings.deleteCount', selectionLength, {
                count: selectionLength,
              })
            }}</span>
          </v-tooltip>
        </div>
      </div>
    </v-alert>
    <bs-modal-confirm
      ref="deleteSelectionDialog"
      :title="
        $tc('mailings.deleteCount', selectionLength, {
          count: selectionLength,
        })
      "
      :action-label="$t('global.delete')"
      action-button-color="error"
      @confirm="handleMultipleDelete(se)"
    >
      <p
        class="black--text"
        v-html="$t('mailings.deleteConfirmationMessage')"
      />
    </bs-modal-confirm>
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
