'use strict';
import Konva from 'Konva';

const $ = require('jquery');

const filtersActions = {
    blur: {
        name: "blur",
        type: "slider",
        min: 0,
        max: 30,
        step: 0.05,
        class: Konva.Filters.Blur,
    },
    pixelate: {
        name: "pixelate",
        type: "slider",
        min: 1,
        max: 20,
        step: 1,
        class: Konva.Filters.Pixelate,
    },
    grayscale: {
        name: "grayscale",
        type: "none",
        class: Konva.Filters.Grayscale,
    }
}

export const EditorFilters = (editor, messages) => {

    const resetFilters = editor.wrapper.find('.bs-img-cropper__button');
    const sliderBox = editor.wrapper.find('#filters-actions-slider-box');

    const blur = editor.wrapper.find('#filters-blur');
    const pixelate = editor.wrapper.find('#filters-pixelate');
    const grayscale = editor.wrapper.find('#filters-grayscale');

    resetFilters.on('click', () => reset());
    blur.on('click', () => handleFilter(filtersActions.blur, editor.image.blurRadius(), messages.filters_blur));
    pixelate.on('click', () => handleFilter(filtersActions.pixelate, editor.image.pixelSize(), messages.filters_pixelate));
    grayscale.on('click', () => handleFilter(filtersActions.grayscale, null, null));

    function handleFilter(filter, defaultValue, title) {
        if (!editor.selection instanceof Konva.Image) return;

        setSlider(filter, defaultValue, title);
    }

    function setSlider(action, value, title) {
        sliderBox.empty();
        if (action.type === 'slider') {
            const slider = 
                `<label for="filters-slider" class="bs-img-cropper__size" style="width: 200px;">
                    <span class="bs-img-cropper__size-label">${title}</span>
                    <input type="range" name="filters-slider" id="filters-slider" min="${action.min}" max="${action.max}" step="${action.step}" value="${value}">
                </label>`;
            sliderBox.append(slider);
            const input = sliderBox.find('#filters-slider');
            input.on('input', () => handleAction(action.name));
        }

        editor.selection.filters([action.class]);
    }

    function handleAction(action) {
        const input = sliderBox.find('#filters-slider');
        if (!input) return;

        const value = stringToNumber(input.val());
        switch(action) {
            case "blur": {
                editor.selection.blurRadius(value);
                break;
            }
            case "pixelate": {
                editor.selection.pixelSize(value);
                break;
            } 
            default: console.warn('Image filters resulted in no action', action);
        }
    }

    function reset() {
        if (editor.selection !== null && editor.selection instanceof Konva.Image) {
            editor.selection.filters([]);
            editor.selection.blurRadius(0);
            editor.selection.pixelSize(editor.baseImage.pixelSize);
            sliderBox.empty();
        }
    }

    function stringToNumber(value) {
        if (value === undefined) return 1;
    
        const parsed = parseFloat(value);
        return Number.isNaN(parsed) ? 1 : parsed;
    }

    return { filtersActions };
}