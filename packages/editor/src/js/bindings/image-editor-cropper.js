'use strict';
import Konva from 'Konva';

export const EditorCropper = (editor) => {

    let cropLayer = null;
    let selector = null;
    let transformer = null;

    function start() {
        console.log("crop started", { img: editor.image, x: editor.image.x(), y: editor.image.y() });
        init();

        editor.image.draggable(false);
        editor.transformer.nodes([]);
        editor.stage.add(cropLayer);
        cropLayer.add(selector);
        cropLayer.add(transformer);
    }

    function stop() {
        console.log("crop ended");
        transformer.nodes([]);
        cropLayer.destroyChildren();
        cropLayer.destroy();
        
        editor.image.crop({
            x: selector.x() - editor.image.x(),
            y: selector.y() - editor.image.y(),
            width: selector.width() * selector.scaleX(),
            height: selector.height() * selector.scaleY(),
        });
        editor.image.draggable(true);
        editor.transformer.nodes([editor.image]);
        editor.stage.batchDraw();
        
        transformer = null;
        selector = null;
        cropLayer = null;
    }

    function init() {
        cropLayer = new Konva.Layer();

        selector = new Konva.Rect({
            x: editor.image.x(),
            y: editor.image.y(),
            width: editor.image.width() * editor.image.scaleX(),
            height: editor.image.height() * editor.image.scaleY(),
            offsetX: editor.image.width() / 2,
            offsetY: editor.image.height() / 2,
            rotation: editor.image.rotation(),
            fill: 'rgba(0, 144, 192, 0.5)',
            stroke: 'skyblue',
            strokeWidth: 2,
            draggable: true,
        });

        transformer = new Konva.Transformer({
            nodes: [selector],
            boundBoxFunc: (oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) {
                    return oldBox;
                }
                return newBox;
            },
        });
    }

    return { start, stop };
};