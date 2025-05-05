'use strict';
import Konva from 'konva';
import _ from 'lodash';

// IMPORTANT NOTE :
// Only the main image can be cropped at the moment.
// This is intended and can be easily altered by manipulating the editor.selection instead of the editor.image !

export const EditorCropper = (editor) => {

    // The following elements are used solely for cropping and are therefore temporary (i.e. they are destroyed from the stage when the crop is canceled or saved).
    let cropLayer = null;
    let maskLayer = null;
    let selector = null;
    let transformer = null;
    let ratioSelector = null;
    let baseImage = null;
    let image = null;
    let mask = null;
    let lightShape = null;
    let stageZoom = null;
    let selectorGroup = null;
    let lines = [];

    /**
     * Updates the selector size inputs with the transformer new size (UI only).
     */
    function updatePanel() {
        editor.wrapper.find('#selector-width').val(Math.round(transformer.width()));
        editor.wrapper.find('#selector-height').val(Math.round(transformer.height()));
    }

    /**
     * Parses the given ratio value to a floating value.
     * @param {string} value - The ratio from the select input.
     * @returns {float} - The parsed value as a float. Returns 1 if the value couldn't be parsed.
     */
    function toRatio(value) {
        if (value === "0") return 0;
        if (value === "1") return 1;

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
            setCropperLines();
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
            const newSize = Math.min(selector.width(), selector.height()) * ratio;
            selector.width(newSize);
            selector.height(newSize);
        }

        selector.offsetX(selector.width() / 2);
        selector.offsetY(selector.height() / 2);

        updatePanel();
        setCropperLines();
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
            offsetX: editor.image.width() / 2,
            offsetY: editor.image.height() / 2,
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
        maskLayer = new Konva.Layer();
        
        selectorGroup = new Konva.Group();
        
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
            fill: 'transparent',
            stroke: 'skyblue',
            strokeWidth: 2,
            draggable: true,
        });

        // This rectangle is used to display the area that will be removed (dark effect)
        mask = new Konva.Rect({
            x: editor.stage.width() / 2,
            y: editor.stage.height() / 2,
            width: editor.baseImage.width,
            height: editor.baseImage.height,
            offsetX: editor.baseImage.width / 2,
            offsetY: editor.baseImage.height / 2,
            fill: 'black',
            opacity: 0.75,
            stroke: 'transparent',
            strokeWidth: 0,
            draggable: false
        });

        // This custom shape is used to display the area that will be cropped (light effect)
        lightShape = new Konva.Shape({
            sceneFunc: function (ctx, shape) {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillStyle = 'white';
                const selectorW = selector.width() * selector.scaleX();
                const selectorH = selector.height() * selector.scaleY();
                ctx.fillRect(selector.x() - selectorW / 2, selector.y() - selectorH / 2, selectorW, selectorH);
                ctx.globalCompositeOperation = 'source-over';
            },
            opacity: 1,
        })

        // The transformer used for the selector ratios.
        // KonvaJs doesn't handle rotation when cropping an image so we disable it and restore the image with its rotation at the end of the process.
        transformer = new Konva.Transformer({
            flipEnabled: false,
            enabledAnchors: ratioSelector.val() === "0" ? editor.baseAnchors : editor.cornerAnchors,
            rotateEnabled: false,
            rotateLineVisible: false,
            boundBoxFunc: (_, newBox) => handleSelectorResize( newBox),
        });

        selector.on('dragmove', (e) => {
            handleSelectorMovement(e);
            lightShape.draw();
        });

        transformer.on('dragmove transform', setCropperLines);

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

    /**
     * Prevents user from resizing the selector outside and or larger than the image.
     * @param {any} newBox - The new boundaries of the transformer as a rectangle.
     * @returns - The rectangle that will be used as the new boundaries of the transformer.
     */
    function handleSelectorResize(newBox) {
        const imageBox = image.getClientRect();

        const imageLeft = imageBox.x;
        const imageRight = imageBox.x + imageBox.width;
        const imageTop = imageBox.y;
        const imageBottom = imageBox.y + imageBox.height;

        const overflowLeft = imageLeft - newBox.x;
        const overflowTop = imageTop - newBox.y;

        const availableRightSpace = imageRight - newBox.x;
        const availableBottomSpace = imageBottom - newBox.y;

        const boxX = _.clamp(newBox.x, imageLeft, imageRight);
        const boxY = _.clamp(newBox.y, imageTop, imageBottom);
        

        const boxWidth = newBox.x < imageLeft
        ? newBox.width - overflowLeft
        : Math.min(newBox.width, availableRightSpace);

        const boxHeight = newBox.y < imageTop
        ? newBox.height - overflowTop
        : Math.min(newBox.height, availableBottomSpace);

        const normalizedBox = {
        ...newBox,
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
        };
        
        return normalizedBox;
    }

    /**
     * Prevents user from moving the selector outside of the image boundaries.
     * @param {any} e - The event fired by KonvaJS while moving the rectangle selector ('dragmove' event).
     */
    function handleSelectorMovement(e) {
        const newRect = e.target.getClientRect();
        const rect = image.getClientRect();
        const minX = rect.x;
        const minY = rect.y;
        const maxX = minX + image.width() * image.scaleX();
        const maxY = minY + image.height() * image.scaleY();

        const width = selector.width() * selector.scaleX();
        const height = selector.height() * selector.scaleY();

        const offsetX = Math.round(newRect.width / 2);
        const offsetY = Math.round(newRect.height / 2);

        const sMinX = newRect.x;
        const sMinY = newRect.y;
        const sMaxX = sMinX + width;
        const sMaxY = sMinY + height;

        let newX = newRect.x + offsetX;
        let newY = newRect.y + offsetY;

        if (sMinX < minX) newX = minX + offsetX;
        if (sMaxX > maxX) newX = maxX - offsetX;
        if (sMinY < minY) newY = minY + offsetY;
        if (sMaxY > maxY) newY = maxY - offsetY;

        selector.position({ x: newX, y: newY });
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

        selectorGroup.add(mask);
        selectorGroup.add(lightShape);
        setCropperLines();
        selectorGroup.add(selector);
        selectorGroup.add(transformer);

        cropLayer.add(image);
        maskLayer.add(selectorGroup);
        transformer.nodes([selector]);
        transformer.moveToTop();
        transformer.on('transform', () => updatePanel());
        editor.transformer.nodes([]);
        editor.stage.draggable(false);
        editor.stage.add(cropLayer);
        editor.stage.add(maskLayer);
        editor.stage.scale({ x: 1, y: 1 });
        editor.stage.position({ x: 0, y: 0 });
        editor.stage.batchDraw();

        updatePanel();
    }

    /**
     * Restores the image with the saved properties from baseImage let.
     * Destroys all elements from the cropping layer and applys or not the crop to the image.
     * @param {boolean} doCrop - Whether to apply the crop or not.
     * @param {boolean} reset - Whether to reset the image crop or not.
     */
    function stop(doCrop, reset) {
        transformer.nodes([]);
        cropLayer.destroyChildren();
        cropLayer.destroy();
        maskLayer.destroyChildren();
        maskLayer.destroy();

        if (reset === true) {
            editor.image.crop({ x: 0, y: 0, width: 0, height: 0 });
            editor.lastCrop = null;
        }
        else {
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
        editor.stage.draggable(true);
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
        maskLayer = null;
        baseImage = null;
        image = null;
        mask = null;
        lightShape = null;
        selectorGroup = null;
        lines = [];

        ratioSelector.off('change');
        ratioSelector.val("0")
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

        const cropX = (rect.x - baseRect.x) / scaleX;
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

    /**
     * Destroys and draws new selector lines.
     */
    function setCropperLines() {
        const x = selector.x();
        const y = selector.y();
        const width = selector.width() * selector.scaleX();
        const height = selector.height() * selector.scaleY();
        const offsetX = width / 2;
        const offsetY = height / 2;

        lines.forEach((line) => line.destroy());
        lines = [];
        lines.push(new Konva.Line({
            points: [
                x + width * 1 / 3 - offsetX, y - offsetY,
                x + width * 1 / 3 - offsetX, y + height - offsetY,
            ],
            stroke: 'skyblue',
            strokeWidth: 2,
            dash: [6, 4],
        }));

        lines.push(new Konva.Line({
            points: [
                x + width * 2 / 3 - offsetX, y - offsetY,
                x + width * 2 / 3 - offsetX, y + height - offsetY,
            ],
            stroke: 'skyblue',
            strokeWidth: 2,
            dash: [6, 4],
        }));

        lines.push(new Konva.Line({
            points: [
                x - offsetX, y + height * 1 / 3 - offsetY,
                x + width - offsetX, y + height * 1 / 3 - offsetY,
            ],
            stroke: 'skyblue',
            strokeWidth: 1,
            dash: [6, 4],
        }));

        lines.push(new Konva.Line({
            points: [
                x - offsetX, y + height * 2 / 3 - offsetY,
                x + width - offsetX, y + height * 2 / 3 - offsetY,
            ],
            stroke: 'skyblue',
            strokeWidth: 1,
            dash: [6, 4],
        }));

        lines.forEach((line) => selectorGroup.add(line));
    }

    // Only those two functions are needed for the editor to work with the cropping feature.
    return { start, stop };
};
