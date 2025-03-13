'use strict';
import Konva from 'Konva';

// IMPORTANT NOTE : 
// Only the main image can be cropped at the moment. 
// This is intended and can be easily altered by manipulating the editor.selection instead of the editor.image !

export const EditorCropper = (editor) => {

    // The following elements are used solely for cropping and are therefore temporary (i.e. they are destroyed from the stage when the crop is canceled or saved).
    let cropLayer = null;
    let selector = null;
    let transformer = null;
    let ratioSelector = null;
    let baseImage = null;
    let image = null;
    let stageZoom = null;

    /**
     * Parses the given ratio value to a floating value.
     * @param {string} value - The ratio from the select input.
     * @returns {float} - The parsed value as a float. Returns 1 if the value couldn't be parsed.
     */
    function toRatio(value) {
        if (value === "0") return 0;

        var ratioParts = value.split('-');
        var widthRatio = parseFloat(ratioParts[0]);
        var heightRatio = parseFloat(ratioParts[1]);

        return (widthRatio ?? 1) / (heightRatio ?? 1);
    }

    /**
     * Resizes the rectangle selector with the given ratio.
     * @param {float} ratio - The ratio to be used as a floating value.
     */
    function setSelectorToRatio(ratio) {
        resetSelector();

        if (ratio === 0) {   
            transformer.enabledAnchors(editor.baseAnchors);
            transformer.moveToTop(); 
            return;
        }

        transformer.enabledAnchors(editor.cornerAnchors);
        transformer.moveToTop();

        if (ratio > 1) {
            selector.height(selector.height() / ratio);
        }

        if (ratio < 1) {
            selector.width(selector.width() * ratio);
        } 

        if (ratio === 1) {
            const min = Math.min(selector.width(), selector.height());
            selector.width(min * ratio);
            selector.width(min * ratio);
        }
    }

    /**
     * Sets back the rectangle selector to the image's size and position.
     */
    function resetSelector() {
        selector.setAttrs({
            x: editor.image.x(),
            y: editor.image.y(),
            width: editor.image.width(),
            height: editor.image.height(),
            scaleX: baseImage.scaleX,
            scaleY: baseImage.scaleY,
        })
    }

    /**
     * Inits the cropping layer and its elements.
     * Also saves the image current properties.
     */
    function init() {
        stageZoom = {
            scale: editor.stage.scaleX(),
            pos: editor.stage.position(),
        };

        ratioSelector = editor.wrapper.find("#ratio-selector");
        ratioSelector.on('change', () => setSelectorToRatio(toRatio(ratioSelector.val())));

        cropLayer = new Konva.Layer();

        // Creates a rectangle used as a selector for the region of the image that will be cropped.
        selector = new Konva.Rect({
            x: editor.lastCrop?.selectorX ?? editor.stage.width() / 2,
            y: editor.lastCrop?.selectorY ?? editor.stage.height() / 2,
            width: editor.lastCrop?.selectorWidth ?? editor.image.width(),
            height: editor.lastCrop?.selectorHeight ?? editor.image.height(),
            offsetX: editor.lastCrop?.selectorOffsetX ?? editor.image.width() / 2,
            offsetY: editor.lastCrop?.selectorOffsetY ?? editor.image.height() / 2,
            scaleX: editor.lastCrop?.scaleX ?? editor.image.scaleX(),
            scaleY: editor.lastCrop?.scaleY ?? editor.image.scaleY(),
            fill: 'rgba(0, 144, 192, 0.5)',
            stroke: 'skyblue',
            strokeWidth: 2,
            draggable: true,
        });

        // The transformer used for the selector ratios.
        // KonvaJs doesn't handle rotation when cropping an image so we disable it and restore the image with its rotation at the end of the process. 
        transformer = new Konva.Transformer({
            flipEnabled: false,
            enabledAnchors: ratioSelector.val() === "0" ? editor.baseAnchors : editor.cornerAnchors,
            rotateEnabled: false,
            rotateLineVisible: false,
        });

        transformer.on('dragmove', (e) => handleSelectorMovement(e));

        // Saves the image current properties.
        baseImage = {
            x: editor.image.x(),
            y: editor.image.y(),
            width: editor.image.width(),
            height: editor.image.height(),
            scaleX: editor.image.scaleX(),
            scaleY: editor.image.scaleY(),
            offsetX: editor.image.offsetX(),
            offsetY: editor.image.offsetY(),
            rotation: editor.image.rotation(),
            crop: {
                x: editor.image.cropX(),
                y: editor.image.cropY(),
                width: editor.image.cropWidth(),
                height: editor.image.cropHeight(),
            },
            filters: editor.image.filters(),
            blurRadius: editor.image.blurRadius(),
            pixelSize: editor.image.pixelSize(),
        }

        // The image is placed at the center of the stage at its base size and is made immovable.
        image = new Konva.Image({
            image: editor.image.image(),
            draggable: false,
            x: editor.stage.width() / 2,
            y: editor.stage.height() / 2,
            width: editor.baseImage.width,
            height: editor.baseImage.height,
            offsetX: editor.baseImage.width / 2,
            offsetY: editor.baseImage.height / 2,
            fill: editor.image.fill(),
        });
    }

    function handleSelectorMovement(e) {
        // TODO: limit selector movement to an area
    }

    /**
     * Called from the editor itself.
     * Prepares and adds all elements to the cropping layer.
     */
    function start() {
        init();

        editor.image.setAttrs({
            width: editor.baseImage.width,
            height: editor.baseImage.height,
            x: editor.stage.width() / 2,
            y: editor.stage.height() / 2,
            offsetX: editor.baseImage.width / 2,
            offsetY: editor.baseImage.height / 2,
            rotation: -0,
            scaleX: 1,
            scaleY: 1,
            crop: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            },
            draggable: false,
        });

        editor.image.hide();
        editor.children.forEach(node => {
            node.draggable(false);
            node.hide();
        });

        cropLayer.add(image);
        cropLayer.add(selector);
        cropLayer.add(transformer);
        transformer.nodes([selector]);
        transformer.moveToTop();
        editor.transformer.nodes([]);
        editor.stage.add(cropLayer);
        editor.stage.scale({ x: 1, y: 1 });
        editor.stage.position({ x: 0, y: 0 });
        editor.stage.batchDraw();
    }

    /**
     * Restores the image with the saved properties from baseImage let.
     * Destroys all elements from the cropping layer and applys or not the crop to the image.
     * @param {boolean} doCrop - Whether to apply the crop or not.
     */
    function stop(doCrop) {
        transformer.nodes([]);
        cropLayer.destroyChildren();
        cropLayer.destroy();
        
        if (doCrop) {
            applyCrop();
        }
        else {
            editor.image.setAttrs({
                x: baseImage.x,
                y: baseImage.y,
                width: baseImage.width,
                height: baseImage.height,
                scaleX: baseImage.scaleX,
                scaleY: baseImage.scaleY,
                offsetX: baseImage.offsetX,
                offsetY: baseImage.offsetY,
                crop: {
                    x: baseImage.crop.x,
                    y: baseImage.crop.y,
                    width: baseImage.crop.width,
                    height: baseImage.crop.height,
                }
            });
        }

        editor.children.forEach(node => {
            node.draggable(true);
            node.show();
        });

        editor.image.filters(baseImage.filters);
        editor.image.blurRadius(baseImage.blurRadius);
        editor.image.pixelSize(baseImage.pixelSize);
        editor.image.rotation(baseImage.rotation);
        editor.image.draggable(true);
        editor.image.show();
        editor.image.cache();
        editor.transformer.nodes([editor.image]);
        editor.transformer.moveToTop();
        editor.stage.scale({
            x: stageZoom.scale,
            y: stageZoom.scale
        });
        editor.stage.position({
            x: stageZoom.pos.x,
            y: stageZoom.pos.y
        });
        editor.stage.batchDraw();

        transformer = null;
        selector = null;
        cropLayer = null;
        baseImage = null;
        image = null;

        ratioSelector.off('change');
        ratioSelector = null;
    }

    /**
     * Applys crop to the image with the selector size and position.
     * The cropping coordinates are relative to the top left corner of the image, that's why we use the getClientRect method
     * to get the calculated coordinates (after scaleX, scaleY and transforms).
     * Also saves the current cropping properties in case the users cancels its next editions.
     */
    function applyCrop() {
        const rect = selector.getClientRect();
        const baseRect = editor.image.getClientRect();

        const scaleX = editor.image.scaleX();
        const scaleY = editor.image.scaleY();

        const cropX = (rect.x - baseRect.x) / scaleX ;
        const cropY = (rect.y - baseRect.y) / scaleY;
        const cropWidth = rect.width / scaleX;
        const cropHeight = rect.height / scaleY;

        editor.image.setAttrs({
            crop: {
                x: cropX,
                y: cropY,
                width: cropWidth,
                height: cropHeight,
            },
            width: cropWidth,
            height: cropHeight,
            x: selector.x(),
            y: selector.y(),
            offsetX: cropWidth / 2,
            offsetY: cropHeight / 2,
            scaleX: baseImage.scaleX,
            scaleY: baseImage.scaleY,
        });

        editor.lastCrop = {
            x: cropX,
            x: cropY,
            width: cropWidth,
            height: cropHeight,
            scaleX: selector.scaleX(),
            scaleY: selector.scaleY(),
            selectorWidth: selector.width(),
            selectorHeight: selector.height(),
            selectorX: selector.x(),
            selectorY: selector.y(),
            selectorOffsetX: selector.offsetX(),
            selectorOffsetY: selector.offsetY(),
        };
    }

    // Only those two functions are needed for the editor to work with the cropping feature.
    return { start, stop };
};