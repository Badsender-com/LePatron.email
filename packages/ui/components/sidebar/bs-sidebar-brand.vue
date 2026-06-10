<template>
  <div class="bs-sidebar-brand">
    <!-- Collapsed: show mark only -->
    <img
      v-if="collapsed"
      src="/pique_aiguille.svg"
      alt="LePatron"
      class="bs-sidebar-brand__mark"
    />

    <!-- Expanded: show full logo -->
    <img
      v-else
      src="/logo_lepatron_black.svg"
      alt="LePatron"
      class="bs-sidebar-brand__logo"
    />
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
  justify-content: center;
  height: 56px;
  padding: 14px 18px;
  border-bottom: 1px solid #e0e0e0;
  position: relative;
}

/* Full logo when expanded */
.bs-sidebar-brand__logo {
  height: 28px;
  width: auto;
  flex-shrink: 0;
}

/* Mark only when collapsed */
.bs-sidebar-brand__mark {
  height: 28px;
  width: auto;
  flex-shrink: 0;
}
</style>
