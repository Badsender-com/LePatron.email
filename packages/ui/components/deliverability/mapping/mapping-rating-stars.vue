<template>
  <div class="rating-stars" :class="`rating-stars--${size}`">
    <button
      v-for="n in 5"
      :key="n"
      type="button"
      class="rating-stars__star"
      :class="[
        `rating-stars__star--${starColor(n)}`,
        { 'rating-stars__star--filled': n <= value },
      ]"
      :title="`${n}/5`"
      @click="handleClick(n)"
    >
      <icon-star :size="size === 'sm' ? 14 : 18" />
    </button>
  </div>
</template>

<script>
const COLORS = ['', 'red', 'orange', 'yellow', 'lime', 'green'];

export default {
  name: 'MappingRatingStars',
  props: {
    value: { type: Number, default: 0 },
    size: { type: String, default: 'sm' },
  },
  methods: {
    starColor(n) {
      if (n > this.value) return 'empty';
      return COLORS[this.value] || 'empty';
    },
    handleClick(n) {
      this.$emit('input', n === this.value ? 0 : n);
    },
  },
};
</script>

<style scoped>
.rating-stars {
  display: flex;
  gap: 2px;
}

.rating-stars__star {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 1px;
  cursor: pointer;
  border-radius: 3px;
  transition: transform var(--t-fast);
  color: var(--gray-300);
}

.rating-stars__star:hover {
  transform: scale(1.2);
}

.rating-stars__star--filled {
  fill: currentColor;
}

.rating-stars__star--red {
  color: #ef4444;
}
.rating-stars__star--orange {
  color: #f97316;
}
.rating-stars__star--yellow {
  color: #eab308;
}
.rating-stars__star--lime {
  color: #84cc16;
}
.rating-stars__star--green {
  color: #22c55e;
}
</style>
