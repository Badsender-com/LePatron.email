<template>
  <div class="inventory-page">
    <bs-page-header
      :back="{ to: `/deliverability/${auditId}` }"
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('deliverability.inventory.title') }}
      </template>
      <template #badge>
        <span class="progress-badge">
          {{ completedSteps }}/{{ steps.length }}
        </span>
      </template>
    </bs-page-header>

    <div class="inventory-layout">
      <!-- Sidebar with steps -->
      <aside class="inventory-sidebar">
        <nav class="steps-nav">
          <button
            v-for="(step, index) in steps"
            :key="step.key"
            class="step-btn"
            :class="{
              'step-btn--active': currentStep === index + 1,
              'step-btn--completed': getStepStatus(step.key) === 'complete',
              'step-btn--in-progress': getStepStatus(step.key) === 'inProgress',
            }"
            @click="goToStep(index + 1)"
          >
            <span class="step-btn__number">
              <icon-check
                v-if="getStepStatus(step.key) === 'complete'"
                :size="14"
              />
              <icon-minus
                v-else-if="getStepStatus(step.key) === 'inProgress'"
                :size="14"
              />
              <span v-else>{{ index + 1 }}</span>
            </span>
            <span class="step-btn__label">{{
              $t(`deliverability.inventory.steps.${step.key}.title`)
            }}</span>
          </button>
        </nav>
      </aside>

      <!-- Main content -->
      <main class="inventory-main">
        <div class="step-content">
          <div class="step-header">
            <h2 class="step-title">
              {{
                $t(
                  `deliverability.inventory.steps.${currentStepData.key}.title`
                )
              }}
            </h2>
            <p class="step-description">
              {{
                $t(
                  `deliverability.inventory.steps.${currentStepData.key}.description`
                )
              }}
            </p>
          </div>

          <!-- Generic step component -->
          <inventory-step-content
            :key="currentStepData.key"
            :audit-id="auditId"
            :items="getItemsForStep(currentStepData)"
            :category="currentStepData.category"
            :placeholder="
              $t(
                `deliverability.inventory.steps.${currentStepData.key}.placeholder`
              )
            "
            :show-prev="currentStep > 1"
            :show-complete="currentStep === steps.length"
            :is-completed="isStepCompleted(currentStepData.key)"
            @saved="refreshAuditProgress"
            @prev="prevStep"
            @next="nextStep"
            @complete="handleComplete"
            @toggle-complete="handleToggleComplete"
            @error="handleStepError"
          />
        </div>
      </main>
    </div>
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
  FETCH_INVENTORY_ITEMS,
  UPDATE_INVENTORY_PROGRESS,
} from '~/store/deliverability';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';
import InventoryStepContent from '~/components/deliverability/inventory/inventory-step-content.vue';

export default {
  name: 'PageInventory',
  components: {
    BsPageHeader,
    InventoryStepContent,
  },
  mixins: [mixinPageTitle],
  meta: { acl: ACL_USER, sidebarModule: 'deliverability' },
  middleware({ store, redirect }) {
    if (store.getters[`${USER}/${IS_ADMIN}`]) {
      redirect('/groups');
    }
  },
  async asyncData({ store, params }) {
    const { auditId } = params;
    try {
      await Promise.all([
        store.dispatch(`${DELIVERABILITY}/${FETCH_AUDIT}`, auditId),
        store.dispatch(`${DELIVERABILITY}/${FETCH_INVENTORY_ITEMS}`, auditId),
      ]);
      return { auditId };
    } catch (err) {
      console.error('Error loading inventory:', err);
      return { auditId };
    }
  },
  data() {
    return {
      currentStep: 1,
      steps: [
        {
          key: 'platforms',
          category: 'PLATFORM',
          progressField: 'progressPlatforms',
        },
        {
          key: 'usages',
          category: 'USAGE',
          progressField: 'progressUsages',
        },
        {
          key: 'displayFromDomains',
          category: 'DISPLAY_FROM_DOMAIN',
          progressField: 'progressDisplayFromDomains',
        },
        {
          key: 'displayFromAddresses',
          category: 'DISPLAY_FROM_ADDRESS',
          progressField: 'progressDisplayFromAddresses',
        },
        {
          key: 'replyTos',
          category: 'REPLY_TO',
          progressField: 'progressReplyTos',
        },
        {
          key: 'mailFromDomains',
          category: 'MAIL_FROM_DOMAIN',
          progressField: 'progressMailFromDomains',
        },
        {
          key: 'trackingDomains',
          category: 'TRACKING_DOMAIN',
          progressField: 'progressTrackingDomains',
        },
        {
          key: 'hostingDomains',
          category: 'HOSTING_DOMAIN',
          progressField: 'progressHostingDomains',
        },
        { key: 'ips', category: 'IP', progressField: 'progressIps' },
        {
          key: 'linkDestinationDomains',
          category: 'LINK_DESTINATION_DOMAIN',
          progressField: 'progressLinkDestinationDomains',
        },
      ],
    };
  },
  computed: {
    ...mapState(DELIVERABILITY, ['currentAudit', 'inventoryItems']),
    pageTitle() {
      return this.$t('deliverability.inventory.title');
    },
    currentStepData() {
      return this.steps[this.currentStep - 1];
    },
    completedSteps() {
      if (!this.currentAudit) return 0;
      return this.steps.filter((step) => this.currentAudit[step.progressField])
        .length;
    },
    getStepStatus() {
      return (stepKey) => {
        if (!this.currentAudit) return 'empty';
        const step = this.steps.find((s) => s.key === stepKey);
        if (!step) return 'empty';
        const isCompleted = this.currentAudit[step.progressField];
        if (isCompleted) return 'complete';
        const items = this.getItemsForStep(step);
        return items.length > 0 ? 'inProgress' : 'empty';
      };
    },
  },
  methods: {
    ...mapActions(DELIVERABILITY, {
      fetchAudit: FETCH_AUDIT,
      fetchInventoryItems: FETCH_INVENTORY_ITEMS,
      updateInventoryProgress: UPDATE_INVENTORY_PROGRESS,
    }),
    isStepCompleted(stepKey) {
      if (!this.currentAudit) return false;
      const step = this.steps.find((s) => s.key === stepKey);
      return step ? this.currentAudit[step.progressField] : false;
    },
    getItemsForStep(step) {
      if (!this.inventoryItems) return [];
      const categoryKey = step.category.toLowerCase();
      return this.inventoryItems[categoryKey] || [];
    },
    goToStep(stepNumber) {
      this.currentStep = stepNumber;
    },
    nextStep() {
      if (this.currentStep < this.steps.length) {
        this.currentStep++;
      }
    },
    prevStep() {
      if (this.currentStep > 1) {
        this.currentStep--;
      }
    },
    async refreshAuditProgress() {
      await this.fetchAudit(this.auditId);
    },
    async handleToggleComplete(completed) {
      const step = this.currentStepData;
      await this.updateInventoryProgress({
        auditId: this.auditId,
        category: step.category,
        completed,
      });
    },
    handleComplete() {
      this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
        message: this.$t('deliverability.inventory.completed'),
        color: 'success',
      });
      this.$router.push(`/deliverability/${this.auditId}`);
    },
    handleStepError() {
      this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
        message: this.$t('deliverability.inventory.saveError'),
        color: 'error',
      });
    },
  },
};
</script>

<style scoped>
.inventory-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.inventory-layout {
  display: flex;
  gap: 32px;
  padding: 0 24px 24px 24px;
  flex: 1;
}

.inventory-sidebar {
  width: 280px;
  flex-shrink: 0;
}

.steps-nav {
  position: sticky;
  top: 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--r-md);
  padding: 8px;
}

.step-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: transparent;
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all var(--t-fast);
}

.step-btn:hover {
  background: var(--gray-50);
}

.step-btn--active {
  background: rgba(0, 172, 220, 0.08);
}

.step-btn--active:hover {
  background: rgba(0, 172, 220, 0.12);
}

.step-btn--active .step-btn__number {
  background: #00acdc;
  color: white;
}

.step-btn--active .step-btn__label {
  color: var(--gray-900);
  font-weight: 600;
}

.step-btn--completed .step-btn__number {
  background: #10b981;
  color: white;
}

.step-btn--in-progress .step-btn__number {
  background: #f59e0b;
  color: white;
}

.step-btn__number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  background: var(--gray-100);
  color: var(--gray-600);
  border-radius: 50%;
  font-size: 13px;
  font-weight: 600;
  transition: all var(--t-fast);
}

.step-btn__label {
  font-size: 14px;
  color: var(--gray-700);
  line-height: 1.3;
  transition: all var(--t-fast);
}

.inventory-main {
  flex: 1;
  min-width: 0;
}

.step-content {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--r-md);
  padding: 32px;
}

.step-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--gray-100);
}

.step-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 8px 0;
  letter-spacing: -0.02em;
}

.step-description {
  font-size: 15px;
  color: var(--gray-600);
  margin: 0;
  line-height: 1.5;
}

.progress-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(0, 172, 220, 0.1);
  color: #0891b2;
  border-radius: 12px;
}

@media (max-width: 1024px) {
  .inventory-layout {
    flex-direction: column;
    gap: 20px;
    padding: 0 16px 16px 16px;
  }

  .inventory-sidebar {
    width: 100%;
  }

  .steps-nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
    padding: 8px;
    gap: 4px;
  }

  .step-btn {
    flex-direction: column;
    align-items: center;
    min-width: 80px;
    padding: 12px 8px;
    text-align: center;
  }

  .step-btn__label {
    font-size: 11px;
  }

  .step-content {
    padding: 24px;
  }

  .step-title {
    font-size: 18px;
  }
}
</style>
