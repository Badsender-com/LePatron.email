'use strict';

// The riskiest code of the panel: two writes through two different mechanisms,
// and a state to update only for the ones that actually succeeded. It had no test
// at all until the review pointed out that a failed global save left the user with
// a success message, a disabled Save button, and an unsaved preheader.

const {
  runSave,
  OUTCOME,
} = require('../../packages/editor/src/js/utils/email-metadata-save.js');

const resolved = () => jest.fn().mockResolvedValue(undefined);
const rejected = (message) =>
  jest
    .fn()
    .mockRejectedValue(Object.assign(new Error(message), { code: message }));

describe('runSave — what it sends', () => {
  it('does nothing when nothing changed', async () => {
    const patch = resolved();
    const globalSave = resolved();

    const result = await runSave({
      metadataChanged: false,
      preheaderChanged: false,
      patch,
      globalSave,
    });

    expect(result.outcome).toBe(OUTCOME.NOTHING);
    expect(patch).not.toHaveBeenCalled();
    expect(globalSave).not.toHaveBeenCalled();
  });

  it('patches only, when only the metadata changed', async () => {
    const patch = resolved();
    const globalSave = resolved();

    const result = await runSave({
      metadataChanged: true,
      preheaderChanged: false,
      patch,
      globalSave,
    });

    expect(result).toEqual({
      outcome: OUTCOME.METADATA,
      savedMetadata: true,
      savedPreheader: false,
    });
    expect(globalSave).not.toHaveBeenCalled();
  });

  // A PATCH rewriting three unchanged fields is a request for nothing, and it
  // makes the server revalidate the typology for no reason.
  it('skips the patch when only the preheader changed', async () => {
    const patch = resolved();
    const globalSave = resolved();

    const result = await runSave({
      metadataChanged: false,
      preheaderChanged: true,
      patch,
      globalSave,
    });

    expect(patch).not.toHaveBeenCalled();
    expect(globalSave).toHaveBeenCalled();
    expect(result).toEqual({
      outcome: OUTCOME.BOTH,
      savedMetadata: false,
      savedPreheader: true,
    });
  });

  it('does both, in order, when both changed', async () => {
    const order = [];
    const patch = jest.fn(async () => order.push('patch'));
    const globalSave = jest.fn(async () => order.push('globalSave'));

    const result = await runSave({
      metadataChanged: true,
      preheaderChanged: true,
      patch,
      globalSave,
    });

    expect(order).toEqual(['patch', 'globalSave']);
    expect(result.outcome).toBe(OUTCOME.BOTH);
  });
});

describe('runSave — failures', () => {
  it('propagates a failed patch and never reaches the global save', async () => {
    const globalSave = resolved();

    await expect(
      runSave({
        metadataChanged: true,
        preheaderChanged: true,
        patch: rejected('PATCH_FAILED'),
        globalSave,
      })
    ).rejects.toMatchObject({ code: 'PATCH_FAILED' });

    expect(globalSave).not.toHaveBeenCalled();
  });

  // The point of the whole module: the preheader must stay dirty so the user can
  // retry, and the caller must know the PATCH did land.
  it('reports which half succeeded when the global save fails', async () => {
    let caught;
    try {
      await runSave({
        metadataChanged: true,
        preheaderChanged: true,
        patch: resolved(),
        globalSave: rejected('SAVE_FAILED'),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught.code).toBe('SAVE_FAILED');
    expect(caught.partial).toEqual({
      savedMetadata: true,
      savedPreheader: false,
    });
  });

  it('reports nothing saved when the global save fails alone', async () => {
    let caught;
    try {
      await runSave({
        metadataChanged: false,
        preheaderChanged: true,
        patch: resolved(),
        globalSave: rejected('SAVE_FAILED'),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught.partial).toEqual({
      savedMetadata: false,
      savedPreheader: false,
    });
  });

  // Two concurrent global saves can land in the wrong order and persist an older
  // `data` last.
  it('refuses to start a global save while one is in flight', async () => {
    const globalSave = resolved();
    let caught;

    try {
      await runSave({
        metadataChanged: true,
        preheaderChanged: true,
        patch: resolved(),
        globalSave,
        canGlobalSave: () => false,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught.code).toBe('SAVE_IN_FLIGHT');
    expect(caught.partial).toEqual({
      savedMetadata: true,
      savedPreheader: false,
    });
    expect(globalSave).not.toHaveBeenCalled();
  });
});

describe('runSave — a save command that returns nothing', () => {
  // Not every editor command hands back a promise; awaiting undefined must be a
  // no-op rather than a crash.
  it('tolerates a global save with no promise', async () => {
    const result = await runSave({
      metadataChanged: false,
      preheaderChanged: true,
      patch: resolved(),
      globalSave: jest.fn().mockReturnValue(undefined),
    });

    expect(result.outcome).toBe(OUTCOME.BOTH);
    expect(result.savedPreheader).toBe(true);
  });
});
