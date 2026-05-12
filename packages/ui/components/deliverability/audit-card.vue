<template>
  <div class="audit-card">
    <nuxt-link :to="`/deliverability/${audit.id}`" class="audit-card__link">
      <div class="audit-card__header">
        <h3 class="audit-card__title">
          {{ audit.name }}
        </h3>
        <span
          class="status-badge"
          :class="`status-badge--${audit.status.toLowerCase()}`"
        >
          {{ statusLabel }}
        </span>
      </div>

      <div class="audit-card__body">
        <div class="audit-card__meta">
          <div class="audit-card__meta-item">
            <span class="audit-card__meta-label">{{
              $t('deliverability.audits.card.organization')
            }}</span>
            <span class="audit-card__meta-value">{{
              audit.organization || 'Badsender'
            }}</span>
          </div>

          <div class="audit-card__meta-item">
            <span class="audit-card__meta-label">{{
              $t('deliverability.audits.card.created')
            }}</span>
            <span class="audit-card__meta-value">{{
              formatDate(audit.createdAt)
            }}</span>
          </div>

          <div class="audit-card__meta-item">
            <span class="audit-card__meta-label">{{
              $t('deliverability.audits.card.lastUpdated')
            }}</span>
            <span class="audit-card__meta-value">{{
              formatDate(audit.updatedAt)
            }}</span>
          </div>
        </div>

        <!-- Inventory Progress -->
        <div v-if="inventoryProgress > 0" class="audit-card__progress">
          <div class="audit-card__progress-header">
            <span class="audit-card__progress-label">{{
              $t('deliverability.audits.card.inventoryProgress')
            }}</span>
            <span class="audit-card__progress-value">{{ inventoryProgress }}%</span>
          </div>
          <div class="audit-card__progress-bar">
            <div
              class="audit-card__progress-fill"
              :style="{ width: `${inventoryProgress}%` }"
            />
          </div>
        </div>

        <div v-if="audit.workshopReady" class="audit-card__workshop-badge">
          <lucide-check :size="14" />
          <span>{{ $t('deliverability.audits.card.workshopReady') }}</span>
        </div>
      </div>
    </nuxt-link>

    <button class="audit-card__menu-btn" @click.stop="toggleMenu">
      <lucide-more-vertical :size="18" />
    </button>

    <v-menu v-model="menuOpen" bottom left offset-y>
      <template #activator="{}" />
      <v-list>
        <v-list-item @click="editAudit">
          <v-list-item-icon>
            <lucide-pencil :size="18" />
          </v-list-item-icon>
          <v-list-item-title>
            {{
              $t('deliverability.audits.card.edit')
            }}
          </v-list-item-title>
        </v-list-item>
        <v-list-item @click="confirmDelete">
          <v-list-item-icon>
            <lucide-trash2 :size="18" color="#dc2626" />
          </v-list-item-icon>
          <v-list-item-title style="color: #dc2626">
            {{
              $t('deliverability.audits.card.delete')
            }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

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
              name: audit.name,
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
import { mapActions } from 'vuex';
import { Check, MoreVertical, Pencil, Trash2 } from 'lucide-vue';
import { DELIVERABILITY, DELETE_AUDIT } from '~/store/deliverability';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  name: 'AuditCard',
  components: {
    LucideCheck: Check,
    LucideMoreVertical: MoreVertical,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
  },
  props: {
    audit: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      deleteDialog: false,
      deleting: false,
      menuOpen: false,
    };
  },
  computed: {
    statusLabel() {
      const labels = {
        DRAFT: this.$t('deliverability.audits.status.draft'),
        IN_PROGRESS: this.$t('deliverability.audits.status.inProgress'),
        COMPLETED: this.$t('deliverability.audits.status.completed'),
        ARCHIVED: this.$t('deliverability.audits.status.archived'),
      };
      return labels[this.audit.status] || this.audit.status;
    },
    inventoryProgress() {
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
      const completed = fields.filter((field) => this.audit[field]).length;
      return Math.round((completed / fields.length) * 100);
    },
  },
  methods: {
    ...mapActions(DELIVERABILITY, {
      deleteAudit: DELETE_AUDIT,
    }),
    formatDate(dateString) {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    },
    toggleMenu() {
      this.menuOpen = !this.menuOpen;
    },
    editAudit() {
      this.$router.push(`/deliverability/${this.audit.id}`);
    },
    confirmDelete() {
      this.deleteDialog = true;
      this.menuOpen = false;
    },
    async handleDelete() {
      this.deleting = true;
      try {
        await this.deleteAudit(this.audit.id);
        this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
          message: this.$t('deliverability.audits.card.deleteDialog.success'),
          color: 'success',
        });
        this.deleteDialog = false;
        this.$emit('refresh');
      } catch (error) {
        console.error('Error deleting audit:', error);
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
.audit-card {
  position: relative;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--r-md);
  transition: all var(--t-normal) var(--ease-out);
  overflow: hidden;
}

.audit-card:hover {
  transform: translateY(-2px);
  border-color: #00acdc;
  box-shadow: 0 4px 12px rgba(0, 172, 220, 0.12);
}

.audit-card__link {
  display: block;
  padding: 20px;
  text-decoration: none;
  color: inherit;
}

.audit-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding-right: 32px;
}

.audit-card__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
  line-height: 1.3;
  letter-spacing: -0.01em;
  flex: 1;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 10px;
  text-transform: capitalize;
  letter-spacing: 0.3px;
  flex-shrink: 0;
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

.audit-card__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.audit-card__meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.audit-card__meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.audit-card__meta-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  color: var(--gray-500);
}

.audit-card__meta-value {
  font-size: 14px;
  color: var(--gray-900);
  font-weight: 500;
}

.audit-card__progress {
  margin-top: 4px;
}

.audit-card__progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.audit-card__progress-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  color: var(--gray-500);
}

.audit-card__progress-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-700);
}

.audit-card__progress-bar {
  height: 6px;
  background: var(--gray-100);
  border-radius: 3px;
  overflow: hidden;
}

.audit-card__progress-fill {
  height: 100%;
  background: #00acdc;
  border-radius: 3px;
  transition: width var(--t-normal);
}

.audit-card__workshop-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  background: #d1fae5;
  color: #065f46;
  border-radius: 6px;
  width: fit-content;
}

.audit-card__menu-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--r-sm);
  color: var(--gray-600);
  cursor: pointer;
  transition: all var(--t-fast);
  z-index: 2;
}

.audit-card__menu-btn:hover {
  background: var(--gray-100);
  color: var(--gray-900);
}

@media (max-width: 960px) {
  .audit-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .audit-card__title {
    font-size: 16px;
  }
}
</style>
