<script>
// What turning MCP access on does, in three steps, shown while it is off.
export default {
  name: 'BsGroupMcpAccessSteps',
  data() {
    return { steps: [1, 2, 3] };
  },
};
</script>

<template>
  <!-- The list style is reset: role="list" keeps it a list for Safari and
       VoiceOver, which read the numbers. -->
  <ol class="bs-group-mcp-access-steps" role="list">
    <li v-for="step in steps" :key="step">
      <span class="bs-group-mcp-access-steps__number" aria-hidden="true">
        {{ step }}
      </span>
      {{ $t(`mcpAccess.step${step}`) }}
    </li>
  </ol>
</template>

<style lang="scss" scoped>
.bs-group-mcp-access-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
  gap: 24px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.8125rem;
    color: var(--gray-800);
  }

  &__number {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--r-pill);
    background: var(--gray-100);
    font-size: 0.75rem;
    font-weight: 600;
  }
}
</style>
