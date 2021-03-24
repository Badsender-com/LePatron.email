export const ACTIONS = {
  RENAME: 'RENAME',
  TRANSFER: 'TRANSFER',
  DELETE: 'DELETE',
  COPY_MAIL: 'COPY_MAIL',
  MOVE_MAIL: 'MOVE_MAIL',
};

export const ACTIONS_DETAILS = {
  [ACTIONS.RENAME]: {
    text: 'tableHeaders.mailings.rename',
    icon: 'title',
    emit: 'rename-action',
  },
  [ACTIONS.TRANSFER]: {
    text: 'tableHeaders.mailings.transfer',
    icon: 'forward',
    emit: 'transfer-action',
  },
  [ACTIONS.DELETE]: {
    text: 'global.delete',
    icon: 'delete',
    emit: 'delete-action',
  },
  [ACTIONS.COPY_MAIL]: {
    text: 'global.copyMail',
    icon: 'content_copy',
    emit: 'copy-mail-action',
  },
  [ACTIONS.MOVE_MAIL]: {
    text: 'global.moveMail',
    icon: 'forward',
    emit: 'copy-mail-action',
  },
};
