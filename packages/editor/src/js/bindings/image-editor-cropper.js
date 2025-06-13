'use strict';
import Konva from 'konva';
import {clamp} from 'lodash';

// IMPORTANT NOTE :
// Only the main image can be cropped at the moment.
// This is intended and can be easily altered by manipulating the editor.selection instead of the editor.image !

export const EditorCropper = (editor, zoomFunctions = {}) => {
    const { handleStageZooming, zoomStageToScale } = zoomFunctions;

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
        
        const currentRatio = selector.width() / selector.height();
        
        if (currentRatio > ratio) {
            selector.width(selector.height() * ratio);
        } else if (currentRatio < ratio) {
            selector.height(selector.width() / ratio);
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
     * Handles crop stage zoom in and zoom out.
     * The zoom is relative to the cursor position on the stage.
     * @param {any} e - The wheel event which fired the handler.
     */
    function handleCropStageZooming(e) {
        const scaleBy = 1.05;
        e.evt.preventDefault();

        let direction = e.evt.deltaY > 0 ? -1 : 1;

          // If the user holds ctrl key the direction is inverted
        if (e.evt.ctrlKey) {
            direction = -direction;
        }

        const currentZoom = Math.round(editor.stage.scaleX() * 100);
        if ((currentZoom <= 25 && direction == -1) || (currentZoom >= 500 && direction == 1)) return;

        const oldScale = editor.stage.scaleX();
        const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

        zoomCropStageToScale(newScale, false);
    }

    /**
     * Zoom crop stage to the given scale.
     * @param {float} scale - The new scale of the stage as a floating value.
     * @param {boolean} centered - If true, the scale will follow the center of the stage. Otherwise, the scale will follow the user's pointer.
     */
    function zoomCropStageToScale(scale, centered) {
        const oldScale = editor.stage.scaleX();
        const pointer = editor.stage.getPointerPosition();

        const mousePointTo = {
            x: (pointer.x - editor.stage.x()) / oldScale,
            y: (pointer.y - editor.stage.y()) / oldScale,
        };

        editor.stage.scale({ x: scale, y: scale });

        let newPos = {
            x: 0,
            y: 0,
        };

        if (centered === true) {
            const centerX = editor.stage.width() / 2;
            const centerY = editor.stage.height() / 2;

            newPos = {
                x: editor.stage.x() + (centerX * oldScale) - (centerX * scale),
                y: editor.stage.y() + (centerY * oldScale) - (centerY * scale),
            };
        } else {
            newPos = {
                x: pointer.x - mousePointTo.x * scale,
                y: pointer.y - mousePointTo.y * scale,
            };
        }

        editor.stage.position(newPos);
        const cropZoomInput = editor.wrapper.find('#crop-stage-zoom');
        if (cropZoomInput.length) {
            cropZoomInput.val(Math.round(scale * 100));
        } else {
            editor.zoomInput.val(Math.round(scale * 100));
        }
    }

    /**
     * Handles manual zoom for crop mode using buttons.
     * @param {boolean} zoomIn - The direction of the zoom.
     */
    function handleCropManualZoom(zoomIn) {
        const scaleBy = zoomIn ? 0.05 : -0.05;
        const currentZoom = editor.stage.scaleX();
        if ((currentZoom <= 0.25 && zoomIn === false) || (currentZoom >= 5 && zoomIn === true)) return;
        zoomCropStageToScale(currentZoom + scaleBy, true);
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
            boundBoxFunc: (oldBox, newBox) => handleSelectorResize(oldBox, newBox, toRatio(ratioSelector.val())),
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
 * @param {any} oldBox - The old boundaries of the transformer as a rectangle.
 * @param {any} newBox - The new boundaries of the transformer as a rectangle.
 * @param {any} ratio - The ratio selected for the crop by the user.
 * @returns - The rectangle that will be used as the new boundaries of the transformer.
 */
function handleSelectorResize(oldBox, newBox, ratio) {
    const imageLeft = image.x() - image.width() / 2;
    const imageTop = image.y() - image.height() / 2;
    const imageRight = image.x() + image.width() / 2;
    const imageBottom = image.y() + image.height() / 2;

    // We can drag the selector outside the image. This calculates by how many pixels we went outside the image
    const overflowLeft = imageLeft - newBox.x;
    const overflowTop = imageTop - newBox.y;

    const availableRightSpace = imageRight - newBox.x;
    const availableBottomSpace = imageBottom - newBox.y;

    // Checks if the new selector is inside the image vertically and horizontally
    const isNewBoxYInsideImage = (newBox.y > imageTop && newBox.y + newBox.height < imageBottom)
    const isNewBoxXInsideImage = (newBox.x > imageLeft && newBox.x + newBox.width < imageRight)
    
      // Determines the new X position of the selector
    // If the selector is still within vertical bounds of the image OR if no ratio is applied,
    // allow updating the X position, clamped between the left and right edges of the image.
        // Otherwise (when a ratio is enforced and we’ve gone out of vertical bounds),
    // keep the previous X position to avoid breaking diagonal resizing.
    const boxX = isNewBoxYInsideImage || ratio === 0 
        ? clamp(newBox.x, imageLeft, imageRight) 
        : oldBox.x;

    // Determines the new Y position of the selector
    // If the selector is still within horizontal bounds of the image OR if no ratio is applied,
    // allow updating the Y position, clamped between the top and bottom edges of the image.
        // Otherwise (when a ratio is enforced and we’ve gone out of horizontal bounds),
    // keep the previous Y position to avoid breaking diagonal resizing.
    const boxY = isNewBoxXInsideImage || ratio === 0  
        ? clamp(newBox.y, imageTop, imageBottom) 
        : oldBox.y;

    const maxWidth = imageRight - boxX;
    const maxHeight = imageBottom - boxY;
    
    // Determines the width of the selector by taking the box width or the image width if we extends beyond the right edge
    // If the selector extends beyond the left edge, the box width increases with it. 
    // We don't want to count those pixel, so we reduce the width. 
    let boxWidth = newBox.x < imageLeft
        ? newBox.width - overflowLeft 
        : Math.min(newBox.width, availableRightSpace);

   // Determines the height of the selector by taking the box width or the image width if we extends beyond the bottom edge
    // If the selector extends beyond the top edge, the box height increases with it. 
    // We don't want to count those pixel, so we reduce the height. 
    let boxHeight = newBox.y < imageTop
        ? newBox.height - overflowTop
        : Math.min(newBox.height, availableBottomSpace);
    
    // If a ratio is applied and box dimension are valid we want to adjuste width and height to maintain the ratio
    if (ratio > 0 && boxHeight > 0 && boxWidth > 0) {
        if (boxWidth / boxHeight > ratio) {
            // If the current aspect ratio is too wide : reduce the width to match the ratio.
            boxWidth = boxHeight * ratio;
        } else {
            // Otherwise, adjust the height to match the ratio.
            boxHeight = boxWidth / ratio;
        }
        
        // If the adjusted width exceeds the available space to the right,
        // clamp the width and recalculate the height to maintain the ratio.
        if (boxWidth > maxWidth) {
            boxWidth = maxWidth;
            boxHeight = boxWidth / ratio;
        }

        // If the adjusted height exceeds the available space at the bottom,
        // clamp the height and recalculate the width to maintain the ratio.
        if (boxHeight > maxHeight) {
            boxHeight = maxHeight;
            boxWidth = boxHeight * ratio;
        }
    }
    
    return {
        ...newBox,
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight
    };
}

   /**
 * Prevents user from moving the selector outside of the image boundaries.
 * @param {any} e - The event fired by KonvaJS while moving the rectangle selector ('dragmove' event).
 */
function handleSelectorMovement(e) {

    const imageRect = {
        x: image.x() - (image.width() / 2),
        y: image.y() - (image.height() / 2),
        width: image.width(),
        height: image.height()
    };
    
    const selectorRect = {
        width: selector.width() * selector.scaleX(),
        height: selector.height() * selector.scaleY()
    };
    
    let newX = selector.x();
    let newY = selector.y();
    
    const selectorHalfWidth = selectorRect.width / 2;
    const selectorHalfHeight = selectorRect.height / 2;
    
    const minX = imageRect.x + selectorHalfWidth;
    const maxX = imageRect.x + imageRect.width - selectorHalfWidth;
    const minY = imageRect.y + selectorHalfHeight;
    const maxY = imageRect.y + imageRect.height - selectorHalfHeight;
    
    newX = Math.max(minX, Math.min(maxX, newX));
    newY = Math.max(minY, Math.min(maxY, newY));
    
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
        editor.stage.draggable(true);
        editor.stage.add(cropLayer);
        editor.stage.add(maskLayer);
        editor.stage.scale({ x: 1, y: 1 });
        editor.stage.position({ x: 0, y: 0 });
        
        editor.stage.off('wheel'); 
        editor.stage.on('wheel', handleCropStageZooming);
        
        const cropZoomIn = editor.wrapper.find('.js-crop-zoomin');
        const cropZoomOut = editor.wrapper.find('.js-crop-zoomout');
        const cropZoomInput = editor.wrapper.find('#crop-stage-zoom');
        
        cropZoomIn.on('click', () => handleCropManualZoom(true));
        cropZoomOut.on('click', () => handleCropManualZoom(false));
        
        cropZoomInput.val("100");
        
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
        
        editor.stage.off('wheel');
        editor.stage.on('wheel', (e) => handleStageZooming(e));
        
        const cropZoomIn = editor.wrapper.find('.js-crop-zoomin');
        const cropZoomOut = editor.wrapper.find('.js-crop-zoomout');
        cropZoomIn.off('click');
        cropZoomOut.off('click');
        
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
    const selectorWidth = selector.width() * selector.scaleX();
    const selectorHeight = selector.height() * selector.scaleY();
    
    const imageLeft = image.x() - image.width() / 2;
    const imageTop = image.y() - image.height() / 2;
    const selectorLeft = selector.x() - selectorWidth / 2;
    const selectorTop = selector.y() - selectorHeight / 2;
    
    const cropX = selectorLeft - imageLeft;
    const cropY = selectorTop - imageTop;
    const cropWidth = selectorWidth;
    const cropHeight = selectorHeight;

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
        y: cropY,
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
