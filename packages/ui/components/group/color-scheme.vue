<template>
  <div class="color-scheme">
    <div
      v-for="(color, i) of value"
      :key="i"
      class="color-card"
      @click="handleColorChange(i)"
    >
      <div
        class="color-card__preview"
        :style="{ backgroundColor: color }"
      />
      <div class="color-card__hex">
        {{ formatHex(color) }}
      </div>
      <button
        class="color-card__remove"
        type="button"
        :title="$t('colors.removeColor')"
        @click.stop="handleRemoveColor(i)"
      >
        <span class="color-card__remove-icon">×</span>
      </button>
    </div>

    <button
      v-if="canAddColor"
      type="button"
      class="color-card color-card--add"
      @click="handleAddColor()"
    >
      <div class="color-card__add-icon">
        +
      </div>
      <div class="color-card__add-label">
        {{ $t('colors.addColor') }}
      </div>
    </button>
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
    formatHex(color) {
      if (!color) return '';
      // Ensure uppercase and proper format
      const hex = color.toUpperCase();
      // If it's a short hex like #FFF, keep it short
      if (hex.length === 4) return hex;
      // If it's #FFFFFF format, show abbreviated if possible
      if (hex.length === 7) {
        const r = hex[1];
        const g = hex[3];
        const b = hex[5];
        if (hex[1] === hex[2] && hex[3] === hex[4] && hex[5] === hex[6]) {
          return `#${r}${g}${b}`;
        }
      }
      return hex;
    },
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
      const defaultColor = '#FFFFFF';
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
.color-scheme {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.color-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 72px;
  padding: 0.5rem;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(0, 0, 0, 0.24);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    .color-card__remove {
      opacity: 1;
    }
  }

  &__preview {
    width: 56px;
    height: 40px;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    margin-bottom: 0.375rem;
  }

  &__hex {
    font-size: 0.625rem;
    font-family: monospace;
    color: rgba(0, 0, 0, 0.6);
    text-transform: uppercase;
  }

  &__remove {
    position: absolute;
    top: -6px;
    right: -6px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s ease, background-color 0.2s ease;

    &:hover {
      background: #f44336;
      border-color: #f44336;

      .color-card__remove-icon {
        color: #fff;
      }
    }
  }

  &__remove-icon {
    font-size: 14px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.5);
    line-height: 1;
  }

  &--add {
    border-style: dashed;
    border-color: rgba(0, 0, 0, 0.2);
    background: rgba(0, 0, 0, 0.02);
    justify-content: center;

    &:hover {
      border-color: #00acdc;
      background: rgba(0, 172, 220, 0.05);

      .color-card__add-icon,
      .color-card__add-label {
        color: #00acdc;
      }
    }
  }

  &__add-icon {
    font-size: 1.5rem;
    font-weight: 300;
    color: rgba(0, 0, 0, 0.4);
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  &__add-label {
    font-size: 0.625rem;
    color: rgba(0, 0, 0, 0.5);
    white-space: nowrap;
  }
}
</style>
