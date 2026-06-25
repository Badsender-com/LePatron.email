'use strict';

// Regression guard for the blocking review finding (#C): freshTracking — the
// live tracking state typed in the builder but NOT yet saved — must reach the
// HTML rewrite on every ESP send/update path, not only the validation step.
//
// Before the fix, profile.service validated against freshTracking but called
// the providers WITHOUT it, so the email actually sent to the ESP used the
// stale persisted tracking. The providers already accepted freshTracking; the
// gap was the call site. This test pins the provider -> mailingService hop for
// each of the 4 ESPs so a future refactor cannot silently drop it again.
//
// Each ESP funnels freshTracking through a different mailingService seam:
//   SendinBlue -> processHtmlWithFTPOption
//   DSC        -> processHtmlWithFTPOption
//   Actito     -> downloadZip
//   Adobe      -> resolveMailingTrackingContext
// We mock those seams to capture their args without hitting the DB or SDKs.

const mailingService = require('../../../packages/server/mailing/mailing.service.js');

const FRESH = {
  trackingUrls: [{ key: 'utm_source', value: 'live-not-yet-saved' }],
};

let htmlArgs;
let zipArgs;
let resolveArgs;

beforeEach(() => {
  htmlArgs = [];
  zipArgs = [];
  resolveArgs = [];
  jest
    .spyOn(mailingService, 'processHtmlWithFTPOption')
    .mockImplementation(async (args) => {
      htmlArgs.push(args);
      return '<html>processed</html>';
    });
  jest.spyOn(mailingService, 'downloadZip').mockImplementation(async (args) => {
    zipArgs.push(args);
    // Shape minimally so formatActitoData can destructure without crashing.
    return { archive: null, archiveName: 'x', processedHtml: '<html></html>' };
  });
  jest
    .spyOn(mailingService, 'resolveMailingTrackingContext')
    .mockImplementation(async (mailing, freshTracking) => {
      resolveArgs.push({ mailing, freshTracking });
      return { tracking: freshTracking, groupTrackingConfig: null };
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const campaignMailData = {
  senderName: 's',
  senderMail: 's@x.com',
  subject: 'sub',
  name: 'n',
  replyTo: 'r@x.com',
  contentSendType: 'MAIL',
};

const baseArgs = {
  user: { id: 'u1' },
  html: '<a href="https://x.com">l</a>',
  mailingId: 'm1',
  campaignMailData,
  freshTracking: FRESH,
};

describe('freshTracking threading to the HTML rewrite, per ESP', () => {
  it('SendinBlue forwards freshTracking to processHtmlWithFTPOption', async () => {
    const Provider = require('../../../packages/server/esp/sendinblue/sendinBlueProvider.js');
    const p = new Provider({});
    await p.formatSendinBlueData({ ...baseArgs }).catch(() => {});
    expect(htmlArgs.length).toBeGreaterThan(0);
    expect(htmlArgs[0].freshTracking).toBe(FRESH);
  });

  it('DSC forwards freshTracking to processHtmlWithFTPOption', async () => {
    const Provider = require('../../../packages/server/esp/dsc/dscProvider.js');
    const p = new Provider({});
    await p.formatDscData({ ...baseArgs }).catch(() => {});
    expect(htmlArgs.length).toBeGreaterThan(0);
    expect(htmlArgs[0].freshTracking).toBe(FRESH);
  });

  it('Actito forwards freshTracking to downloadZip', async () => {
    const Provider = require('../../../packages/server/esp/actito/actitoProvider.js');
    const p = new Provider({});
    await p.formatActitoData({ ...baseArgs }).catch(() => {});
    expect(zipArgs.length).toBeGreaterThan(0);
    expect(zipArgs[0].freshTracking).toBe(FRESH);
  });

  // Adobe destructures resolveMailingTrackingContext / getMailByMailingIdAndUser
  // at import time, so a jest.spyOn(mailingService, ...) does NOT intercept its
  // local references. We use a module mock (jest.doMock) inside isolateModules
  // so the destructured imports point at our mocks.
  it('Adobe forwards freshTracking to resolveMailingTrackingContext', async () => {
    const adobeResolveArgs = [];
    jest.isolateModules(() => {
      jest.doMock(
        '../../../packages/server/mailing/mailing.service.js',
        () => ({
          getMailByMailingIdAndUser: async () => ({ _id: 'm1' }),
          resolveMailingTrackingContext: async (mailing, freshTracking) => {
            adobeResolveArgs.push({ mailing, freshTracking });
            return { tracking: freshTracking, groupTrackingConfig: null };
          },
          handleTrackingData: ({ html }) => ({ html }),
        })
      );
      const Provider = require('../../../packages/server/esp/adobe/adobeProvider.js');
      const p = new Provider({});
      // Stub the image/SOAP pipeline so we stop right after the resolve call.
      p.sendAndProcessImageIntoAdobe = async () => '<html></html>';
      p.saveDeliveryTemplate = async () => {};
      return p
        .createCampaignMail({
          ...baseArgs,
          campaignMailData: { ...campaignMailData, adobe: {} },
        })
        .catch(() => {});
    });
    // isolateModules runs synchronously; the promise above resolves on the
    // microtask queue, so flush it.
    await new Promise((resolve) => setImmediate(resolve));
    expect(adobeResolveArgs.length).toBeGreaterThan(0);
    expect(adobeResolveArgs[0].freshTracking).toBe(FRESH);
  });
});
