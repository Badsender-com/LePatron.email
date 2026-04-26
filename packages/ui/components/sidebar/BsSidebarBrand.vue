<template>
  <div class="bs-sidebar-brand">
    <div class="bs-sidebar-brand__logo">
      <img
        src="/logo_lepatron.png"
        alt="LePatron"
        class="bs-sidebar-brand__icon"
      >
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
  gap: 12px;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid #e0e0e0;
  position: relative;
}

.bs-sidebar-brand__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.bs-sidebar-brand__icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.bs-sidebar-brand__name {
  font-size: 16px;
  font-weight: 600;
  color: var(--v-primary-base, #093040);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
