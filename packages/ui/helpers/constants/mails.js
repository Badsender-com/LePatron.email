export const ACTIONS = {
  RENAME: 'RENAME',
  TRANSFER: 'TRANSFER',
  DELETE: 'DELETE',
  COPY_MAIL: 'COPY_MAIL',
  ADD_TAGS: 'ADD_TAGS',
  MOVE_MAIL: 'MOVE_MAIL',
  PREVIEW: 'PREVIEW',
  DOWNLOAD: 'DOWNLOAD',
  DOWNLOAD_FTP: 'DOWNLOAD_FTP',
  DUPLICATE_TRANSLATE: 'DUPLICATE_TRANSLATE',
};

export const ACTIONS_DETAILS = {
  [ACTIONS.RENAME]: {
    text: 'tableHeaders.mailings.rename',
    icon: 'text-cursor',
  },
  [ACTIONS.TRANSFER]: {
    text: 'tableHeaders.mailings.transfer',
    icon: 'forward',
  },
  [ACTIONS.DELETE]: {
    text: 'global.delete',
    icon: 'trash-2',
  },
  [ACTIONS.COPY_MAIL]: {
    text: 'global.copyMail',
    icon: 'copy',
  },
  [ACTIONS.ADD_TAGS]: {
    text: 'global.addTags',
    icon: 'tag',
  },
  [ACTIONS.MOVE_MAIL]: {
    text: 'global.moveMail',
    icon: 'folder-input',
    emit: 'copy-mail-action',
  },
  [ACTIONS.PREVIEW]: {
    text: 'global.preview',
    icon: 'eye',
  },
  [ACTIONS.DOWNLOAD]: {
    text: 'global.download',
    icon: 'download',
  },
  [ACTIONS.DOWNLOAD_FTP]: {
    text: 'global.downloadFtp',
    icon: 'cloud-download',
  },
  [ACTIONS.DUPLICATE_TRANSLATE]: {
    text: 'mailings.duplicateTranslate',
    icon: 'languages',
  },
  [ACTIONS.DUPLICATE_TRANSLATE]: {
    text: 'mailings.duplicateTranslate',
    icon: 'mdi-translate',
  },
};
