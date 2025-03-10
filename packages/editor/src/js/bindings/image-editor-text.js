'use strict';
import Konva from 'Konva';

export const EditorText = (editor) => {

    function addText() {
        const textNode = new Konva.Text({
            draggable: true,
            text: 'Placeholder text',
            fontSize: 20,
            fill: 'black',
        });

        textNode.x((editor.stage.width() - textNode.width()) / 2);
        textNode.y((editor.stage.height() - textNode.height() - 50));
        textNode.offsetX(textNode.width() / 2);
        textNode.offsetY(textNode.height() / 2);

        textNode.on('pointerdblclick', () => editText(textNode));
        textNode.padding(6);
        editor.children.push(textNode);
        editor.layer.add(textNode);
        editor.transformer.nodes([textNode]);
        editor.transformer.moveToTop();
        editor.selection = textNode;
        editor.inputWidth.val(Math.round(editor.transformer.width()));
        editor.inputHeight.val(Math.round(editor.transformer.height()));
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
        input.style.width = node.width() * node.scaleX() + 5 + 'px';
        input.style.height = node.height() * node.scaleY() + 'px';
        input.style.maxWidth =  editor.stage.width() / 2 + 'px';
        input.style.maxHeight = editor.stage.height() / 2 + 'px';
        input.style.fontSize = node.fontSize() * node.scaleY() + 'px';
        input.style.padding = '6px';
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
        input.focus();


        input.addEventListener('blur', () => removeInput(input, node));
        setTimeout(() => {
            window.addEventListener('click', (e) => handleOutsideClick(e, input, node));
        });
    }

    function handleOutsideClick(event, input, node) {
        if (event.target !== editor.stage && event.target !== input && event.target !== node) {
            removeInput(input, node);
        }
    }

    function removeInput(input, node) {
        if (!input.parentNode) return; // Another event might already have called this method

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
        window.removeEventListener('click', handleOutsideClick);
    }

    function removeText(node) {
        node.destroy();
        node = null;
    }

    return { addText, removeText };
}