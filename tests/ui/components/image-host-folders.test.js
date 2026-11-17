import { folderOptions } from '~/components/integrations/image-host-folders.js';

describe('folderOptions', () => {
  it('labels each folder with its path, sorted by path', () => {
    const options = folderOptions([
      { id: 3, parent: 1, name: 'Emails' },
      { id: 1, parent: 0, name: 'Marque A' },
      { id: 2, parent: 0, name: 'Logos' },
      { id: 4, parent: 3, name: '2026' },
    ]);

    expect(options).toEqual([
      { value: 2, text: 'Logos' },
      { value: 1, text: 'Marque A' },
      { value: 3, text: 'Marque A / Emails' },
      { value: 4, text: 'Marque A / Emails / 2026' },
    ]);
  });

  it('keeps two folders of the same name apart', () => {
    const options = folderOptions([
      { id: 1, parent: 0, name: 'Marque A' },
      { id: 2, parent: 0, name: 'Marque B' },
      { id: 3, parent: 1, name: 'Emails' },
      { id: 4, parent: 2, name: 'Emails' },
    ]);

    expect(options.map((o) => o.text)).toEqual([
      'Marque A',
      'Marque A / Emails',
      'Marque B',
      'Marque B / Emails',
    ]);
  });

  it('stops on a folder that is its own ancestor', () => {
    const options = folderOptions([
      { id: 1, parent: 2, name: 'A' },
      { id: 2, parent: 1, name: 'B' },
    ]);

    expect(options).toEqual([
      { value: 2, text: 'A / B' },
      { value: 1, text: 'B / A' },
    ]);
  });
});
