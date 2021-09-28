<template>
  <button
    type="button"
    class="a-color"
    :style="{ backgroundColor: color }"
    @click="handleClick()"
  />
</template>

<script>
import { ColorPicker } from '@easylogic/colorpicker';

let colorPicker = {};

export default {
  name: 'BsColor',
  props: {
    color: {
      type: String,
      default: null,
    },
  },
  data() {
    return {};
  },
  mounted() {
    colorPicker = new ColorPicker({
      type: 'chromedevtool',
      color: this.color,
    });
  },
  methods: {
    handleClick() {
      colorPicker.show(
        {
          left: 0,
          top: 0,
        },
        this.color,
        (newColor) => {
          console.log(newColor);
        }
      );
    },
  },
};
</script>

<style lang="scss" scoped>
.a-color {
  width: 15px;
  height: 15px;

  border-radius: 3px;
  border: 1px solid rgba(black, 0.2);
}
</style>
