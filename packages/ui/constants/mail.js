export const ACTIONS = {
  RENAME: 'actionRename',
  TRANSFER: 'actionTransfer',
  DELETE: 'actionDelete',
  COPY_MAIL: 'actionCopyMail',
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
};
