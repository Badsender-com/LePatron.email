<template>
  <div class="audit-detail">
    <div v-if="loading" class="loading-state">
      <v-progress-circular indeterminate color="primary" size="64" />
      <p class="loading-text">
        {{ $t('deliverability.audits.loadingAudits') }}
      </p>
    </div>

    <template v-else-if="currentAudit">
      <bs-page-header
        :back="{ to: '/deliverability' }"
        :show-mobile-menu="true"
        @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
      >
        <template #title>
          {{ currentAudit.name }}
        </template>
        <template #badge>
          <span
            class="status-badge"
            :class="`status-badge--${currentAudit.status.toLowerCase()}`"
          >
            {{ statusLabel }}
          </span>
        </template>
        <template #actions>
          <v-menu bottom left offset-y>
            <template #activator="{ on, attrs }">
              <button class="header-menu-btn" v-bind="attrs" v-on="on">
                <icon-more-vertical :size="20" />
              </button>
            </template>
            <v-list>
              <v-list-item @click="editDialog = true">
                <v-list-item-icon>
                  <icon-pencil :size="18" />
                </v-list-item-icon>
                <v-list-item-title>
                  {{
                    $t('deliverability.audits.card.edit')
                  }}
                </v-list-item-title>
              </v-list-item>
              <v-divider />
              <v-list-item @click="deleteDialog = true">
                <v-list-item-icon>
                  <icon-trash2 :size="18" color="#dc2626" />
                </v-list-item-icon>
                <v-list-item-title style="color: #dc2626">
                  {{ $t('deliverability.audits.card.delete') }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>
      </bs-page-header>

      <div class="modules-grid">
        <!-- Technical Inventory -->
        <nuxt-link
          :to="`/deliverability/${auditId}/inventory`"
          class="module-card"
        >
          <div class="module-card__icon">
            <icon-clipboard-list :size="26" />
          </div>
          <div class="module-card__content">
            <h3 class="module-card__title">
              {{ $t('deliverability.modules.inventory.title') }}
            </h3>
            <p class="module-card__description">
              {{ $t('deliverability.modules.inventory.description') }}
            </p>
            <div class="module-card__progress">
              <div class="module-card__progress-bar">
                <div
                  class="module-card__progress-fill"
                  :style="{ width: `${inventoryProgress}%` }"
                />
              </div>
              <span class="module-card__progress-text">{{ inventoryProgress }}% complete</span>
            </div>
          </div>
          <div class="module-card__arrow">
            <icon-chevron-right :size="20" />
          </div>
        </nuxt-link>

        <!-- Infrastructure Mapping -->
        <div class="module-card module-card--disabled">
          <div class="module-card__icon module-card__icon--disabled">
            <icon-globe :size="26" />
          </div>
          <div class="module-card__content">
            <h3 class="module-card__title">
              {{ $t('deliverability.modules.mapping.title') }}
            </h3>
            <p class="module-card__description">
              {{ $t('deliverability.modules.mapping.description') }}
            </p>
            <div class="module-card__footer">
              <span class="coming-soon-badge">{{
                $t('deliverability.comingSoon')
              }}</span>
            </div>
          </div>
        </div>

        <!-- DNS Analysis -->
        <div class="module-card module-card--disabled">
          <div class="module-card__icon module-card__icon--disabled">
            <icon-search :size="26" />
          </div>
          <div class="module-card__content">
            <h3 class="module-card__title">
              {{ $t('deliverability.modules.dns.title') }}
            </h3>
            <p class="module-card__description">
              {{ $t('deliverability.modules.dns.description') }}
            </p>
            <div class="module-card__footer">
              <span class="coming-soon-badge">{{
                $t('deliverability.comingSoon')
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Edit Dialog -->
    <v-dialog v-model="editDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title>
          <span class="text-h5">{{
            $t('deliverability.audits.editDialog.title')
          }}</span>
        </v-card-title>
        <v-card-text>
          <v-form ref="editForm" v-model="editFormValid">
            <v-text-field
              v-model="editData.name"
              :label="$t('deliverability.audits.createDialog.nameLabel') + ' *'"
              :rules="[rules.required]"
              outlined
            />
            <v-select
              v-model="editData.status"
              :items="statusOptions"
              :label="$t('deliverability.audits.createDialog.statusLabel')"
              outlined
            />
            <v-switch
              v-model="editData.workshopReady"
              :label="$t('deliverability.audits.editDialog.workshopReady')"
              color="primary"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="closeEditDialog">
            {{
              $t('deliverability.audits.createDialog.cancel')
            }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!editFormValid || updating"
            :loading="updating"
            @click="handleUpdate"
          >
            {{ $t('deliverability.audits.editDialog.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="500px" persistent>
      <v-card>
        <v-card-title class="text-h5">
          {{
            $t('deliverability.audits.card.deleteDialog.title')
          }}
        </v-card-title>
        <v-card-text
          v-html="
            $t('deliverability.audits.card.deleteDialog.message', {
              name: currentAudit && currentAudit.name,
            })
          "
        />
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="deleteDialog = false">
            {{
              $t('deliverability.audits.card.deleteDialog.cancel')
            }}
          </v-btn>
          <v-btn color="error" :loading="deleting" @click="handleDelete">
            {{ $t('deliverability.audits.card.deleteDialog.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import { ACL_USER } from '~/helpers/pages-acls.js';
import { IS_ADMIN, USER } from '~/store/user';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import {
  DELIVERABILITY,
  FETCH_AUDIT,
  UPDATE_AUDIT,
  DELETE_AUDIT,
} from '~/store/deliverability';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';

export default {
  name: 'PageDeliverabilityAuditDetail',
  components: { BsPageHeader },
  mixins: [mixinPageTitle],
  meta: { acl: ACL_USER, sidebarModule: 'deliverability' },
  middleware({ store, redirect }) {
    if (store.getters[`${USER}/${IS_ADMIN}`]) redirect('/groups');
  },
  async asyncData({ store, params }) {
    const { auditId } = params;
    try {
      await store.dispatch(`${DELIVERABILITY}/${FETCH_AUDIT}`, auditId);
      return { auditId };
    } catch (err) {
      console.error('Error loading audit:', err);
      return { auditId };
    }
  },
  data() {
    return {
      editDialog: false,
      deleteDialog: false,
      editFormValid: false,
      updating: false,
      deleting: false,
      editData: { name: '', status: 'DRAFT', workshopReady: false },
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
        required: (v) =>
          !!v || this.$t('deliverability.audits.createDialog.nameRequired'),
      },
    };
  },
  computed: {
    ...mapState(DELIVERABILITY, ['currentAudit', 'loading']),
    pageTitle() {
      return (this.currentAudit && this.currentAudit.name) || 'Audit';
    },
    statusLabel() {
      const labels = {
        DRAFT: this.$t('deliverability.audits.status.draft'),
        IN_PROGRESS: this.$t('deliverability.audits.status.inProgress'),
        COMPLETED: this.$t('deliverability.audits.status.completed'),
        ARCHIVED: this.$t('deliverability.audits.status.archived'),
      };
      const status = this.currentAudit && this.currentAudit.status;
      return (status && labels[status]) || status || '';
    },
    inventoryProgress() {
      if (!this.currentAudit) return 0;
      const fields = [
        'progressPlatforms',
        'progressUsages',
        'progressDisplayFromDomains',
        'progressDisplayFromAddresses',
        'progressReplyTos',
        'progressMailFromDomains',
        'progressTrackingDomains',
        'progressHostingDomains',
        'progressIps',
      ];
      const completed = fields.filter((f) => this.currentAudit[f]).length;
      return Math.round((completed / fields.length) * 100);
    },
  },
  watch: {
    editDialog(val) {
      if (val && this.currentAudit) {
        this.editData = {
          name: this.currentAudit.name,
          status: this.currentAudit.status,
          workshopReady: this.currentAudit.workshopReady || false,
        };
      }
    },
  },
  methods: {
    ...mapActions(DELIVERABILITY, {
      updateAudit: UPDATE_AUDIT,
      deleteAudit: DELETE_AUDIT,
    }),
    async handleUpdate() {
      if (!this.$refs.editForm.validate()) return;
      this.updating = true;
      try {
        await this.updateAudit({ auditId: this.auditId, data: this.editData });
        this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
          message: this.$t('deliverability.audits.editDialog.success'),
          color: 'success',
        });
        this.closeEditDialog();
      } catch (error) {
        this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
          message:
            (error.response &&
              error.response.data &&
              error.response.data.message) ||
            this.$t('deliverability.audits.editDialog.error'),
          color: 'error',
        });
      } finally {
        this.updating = false;
      }
    },
    closeEditDialog() {
      this.editDialog = false;
      if (this.$refs.editForm) this.$refs.editForm.resetValidation();
    },
    async handleDelete() {
      this.deleting = true;
      try {
        await this.deleteAudit(this.auditId);
        this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
          message: this.$t('deliverability.audits.card.deleteDialog.success'),
          color: 'success',
        });
        this.$router.push('/deliverability');
      } catch (error) {
        this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
          message:
            (error.response &&
              error.response.data &&
              error.response.data.message) ||
            this.$t('deliverability.audits.card.deleteDialog.error'),
          color: 'error',
        });
      } finally {
        this.deleting = false;
      }
    },
  },
};
</script>

<style scoped>
.audit-detail {
  padding: 0 24px 24px 24px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 32px;
  text-align: center;
}

.loading-text {
  margin-top: 16px;
  font-size: 14px;
  color: var(--gray-600);
}

.header-menu-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--r-sm);
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--t-fast);
}

.header-menu-btn:hover {
  background: var(--gray-100);
  color: var(--gray-900);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 12px;
  text-transform: capitalize;
}

.status-badge--draft {
  background: var(--gray-100);
  color: var(--gray-700);
}
.status-badge--in_progress {
  background: #fef3c7;
  color: #92400e;
}
.status-badge--completed {
  background: #d1fae5;
  color: #065f46;
}
.status-badge--archived {
  background: #e0e7ff;
  color: #3730a3;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
  max-width: 1400px;
}

.module-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 24px;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--r-md);
  text-decoration: none;
  color: inherit;
  transition: all var(--t-normal) var(--ease-out);
  cursor: pointer;
  min-height: 140px;
}

.module-card:not(.module-card--disabled):hover {
  border-color: #00acdc;
  box-shadow: 0 4px 12px rgba(0, 172, 220, 0.12);
  transform: translateY(-2px);
}

.module-card:not(.module-card--disabled):hover .module-card__icon {
  background: rgba(0, 172, 220, 0.12);
  color: #00acdc;
}

.module-card--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.module-card__icon {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 172, 220, 0.08);
  color: #00acdc;
  border-radius: var(--r-md);
  transition: all var(--t-normal);
}

.module-card__icon--disabled {
  background: var(--gray-100);
  color: var(--gray-400);
}

.module-card__content {
  flex: 1;
  min-width: 0;
  padding-right: 24px;
}

.module-card__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 6px 0;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.module-card__description {
  font-size: 14px;
  color: var(--gray-600);
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.module-card__footer {
  display: flex;
  align-items: center;
}

.module-card__progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.module-card__progress-bar {
  flex: 1;
  height: 6px;
  background: var(--gray-100);
  border-radius: 3px;
  overflow: hidden;
}

.module-card__progress-fill {
  height: 100%;
  background: #00acdc;
  border-radius: 3px;
  transition: width var(--t-normal);
}

.module-card__progress-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-500);
  white-space: nowrap;
}

.coming-soon-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #fef3c7;
  color: #92400e;
  border-radius: 4px;
}

.module-card__arrow {
  position: absolute;
  top: 24px;
  right: 20px;
  opacity: 0;
  transition: opacity var(--t-normal), transform var(--t-normal);
  color: var(--gray-400);
}

.module-card:not(.module-card--disabled):hover .module-card__arrow {
  opacity: 1;
  transform: translateX(2px);
  color: #00acdc;
}

@media (max-width: 960px) {
  .audit-detail {
    padding: 0 16px 16px 16px;
  }

  .modules-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .module-card {
    padding: 20px;
    min-height: 120px;
  }
  .module-card__icon {
    width: 48px;
    height: 48px;
  }
  .module-card__title {
    font-size: 16px;
  }
}
</style>
