export const ACTIONS = {
  RENAME: 'RENAME',
  TRANSFER: 'TRANSFER',
  DELETE: 'DELETE',
  COPY_MAIL: 'COPY_MAIL',
  ADD_TAGS: 'ADD_TAGS',
};

export const ACTIONS_DETAILS = {
  [ACTIONS.RENAME]: {
    text: 'tableHeaders.mailings.rename',
    icon: 'title',
  },
  [ACTIONS.TRANSFER]: {
    text: 'tableHeaders.mailings.transfer',
    icon: 'forward',
  },
  [ACTIONS.DELETE]: {
    text: 'global.delete',
    icon: 'delete',
  },
  [ACTIONS.COPY_MAIL]: {
    text: 'global.copyMail',
    icon: 'content_copy',
    emit: 'copy-mail-action',
  },
  [ACTIONS.ADD_TAGS]: {
    text: 'global.addTags',
    icon: 'label',
  },
};
