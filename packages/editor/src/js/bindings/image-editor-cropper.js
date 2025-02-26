'use strict';
import Konva from 'Konva';

export const EditorCropper = (editor) => {

    let cropLayer = null;
    let selector = null;
    let transformer = null;

    let baseImage = null;

    function init() {
        cropLayer = new Konva.Layer();

        selector = new Konva.Rect({
            x: editor.lastCrop?.selectorX ?? editor.stage.width() / 2,
            y: editor.lastCrop?.selectorY ?? editor.stage.height() / 2,
            width: editor.lastCrop?.width ?? editor.image.width(),
            height: editor.lastCrop?.height ?? editor.image.height(),
            offsetX: editor.lastCrop?.width ?? editor.image.width() / 2,
            offsetY: editor.lastCrop?.height ?? editor.image.height() / 2,
            scaleX: editor.lastCrop?.scaleX ?? editor.image.scaleX(),
            scaleY: editor.lastCrop?.scaleY ?? editor.image.scaleY(),
            fill: 'rgba(0, 144, 192, 0.5)',
            stroke: 'skyblue',
            strokeWidth: 2,
            draggable: true,
        });

        transformer = new Konva.Transformer({
            flipEnabled: false,
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
        }
    }

    function start() {
        init();

        editor.image.setAttrs({
            width: editor.baseImage.width,
            height: editor.baseImage.height,
            rotation: editor.baseImage.rotation,
            x: editor.stage.width() / 2,
            y: editor.stage.height() / 2,
            scaleX: 1,
            scaleY: 1,
            crop: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            }
        });

        cropLayer.add(selector);
        cropLayer.add(transformer);
        transformer.nodes([selector]);
        editor.image.draggable(false);
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
        else if (editor.lastCrop) {
            editor.image.crop({
                x: editor.lastCrop.x,
                y: editor.lastCrop.y,
                width: editor.lastCrop.width,
                height: editor.lastCrop.height,
            });
        }

        editor.image.setAttrs({
            x: baseImage.x,
            y: baseImage.y,
            width: baseImage.width,
            height: baseImage.height,
            scaleX: baseImage.scaleX,
            scaleY: baseImage.scaleY,
            rotation: baseImage.rotation,
        });

        editor.image.draggable(true);
        editor.transformer.nodes([editor.image]);
        editor.stage.batchDraw();

        if (doCrop) {
            editor.lastCrop = {
                x: editor.image.cropX(),
                y: editor.image.cropY(),
                width: editor.image.cropWidth(),
                height: editor.image.cropHeight(),
                selectorX: selector.x(),
                selectorY: selector.y(),
            };
        }
        
        transformer = null;
        selector = null;
        cropLayer = null;
        baseImage = null;
    }

    function applyCrop() {
        const rect = selector.getClientRect();
        const baseRect = editor.image.getClientRect();

        const scaleX = editor.image.scaleX();
        const scaleY = editor.image.scaleY();

        const cropX = Math.abs(rect.x - baseRect.x) / scaleX ;
        const cropY = Math.abs(rect.y - baseRect.y) / scaleY;
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
            x: editor.image.x() + cropX * scaleX,
            y: editor.image.y() + cropY * scaleY,
        });
    }

    return { start, stop };
};