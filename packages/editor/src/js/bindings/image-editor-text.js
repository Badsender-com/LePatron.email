'use strict';
import Konva from 'Konva';

export const EditorText = (editor) => {

    function addText() {
        const textNode = new Konva.Text({
            draggable: true,
            text: 'BadSender placeholder text',
            fontSize: 20,
            fill: 'whitesmoke',
        });

        textNode.x((editor.stage.width() - textNode.width()) / 2);
        textNode.y((editor.stage.height() - textNode.height() - 50));

        textNode.on('pointerdblclick', () => editText(textNode));
        editor.layer.add(textNode);
    }

    function editText(node) {
        node.hide();
        editor.transformer.nodes([]);
        
        const position = node.absolutePosition();
        var inputPos = {
            x: editor.stage.container().offsetLeft + position.x,
            y: editor.stage.container().offsetTop + position.y,
        };


        window.addEventListener('click', (e) => {
            if (e.target)
        });
    }

    function removeInput(input) {

    }

    return { addText };
}