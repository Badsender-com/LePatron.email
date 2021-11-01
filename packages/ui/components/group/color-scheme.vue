<template>
  <div>
    <div class="m-color-scheme">
      <div v-for="(color, i) of value" :key="i" class="a-color">
        <button
          class="a-color__remove"
          type="button"
          @click="handleRemoveColor(i)"
        >
          -
        </button>
        <button
          type="button"
          class="a-color__picker"
          :style="{ backgroundColor: color }"
          @click="handleColorChange(i)"
        />
      </div>

      <button
        v-if="canAddColor"
        type="button"
        class="a-color__picker"
        @click="handleAddColor()"
      >
        +
      </button>
    </div>
  </div>
</template>

<script>
import { ColorPicker } from '@easylogic/colorpicker';

let colorPicker = {};
const mousePosition = {
  x: 0,
  y: 0,
};

export default {
  name: 'BsColorScheme',
  props: {
    value: {
      type: Array,
      default: () => [],
    },
  },
  computed: {
    canAddColor() {
      return this.value?.length < 21;
    },
  },
  mounted() {
    window.addEventListener('mousemove', this.updateMousePosition);
    colorPicker = new ColorPicker({
      type: 'chromedevtool',
      color: this.color,
    });
  },
  beforeDestroy() {
    window.removeEventListener('mousemove', this.updateMousePosition);
  },
  methods: {
    handleColorChange(colorIndex) {
      const currentColor = this.value[colorIndex];
      colorPicker.show(
        {
          top: mousePosition.y,
          left: mousePosition.x,
          hideDelay: 100,
        },
        currentColor,
        (newColor) => {
          const newColorScheme = [...this.value];
          newColorScheme[colorIndex] = newColor;
          this.$emit('input', newColorScheme);
        }
      );
    },
    handleAddColor() {
      const defaultColor = '#fff';
      this.$emit('input', [...(this.value || []), defaultColor]);
    },
    handleRemoveColor(colorIndex) {
      this.$emit(
        'input',
        this.value.filter((_color, i) => i !== colorIndex)
      );
    },
    updateMousePosition(event) {
      mousePosition.x = event.clientX;
      mousePosition.y = event.clientY;
    },
  },
};
</script>

<style lang="scss" scoped>
.m-color-scheme {
  max-width: fit-content;
  display: grid;
  justify-content: start;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(7, 1fr);
  row-gap: 0.3rem;
  column-gap: 0.3rem;

  .a-color {
    position: relative;

    &__remove {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      top: -3px;
      right: -3px;
      margin: 0;
      border: 1px solid rgba(black, 0.1);
      border-radius: 100px;
      background-color: white;
      width: 10px;
      height: 10px;
    }

    &__picker {
      display: flex;
      padding: 0;
      align-items: center;
      justify-content: center;
      width: 25px;
      height: 25px;

      border-radius: 3px;
      border: 1px solid rgba(black, 0.1);
    }
  }
}
</style>
