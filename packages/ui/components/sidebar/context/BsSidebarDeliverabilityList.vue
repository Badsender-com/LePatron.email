<template>
  <div v-if="!collapsed" class="bs-sidebar-deliverability-list">
    <!-- Section header -->
    <div class="section-header">
      <span class="section-header__label">{{
        $t('deliverability.audits.title')
      }}</span>
      <nuxt-link
        to="/deliverability"
        class="section-header__action"
        :title="$t('deliverability.audits.newAudit')"
      >
        <icon-plus :size="14" />
      </nuxt-link>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <v-skeleton-loader
        v-for="i in 3"
        :key="i"
        type="list-item"
        class="mb-1"
      />
    </div>

    <!-- Audit list -->
    <nav v-else-if="audits.length > 0" class="audit-nav">
      <div v-for="audit in audits" :key="audit.id" class="audit-entry">
        <!-- Audit item -->
        <nuxt-link
          :to="`/deliverability/${audit.id}`"
          class="audit-item"
          :class="{ 'audit-item--active': isAuditRoot(audit.id) }"
        >
          <span
            class="audit-item__dot"
            :class="`audit-item__dot--${audit.status}`"
          />
          <span class="audit-item__name">{{ audit.name }}</span>
        </nuxt-link>

        <!-- Sub-navigation when audit is active -->
        <div v-if="isActiveAudit(audit.id)" class="audit-subnav">
          <nuxt-link
            :to="`/deliverability/${audit.id}/inventory`"
            class="subnav-item"
            :class="{ 'subnav-item--active': isSubPage(audit.id, 'inventory') }"
          >
            <icon-clipboard-list :size="13" />
            <span>{{ $t('deliverability.modules.inventory.title') }}</span>
          </nuxt-link>
          <nuxt-link
            :to="`/deliverability/${audit.id}/mapping`"
            class="subnav-item"
            :class="{ 'subnav-item--active': isSubPage(audit.id, 'mapping') }"
          >
            <icon-network :size="13" />
            <span>{{ $t('deliverability.modules.mapping.title') }}</span>
          </nuxt-link>
          <span class="subnav-item subnav-item--disabled">
            <icon-search :size="13" />
            <span>{{ $t('deliverability.modules.dns.title') }}</span>
          </span>
        </div>
      </div>
    </nav>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <p class="empty-state__text">
        {{ $t('deliverability.audits.noAuditsYet') }}
      </p>
      <nuxt-link to="/deliverability" class="empty-state__cta">
        {{ $t('deliverability.audits.createFirstAudit') }}
      </nuxt-link>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { DELIVERABILITY, FETCH_AUDITS } from '~/store/deliverability';

export default {
  name: 'BsSidebarDeliverabilityList',
  props: {
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    ...mapState(DELIVERABILITY, ['audits', 'loading']),
  },
  async mounted() {
    await this.fetchAudits();
  },
  methods: {
    ...mapActions(DELIVERABILITY, { fetchAudits: FETCH_AUDITS }),
    isActiveAudit(auditId) {
      return this.$route.params.auditId === auditId;
    },
    isAuditRoot(auditId) {
      return (
        this.$route.params.auditId === auditId &&
        this.$route.name === 'deliverability-auditId'
      );
    },
    isSubPage(auditId, subPage) {
      return (
        this.$route.params.auditId === auditId &&
        this.$route.name === `deliverability-auditId-${subPage}`
      );
    },
  },
};
</script>

<style scoped>
.bs-sidebar-deliverability-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  border-bottom: 1px solid #e0e0e0;
}

.section-header__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: rgba(0, 0, 0, 0.6);
  text-transform: uppercase;
}

.section-header__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: rgba(0, 0, 0, 0.5);
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.section-header__action:hover {
  background-color: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.87);
}

.audit-nav {
  overflow-y: auto;
  padding: 4px 8px;
  flex: 1;
}

.audit-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  text-decoration: none;
  color: rgba(0, 0, 0, 0.75);
  transition: background-color 0.15s ease;
  font-size: 13px;
}

.audit-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.audit-item--active {
  background-color: rgba(0, 172, 220, 0.1);
  color: #00acdc;
  font-weight: 500;
}

.audit-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.audit-item__dot--draft {
  background-color: #9ca3af;
}
.audit-item__dot--in_progress {
  background-color: #f59e0b;
}
.audit-item__dot--completed {
  background-color: #10b981;
}
.audit-item__dot--archived {
  background-color: #8b5cf6;
}

.audit-item__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.audit-subnav {
  padding: 2px 0 4px 28px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.subnav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
  cursor: pointer;
}

.subnav-item:not(.subnav-item--disabled):hover {
  background-color: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.87);
}

.subnav-item--active {
  color: #00acdc;
  font-weight: 500;
  background: rgba(0, 172, 220, 0.08);
}

.subnav-item--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.loading-state {
  padding: 8px;
  flex: 1;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  gap: 8px;
}

.empty-state__text {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
  text-align: center;
  margin: 0;
}

.empty-state__cta {
  font-size: 12px;
  color: #00acdc;
  text-decoration: none;
  font-weight: 500;
}

.empty-state__cta:hover {
  text-decoration: underline;
}
</style>
