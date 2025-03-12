'use strict';
import Konva from 'Konva';

const filtersActions = {
    grayscale: {
        name: "grayscale",
        type: "none",
        class: Konva.Filters.Grayscale,
    },
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
    contrast: {
        name: "contrast",
        type: "slider",
        min: -100,
        max: 100,
        step: 1,
        class: Konva.Filters.Contrast,
    },
    brighten: {
        name: "brighten",
        type: "slider",
        min: -1,
        max: 1,
        step: 0.05,
        class: Konva.Filters.Brighten,
    },
    invert: {
        name: "invert",
        type: "none",
        class: Konva.Filters.Invert,
    },
}

export const EditorFilters = (editor, messages) => {

    const resetFilters = editor.wrapper.find('#image-filters-reset');
    const sliderBox = editor.wrapper.find('#filters-actions-slider-box');

    const blur = editor.wrapper.find('#filters-blur');
    const pixelate = editor.wrapper.find('#filters-pixelate');
    const grayscale = editor.wrapper.find('#filters-grayscale');
    const contrast = editor.wrapper.find('#filters-contrast');
    const brighten = editor.wrapper.find('#filters-brighten');
    const invert = editor.wrapper.find('#filters-invert');

    resetFilters.on('click', () => reset());
    blur.on('click', () => handleFilter(filtersActions.blur, editor.selection.blurRadius(), messages.filters_blur));
    pixelate.on('click', () => handleFilter(filtersActions.pixelate, editor.selection.pixelSize(), messages.filters_pixelate));
    contrast.on('click', () => handleFilter(filtersActions.contrast, editor.selection.contrast(), messages.filters_contrast));
    brighten.on('click', () => handleFilter(filtersActions.brighten, editor.selection.brightness(), messages.filters_brighten));
    grayscale.on('click', () => handleFilter(filtersActions.grayscale, null, null));
    invert.on('click', () => handleFilter(filtersActions.invert, null, null));

    /**
     * Handles clicks on filters buttons for the selected image.
     * Updates the filters buttons UI.
     * @param {string} filter - The filter name to be applied or removed.
     * @param {any} defaultValue - Default value, can be either an int or a float.
     * @param {string} label - The label of the slider to be displayed on the UI.
     */
    function handleFilter(filter, defaultValue, label) {
        if (!editor.selection instanceof Konva.Image) return;

        setSlider(filter, defaultValue, label);
        updateFiltersSelection(false);
    }

    /**
     * Displays or removes the slider of the given filter for the selected image.
     * @param {string} action - The filter name to be applied or removed.
     * @param {any} defaultValue - Default value, can be either an int or a float.
     * @param {string} label - The label of the slider to be displayed on the UI.
     */
    function setSlider(action, defaultValue, label) {
        sliderBox.empty();

        const filters = editor.selection.filters() ?? [];

        if (filters.includes(action.class)) {
            editor.selection.filters(filters.filter(x => x !== action.class));
            resetFilter(action.name);
            return;
        }

        if (action.type === 'slider') {
            const slider = 
                `<label for="filters-slider" class="bs-img-cropper__size" style="width: 200px;">
                    <span class="bs-img-cropper__size-label">${label}</span>
                    <input type="range" name="filters-slider" id="filters-slider" min="${action.min}" max="${action.max}" step="${action.step}" value="${defaultValue}">
                </label>`;
            sliderBox.append(slider);
            const input = sliderBox.find('#filters-slider');
            input.on('input', () => handleAction(action.name));
        }

        filters.push(action.class);
        editor.selection.filters(filters);

        console.log({filters, s: editor.selection.filters()});
    }

    /**
     * Resets the effect of the given filter to the selected image.
     * @param {string} action - The filter name to be applied.
     */
    function resetFilter(action) {
        switch(action) {
            case "blur": {
                editor.selection.blurRadius(0);
                break;
            }
            case "pixelate": {
                editor.selection.pixelSize(8); // Default pixelsize is 8
            }
            case "contrast": {
                editor.selection.contrast(0);
                break;
            }
            case "brighten": {
                editor.selection.brightness(0);
                break;
            }
        }
    }

    /**
     * Handles the given filter action and apply the corresponding effect to the selected image.
     * @param {string} action - The filter name to be applied.
     */
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
            case "contrast": {
                editor.selection.contrast(value);
                break;
            }
            case "brighten": {
                editor.selection.brightness(value);
                break;
            }
            default: console.warn('Image filters resulted in no action', action);
        }
    }

    /**
     * Resets all filters on the selected image.
     */
    function reset() {
        if (editor.selection !== null && editor.selection instanceof Konva.Image) {
            editor.selection.filters([]);
            editor.selection.blurRadius(0);
            editor.selection.pixelSize(editor.baseImage.pixelSize);
            editor.selection.contrast(0);
            editor.selection.brightness(0);
            sliderBox.empty();

            grayscale.removeClass('selected');
            blur.removeClass('selected');
            pixelate.removeClass('selected');
            contrast.removeClass('selected');
            brighten.removeClass('selected');
            invert.removeClass('selected');
        }
    }

    /**
     * Updates the image filters UI.
     * @param {boolean} hideSlider - If the current filter slider should be hidden.
     */
    function updateFiltersSelection(hideSlider) {
        if (hideSlider === true) sliderBox.empty();
        
        const filters = editor.selection.filters() ?? [];
    
        grayscale.removeClass('selected');
        blur.removeClass('selected');
        pixelate.removeClass('selected');
        contrast.removeClass('selected');
        brighten.removeClass('selected');
        invert.removeClass('selected');
    
        if (filters.includes(Konva.Filters.Grayscale)) {
            grayscale.addClass('selected');
        }
    
        if (filters.includes(Konva.Filters.Blur)) {
            blur.addClass('selected');
        }
    
        if (filters.includes(Konva.Filters.Pixelate)) {
            pixelate.addClass('selected');
        }

        if (filters.includes(Konva.Filters.Contrast)) {
            contrast.addClass('selected');
        }

        if (filters.includes(Konva.Filters.Brighten)) {
            brighten.addClass('selected');
        }

        if (filters.includes(Konva.Filters.Invert)) {
            invert.addClass('selected');
        }
    }

    /**
     * Parses the given value into a floating value. If the value couldn't be parsed returns 1.
     * @param {string} value - The floating value as a string.
     * @returns {float} Returns the parsed value as a float.
     */
    function stringToNumber(value) {
        if (value === undefined) return 1;
    
        const parsed = parseFloat(value);
        return Number.isNaN(parsed) ? 1 : parsed;
    }

    return { filtersActions, updateFiltersSelection, reset };
}