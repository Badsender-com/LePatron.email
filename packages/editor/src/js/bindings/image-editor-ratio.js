'use strict';
import Konva from 'Konva';

export const EditorRatio = (editor, transformer, target, id) => {
    editor.ratioToolbar.append(toolbar(editor.messages, id));

    editor.ratio = "0";
    const ratioSelector = editor.wrapper.find("#" + id);
    ratioSelector.on('change', () => {
        editor.ratio = ratioSelector.val();
        transformer.keepRatio(editor.ratio !== "0");
    });

    target.on('transform', () => {
        if (editor.ratio === "0") return;

        const ratio = toRatio(editor.ratio);
        target.height(target.height() * ratio);
    });
}

function toRatio(value) {
    var ratioParts = value.split('-');
    var widthRatio = parseInt(ratioParts[0], 10);
    var heightRatio = parseInt(ratioParts[1], 10);

    return (widthRatio ?? 1) / (heightRatio ?? 1);
}

const toolbar = (messages, id) => `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M560-280h200v-200h-80v120H560v80ZM200-480h80v-120h120v-80H200v200Zm-40 320q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm0 0v-480 480Z"/></svg>
    <select name="${id}" id="${id}" style="border-radius: 2px;">
        <option value="0">Forme libre</option>
        <option value="4-3">Standard (4:3)</option>
        <option value="16-9">Paysage (16:9)</option>
        <option value="9-16">Portrait (9:16)</option>
        <option value="1-1">Carré (1:1)</option>
    </select>
`;