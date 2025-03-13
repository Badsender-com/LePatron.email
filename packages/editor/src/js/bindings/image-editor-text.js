'use strict';
import Konva from 'Konva';

export const EditorText = (editor) => {

  editor.textColor.on('input', () => handleColorChanged());
  editor.textStyle.on('input', () => handleStyleChanged());
  editor.textSize.on('input', () => handleSizeChanged());

  const minSize = 10;

  /**
   * Adds a new text node to the stage and updates the selected element actions such as width / height inputs and element type.
   */
  function addText() {
    const textNode = new Konva.Text({
      draggable: true,
      text: 'LePatron Email Builder',
      fontSize: 40,
      padding: 6,
      fill: '#000',
      ellipsis: true, // Shows "..." at the end of the truncated text when the node's text is bigger than the node's width / height
    });

    textNode.x(editor.stage.width() / 2);
    textNode.y(editor.stage.height() - textNode.height() - 10);
    textNode.offsetX(textNode.width() / 2);
    textNode.offsetY(textNode.height() / 2);

    const stageBox = {
      x: -editor.stage.x(),
      y: -editor.stage.y(),
      width: editor.stage.width(),
      height: editor.stage.height(),
    };
    
    const elementBox = textNode.getClientRect();

    let newX = editor.stage.x();
    let newY = editor.stage.y();

    if (elementBox.x < stageBox.x) {
      newX = -elementBox.x;
    }
    else if (elementBox.x + elementBox.width > stageBox.x + stageBox.width) {
      newX = -(elementBox.x + elementBox.width - stageBox.width);
    }

    if (elementBox.y < stageBox.y) {
      newY = -elementBox.y;
    }
    else if (elementBox.y + elementBox.height > stageBox.y + stageBox.height) {
      newY = -(elementBox.y + elementBox.height - stageBox.height);
    }

    new Konva.Tween({
      node: editor.stage,
      duration: .5,
      x: newX,
      y: newY,
      easing: Konva.Easings.EaseInOut,
    }).play();

    textNode.on('transform', () => textNode.setAttrs({
      width: Math.max(textNode.width() * textNode.scaleX(), textNode.fontSize()),
      height: Math.max(textNode.height() * textNode.scaleY(), textNode.fontSize() * textNode.lineHeight() + 2),
      scaleX: 1,
      scaleY: 1,
      offsetX: Math.max(textNode.width() * textNode.scaleX(), textNode.fontSize()) / 2,
      offsetY: Math.max(textNode.height() * textNode.scaleY(), textNode.fontSize()) / 2,
    }));
    textNode.on('pointerdblclick', () => editText(textNode));
    editor.children.push(textNode);
    editor.layer.add(textNode);
    editor.transformer.nodes([textNode]);
    editor.transformer.enabledAnchors(editor.middleAnchors);
    editor.transformer.flipEnabled(false);
    editor.transformer.moveToTop();
    editor.selection = textNode;
    editor.inputWidth.val(Math.round(editor.transformer.width()));
    editor.inputHeight.val(Math.round(editor.transformer.height()));
    editor.textSize.val(textNode.fontSize());
  }

  /**
   * Displays a text input with similar properties than the given text node.
   * Hides the given text node and handles outside click to stop edition.
   * @param {Konva.Text} node - The text node to be edited.
   */
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
    input.style.fontStyle = node.fontStyle();
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

  /**
   * Handles cliks outside the given node to stop edition.
   * @param {MouseEvent} event - The click event.
   * @param {HTMLTextAreaElement} input - The html input displayed with the new value of the text node.
   * @param {Konva.Text} node - The text node which we stop edition from.
   */
  function handleOutsideClick(event, input, node) {
    if (event.target !== editor.stage && event.target !== input && event.target !== node) {
      removeInput(input, node);
    }
  }

  /**
   * Removes the given input and restores its text node with the new value.
   * @param {HTMLTextAreaElement} input - The html input used for edition.
   * @param {Konva.Text} node - The base text node.
   */
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
    node.offsetX(node.width() / 2);
    node.offsetY(node.height() / 2);
    input.parentNode.removeChild(input);

    node.show();
    input.removeEventListener('blur', removeInput);
    window.removeEventListener('click', handleOutsideClick);
  }

  /**
   * Removes the given text node from its layer.
   * @param {Konva.Text} node - The text node to be destroyed.
   */
  function removeText(node) {
    node.destroy();
    node = null;
  }

  function handleColorChanged() {
    if (!editor.selection instanceof Konva.Text) return;

    editor.selection.fill(editor.textColor.val());
  }

  function handleStyleChanged() {
    if (!editor.selection instanceof Konva.Text) return;

    editor.selection.fontStyle(editor.textStyle.val());
    handleSizeChanged(); // Force updates the size because bold and italic styles take more space than normal style
  }

  /**
   * Calculates the new size of the text on the canvas based on the longest line of the text and its font style
   */
  function handleSizeChanged() {
    if (!editor.selection instanceof Konva.Text) return;

    const node = editor.selection;
    const newFontSize = stringToNumber(editor.textSize.val());
    node.fontSize(newFontSize);

    const canvas = editor.layer.getCanvas();
    const ctx = canvas.getContext('2d');
    const longestLine = node.text().split('\n').reduce((longest, current) => {
        return current.length > longest.length ? current : longest;
      }, "");
    ctx.font = `${node.fontStyle()} ${newFontSize}px ${node.fontFamily()}`;
    const metrics = ctx.measureText(longestLine);
    const newWidth = metrics.width + node.padding() * 3; // padding x3 because we need the left and right padding and the text margin

    node.setAttrs({
      width: newWidth,
      scaleX: 1,
      offsetX: newWidth / 2,
    });
  }

  /**
   * Parses the given value into an integer value. If the value couldn't be parsed returns 1.
   * @param {string} value - The int value as a string.
   * @returns {int} Returns the parsed value as an int.
   */
  function stringToNumber(value) {
    if (value === undefined) return minSize;

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? minSize : parsed;
  }

  return { addText, removeText };
}