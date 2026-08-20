/**
 * @jest-environment jsdom
 */

'use strict';

const copyToClipboard = require('../../../packages/ui/helpers/copy-to-clipboard')
  .default;

describe('copyToClipboard', () => {
  let execCommand;

  beforeEach(() => {
    execCommand = jest.fn().mockReturnValue(true);
    document.execCommand = execCommand;
    delete navigator.clipboard;
    window.isSecureContext = true;
  });

  it('returns false for empty text without touching the DOM', async () => {
    await expect(copyToClipboard('')).resolves.toBe(false);
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('uses navigator.clipboard in a secure context', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    navigator.clipboard = { writeText };

    await expect(copyToClipboard('{{input.prompt}}')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('{{input.prompt}}');
    expect(execCommand).not.toHaveBeenCalled();
  });

  // A plain-HTTP staging host has no navigator.clipboard at all.
  it('falls back to execCommand outside a secure context', async () => {
    window.isSecureContext = false;
    navigator.clipboard = { writeText: jest.fn() };

    await expect(copyToClipboard('{{input.prompt}}')).resolves.toBe(true);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('falls back to execCommand when the clipboard permission is denied', async () => {
    navigator.clipboard = {
      writeText: jest.fn().mockRejectedValue(new Error('NotAllowedError')),
    };

    await expect(copyToClipboard('{{input.prompt}}')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('reports failure rather than throwing when nothing works', async () => {
    execCommand.mockReturnValue(false);
    await expect(copyToClipboard('{{input.prompt}}')).resolves.toBe(false);
  });

  it('leaves no textarea behind', async () => {
    await copyToClipboard('{{input.prompt}}');
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });
});
