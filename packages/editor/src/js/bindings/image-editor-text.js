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
        
        const rect = node.getClientRect();

        const input = document.createElement('textarea');
        editor.container.appendChild(input);


        input.value = node.text();
        input.className = "text-editor-input";
        input.style.position = 'absolute';
        input.style.top = rect.y + 'px';
        input.style.left = rect.x + 'px';
        input.style.width = node.width() + 5 + 'px';
        input.style.height = node.height() + 'px';
        input.style.fontSize = node.fontSize() + 'px';
        input.style.padding = '0px';
        input.style.margin = '0px';
        input.style.overflow = 'hidden';
        input.style.background = 'none';
        input.style.outline = 'none';
        input.style.resize = 'none';
        input.style.lineHeight = node.lineHeight();
        input.style.fontFamily = node.fontFamily();
        input.style.transformOrigin = 'left top';
        input.style.textAlign = node.align();
        input.style.color = node.fill();

        let transform = '';
        if (node.rotation() !== -0) {
            transform += 'rotateZ(' + node.rotation() + 'deg)';
        }

        input.style.transform = transform;


        input.addEventListener('blur', () => removeInput(input, node));
    }

    function removeInput(input, node) {
        if (!input.value || input.value === "") {
            node.destroy();
            node = null;
            input.destroy();
            input = null;
            editor.transformer.nodes([editor.image]);
            return;
        }

        node.text(input.value);
        input.parentNode.removeChild(input);
        node.show();
        input.removeEventListener('blur', removeInput);
    }

    function removeText(node) {
        node.destroy();
        node = null;
    }

    return { addText, removeText };
}