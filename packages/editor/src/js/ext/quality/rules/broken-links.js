'use strict';

const { checkableLinks, remoteLink } = require('../resources');

// Checked by the server (POST /mailings/:id/quality/resources): it follows the
// redirects and reports how the page answers. A broken page is an error; a site
// that refuses robots or answers too slowly is only worth a look, since a
// reader may well see the page.
function messageOf(result) {
  if (result.state === 'broken') {
    return result.httpStatus
      ? { severity: 'error', messageKey: 'Broken link (__status__): __label__' }
      : {
          severity: 'error',
          messageKey: 'Link to a domain that does not exist: __label__',
        };
  }
  if (result.reason === 'timeout') {
    return {
      severity: 'info',
      messageKey: 'Link did not answer in time, check it by hand: __label__',
    };
  }
  return {
    severity: 'info',
    messageKey: result.httpStatus
      ? 'Link could not be checked (__status__), check it by hand: __label__'
      : 'Link could not be checked, check it by hand: __label__',
  };
}

const checkedLinks = (ctx) =>
  checkableLinks(ctx).filter((link) => remoteLink(ctx, link.href));

module.exports = {
  id: 'broken-links',
  category: 'content',
  severity: 'error',
  titleKey: 'Broken links',
  remote: true,
  // Nothing checked, nothing to say: not listed.
  enabled: (ctx) => checkedLinks(ctx).length > 0,
  passKey: 'Links checked: __count__, all answer',
  passParams: (ctx) => ({
    count: new Set(checkedLinks(ctx).map((link) => link.href)).size,
  }),
  run(ctx) {
    return checkedLinks(ctx)
      .map((link) => ({ link, result: remoteLink(ctx, link.href) }))
      .filter(({ result }) => result.state !== 'ok')
      .map(({ link, result }) => ({
        ...messageOf(result),
        blockId: link.blockId,
        params: { label: link.text || link.href, status: result.httpStatus },
        // Ignoring "could not be checked" must not hide a later "broken".
        value: `${result.state}|${link.href}`,
      }));
  },
};
