<template>
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('deliverability.audits.title') }}
      </template>
      <template #actions>
        <v-btn
          color="primary"
          :disabled="loading"
          @click="createAuditDialog = true"
        >
          <lucide-plus :size="20" class="mr-2" />
          {{ $t('deliverability.audits.newAudit') }}
        </v-btn>
      </template>
    </bs-page-header>

    <!-- Loading state -->
    <div v-if="loading" class="empty-state">
      <v-progress-circular
        indeterminate
        color="primary"
        size="64"
      />
      <p class="empty-state__text">
        {{ $t('deliverability.audits.loadingAudits') }}
      </p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!audits || audits.length === 0" class="empty-state">
      <lucide-mail :size="64" color="var(--gray-400)" />
      <p class="empty-state__title">
        {{ $t('deliverability.audits.noAuditsYet') }}
      </p>
      <p class="empty-state__text">
        {{ $t('deliverability.audits.createPrompt') }}
      </p>
      <v-btn color="primary" class="mt-4" @click="createAuditDialog = true">
        <lucide-plus :size="20" class="mr-2" />
        {{ $t('deliverability.audits.createFirstAudit') }}
      </v-btn>
    </div>

    <!-- Audits grid -->
    <div v-else class="audits-grid">
      <audit-card
        v-for="audit in audits"
        :key="audit.id"
        :audit="audit"
        @refresh="fetchAudits"
      />
    </div>

    <!-- Create Audit Dialog -->
    <v-dialog v-model="createAuditDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title>
          <span class="text-h5">{{
            $t('deliverability.audits.createDialog.title')
          }}</span>
        </v-card-title>

        <v-card-text>
          <v-form ref="form" v-model="formValid">
            <v-text-field
              v-model="newAudit.name"
              :label="$t('deliverability.audits.createDialog.nameLabel') + ' *'"
              :rules="[rules.required]"
              outlined
              autofocus
              @keyup.enter="handleCreateAudit"
            />

            <v-select
              v-model="newAudit.status"
              :items="statusOptions"
              :label="$t('deliverability.audits.createDialog.statusLabel')"
              outlined
            />
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn text @click="closeCreateDialog">
            {{
              $t('deliverability.audits.createDialog.cancel')
            }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!formValid || creating"
            :loading="creating"
            @click="handleCreateAudit"
          >
            {{ $t('deliverability.audits.createDialog.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--r-md);
  margin: 24px;
}

.empty-state__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-900);
  margin: 16px 0 8px 0;
}

.empty-state__text {
  font-size: 14px;
  color: var(--gray-600);
  margin: 0 0 16px 0;
  max-width: 400px;
}

.audits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  padding: 24px;
}

@media (max-width: 960px) {
  .audits-grid {
    grid-template-columns: 1fr;
    padding: 16px;
  }

  .empty-state {
    margin: 16px;
    padding: 48px 24px;
  }
}
</style>

<script>
import { mapState, mapActions } from 'vuex';
import { Plus, Mail } from 'lucide-vue';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import { ACL_USER } from '~/helpers/pages-acls.js';
import { IS_ADMIN, USER } from '~/store/user';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import {
  DELIVERABILITY,
  FETCH_AUDITS,
  CREATE_AUDIT,
} from '~/store/deliverability';
import AuditCard from '~/components/deliverability/audit-card.vue';

export default {
  name: 'PageDeliverabilityAudits',
  components: {
    AuditCard,
    LucidePlus: Plus,
    LucideMail: Mail,
  },
  mixins: [mixinPageTitle],
  meta: { acl: ACL_USER, sidebarModule: 'deliverability' },
  middleware({ store, redirect }) {
    // Redirect admins to groups page
    if (store.getters[`${USER}/${IS_ADMIN}`]) {
      redirect('/groups');
    }
  },
  async asyncData({ store }) {
    try {
      await store.dispatch(`${DELIVERABILITY}/${FETCH_AUDITS}`);
      return {};
    } catch (err) {
      console.error('Error loading audits:', err);
      return {};
    }
  },
  data() {
    return {
      createAuditDialog: false,
      formValid: false,
      creating: false,
      newAudit: {
        name: '',
        status: 'DRAFT',
      },
      statusOptions: [
        { text: this.$t('deliverability.audits.status.draft'), value: 'DRAFT' },
        {
          text: this.$t('deliverability.audits.status.inProgress'),
          value: 'IN_PROGRESS',
        },
        {
          text: this.$t('deliverability.audits.status.completed'),
          value: 'COMPLETED',
        },
        {
          text: this.$t('deliverability.audits.status.archived'),
          value: 'ARCHIVED',
        },
      ],
      rules: {
        required: (value) =>
          !!value || this.$t('deliverability.audits.createDialog.nameRequired'),
      },
    };
  },
  computed: {
    ...mapState(DELIVERABILITY, ['audits', 'loading']),
    pageTitle() {
      return this.$t('deliverability.audits.title');
    },
  },
  methods: {
    ...mapActions(DELIVERABILITY, {
      fetchAudits: FETCH_AUDITS,
      createAudit: CREATE_AUDIT,
    }),
    async handleCreateAudit() {
      if (!this.$refs.form.validate()) {
        return;
      }

      this.creating = true;
      try {
        const audit = await this.createAudit(this.newAudit);
        console.log('[index.vue] Audit created:', audit);

        if (!audit) {
          throw new Error('Audit creation returned undefined');
        }

        if (!audit.id) {
          console.error('[index.vue] Audit has no id:', audit);
          throw new Error('Audit has no id property');
        }

        this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
          message: this.$t('deliverability.audits.createDialog.success'),
          color: 'success',
        });
        this.closeCreateDialog();
        // Navigate to the newly created audit
        this.$router.push(`/deliverability/${audit.id}`);
      } catch (error) {
        console.error('Error creating audit:', error);
        this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
          message:
            (error.response &&
              error.response.data &&
              error.response.data.message) ||
            error.message ||
            this.$t('deliverability.audits.createDialog.error'),
          color: 'error',
        });
      } finally {
        this.creating = false;
      }
    },
    closeCreateDialog() {
      this.createAuditDialog = false;
      this.newAudit = {
        name: '',
        status: 'DRAFT',
      };
      if (this.$refs.form) {
        this.$refs.form.resetValidation();
      }
    },
  },
};
</script>
