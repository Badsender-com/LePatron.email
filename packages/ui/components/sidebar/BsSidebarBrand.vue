<template>
  <div class="bs-sidebar-brand">
    <div class="bs-sidebar-brand__mark">
      LP
    </div>
    <span v-if="!collapsed" class="bs-sidebar-brand__name">LePatron</span>
  </div>
</template>

<script>
export default {
  name: 'BsSidebarBrand',
  props: {
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
};
</script>

<style scoped>
.bs-sidebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 14px 18px;
  border-bottom: 1px solid #e0e0e0;
  position: relative;
}

.bs-sidebar-brand__mark {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--v-primary-base, #093040);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: -0.02em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bs-sidebar-brand__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-900, #212121);
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
