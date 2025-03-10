'use strict';
import Konva from 'Konva';

export const EditorCropper = (editor) => {

    let cropLayer = null;
    let selector = null;
    let transformer = null;
    let ratioSelector = null;
    let baseImage = null;

    // Ratio
    function toRatio(value) {
        if (value === "0") return 0;

        var ratioParts = value.split('-');
        var widthRatio = parseInt(ratioParts[0], 10);
        var heightRatio = parseInt(ratioParts[1], 10);

        return (widthRatio ?? 1) / (heightRatio ?? 1);
    }

    function setSelectorToRatio(ratio) {
        resetSelector();

        if (ratio === 0) {   
            transformer.enabledAnchors(editor.baseAnchors);         
            return;
        }

        transformer.enabledAnchors(editor.cornerAnchors);

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

    // Crop lifecycle
    function init() {
        ratioSelector = editor.wrapper.find("#ratio-selector");
        ratioSelector.on('change', () => setSelectorToRatio(toRatio(ratioSelector.val())));

        cropLayer = new Konva.Layer();

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

        transformer = new Konva.Transformer({
            flipEnabled: false,
            enabledAnchors: ratioSelector.val() === "0" ? editor.baseAnchors : editor.cornerAnchors,
            rotateEnabled: false,
            rotateLineVisible: false,
        });

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
    }

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

        editor.children.forEach(node => {
            node.draggable(false);
            node.hide();
        });

        cropLayer.add(selector);
        cropLayer.add(transformer);
        transformer.nodes([selector]);
        editor.transformer.nodes([]);
        editor.stage.add(cropLayer);
    }

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
        editor.image.cache();
        editor.transformer.nodes([]);
        editor.stage.batchDraw();

        transformer = null;
        selector = null;
        cropLayer = null;
        baseImage = null;

        ratioSelector.off('change');
        ratioSelector = null;
    }

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

    return { start, stop };
};