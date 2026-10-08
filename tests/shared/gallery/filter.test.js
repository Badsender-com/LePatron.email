'use strict';

const {
  filterGalleryFiles,
} = require('../../../packages/shared/gallery/filter.js');

const MONGO_ID = '6a212f21f802c2a6f99a4184';

const TEST_FILES = [
  {
    name: `${MONGO_ID}-aaa.jpg`,
    label: 'logo.jpg',
    uploadedAt: new Date('2026-01-01'),
  },
  {
    name: `${MONGO_ID}-bbb.jpeg`,
    label: 'banniere.jpeg',
    uploadedAt: new Date('2026-02-01'),
  },
  {
    name: `${MONGO_ID}-ccc.png`,
    label: 'icone.png',
    uploadedAt: null,
  },
  {
    name: `${MONGO_ID}-ddd.gif`,
    label: 'Animation.gif',
    uploadedAt: new Date('2026-03-01'),
  },
];

describe('filterGalleryFiles', () => {
  describe('sans paramètres', () => {
    it('retourne tous les fichiers', () => {
      const result = filterGalleryFiles(TEST_FILES, {});
      expect(result).toHaveLength(TEST_FILES.length);
    });

    it('galerie vide → tableau vide', () => {
      const result = filterGalleryFiles([], { search: 'test' });
      expect(result).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('filtre par label (insensible à la casse)', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        search: 'LOGO',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('logo.jpg');
    });

    it('filtre par correspondance partielle', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        search: 'ani',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Animation.gif');
    });

    it('retourne un tableau vide si aucun résultat', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        search: 'inexistant',
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('format', () => {
    it('filtre jpg en minuscules', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'jpg',
      });
      expect(result).toHaveLength(2); // .jpg + .jpeg
    });

    it('filtre jpg en majuscules (JPG)', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'JPG',
      });
      expect(result).toHaveLength(2);
    });

    it('jpeg est traité comme jpg', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'jpg',
      });
      const names = result.map((f) => f.name);
      expect(names).toContain(`${MONGO_ID}-aaa.jpg`);
      expect(names).toContain(`${MONGO_ID}-bbb.jpeg`);
    });

    it('filtre png (casse mixte: Png)', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'Png',
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toContain('.png');
    });

    it('filtre gif (GIF en majuscules)', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'GIF',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Animation.gif');
    });
  });

  describe('sortBy', () => {
    it('date_desc: plus récent en premier', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        sortBy: 'date_desc',
      });
      expect(result[0].label).toBe('Animation.gif'); // 2026-03-01
      expect(result[1].label).toBe('banniere.jpeg'); // 2026-02-01
      expect(result[2].label).toBe('logo.jpg'); // 2026-01-01
      expect(result[3].label).toBe('icone.png'); // null → epoch → le plus ancien
    });

    it('date_asc: plus ancien en premier (null = epoch)', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        sortBy: 'date_asc',
      });
      expect(result[0].label).toBe('icone.png'); // null → epoch → le plus ancien
      expect(result[3].label).toBe('Animation.gif'); // 2026-03-01
    });
  });

  describe('combinaisons', () => {
    it('search + format', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        search: 'ban',
        format: 'jpg',
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('banniere.jpeg');
    });

    it('format + sortBy', () => {
      const result = filterGalleryFiles(TEST_FILES, {
        format: 'jpg',
        sortBy: 'date_desc',
      });
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('banniere.jpeg'); // 2026-02-01
      expect(result[1].label).toBe('logo.jpg'); // 2026-01-01
    });
  });
});

// Cases the editor's search box brings in (US-06): the server never trimmed,
// and a query format was compared raw against an already-normalised extension.
describe('filterGalleryFiles — cas ajoutés par la recherche éditeur', () => {
  it('ignore les espaces autour de la recherche', () => {
    const result = filterGalleryFiles(TEST_FILES, { search: '  logo  ' });
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('logo.jpg');
  });

  it("une recherche uniquement composée d'espaces ne filtre rien", () => {
    expect(filterGalleryFiles(TEST_FILES, { search: '   ' })).toHaveLength(
      TEST_FILES.length
    );
  });

  it('accepte jpeg comme valeur de filtre, pas seulement comme extension', () => {
    const result = filterGalleryFiles(TEST_FILES, { format: 'jpeg' });
    expect(result.map((f) => f.label).sort()).toEqual([
      'banniere.jpeg',
      'logo.jpg',
    ]);
  });

  it('trouve un libellé accentué', () => {
    const result = filterGalleryFiles(
      [{ name: 'a-sep.gif', label: 'séparateur.gif' }],
      { search: 'séparateur' }
    );
    expect(result).toHaveLength(1);
  });

  it('retombe sur le nom de fichier quand le libellé manque', () => {
    const result = filterGalleryFiles([{ name: 'abc-promo.png' }], {
      search: 'promo',
    });
    expect(result).toHaveLength(1);
  });

  it('ne classe pas un fichier sans extension dans un format', () => {
    expect(
      filterGalleryFiles([{ name: 'sans-extension' }], { format: 'jpg' })
    ).toHaveLength(0);
  });

  // macOS writes file names decomposed: the label stored for "mon image çaé.png"
  // is c + U+0327, e + U+0301, while the search box emits the composed form.
  describe('normalisation Unicode', () => {
    const NFD = {
      name: 'abc-ca.png',
      label: 'mon image \u0063\u0327a\u0065\u0301.png',
    };
    const NFC = { name: 'abc-cb.png', label: 'dossier caf\u00e9.png' };

    it('trouve un libellé NFD avec une saisie NFC', () => {
      expect(filterGalleryFiles([NFD], { search: 'ça\u00e9' })).toHaveLength(1);
    });

    it('trouve un libellé NFC avec une saisie NFD', () => {
      expect(
        filterGalleryFiles([NFC], { search: 'caf\u0065\u0301' })
      ).toHaveLength(1);
    });

    it('la recherche est insensible aux accents', () => {
      expect(filterGalleryFiles([NFD], { search: 'cae' })).toHaveLength(1);
      expect(filterGalleryFiles([NFC], { search: 'cafe' })).toHaveLength(1);
    });

    it('accepte toujours la saisie accentuée', () => {
      expect(filterGalleryFiles([NFC], { search: 'café' })).toHaveLength(1);
    });

    it('reste insensible à la casse sur un caractère accentué', () => {
      expect(filterGalleryFiles([NFC], { search: 'CAFÉ' })).toHaveLength(1);
    });

    it('ne confond pas deux libellés distincts', () => {
      expect(filterGalleryFiles([NFD, NFC], { search: 'cafe' })).toHaveLength(
        1
      );
    });
  });

  it('ne modifie pas le tableau reçu', () => {
    const input = [...TEST_FILES];
    filterGalleryFiles(input, { sortBy: 'date_desc' });
    expect(input).toEqual(TEST_FILES);
  });

  it("préserve l'ordre reçu quand aucun tri n'est demandé", () => {
    const result = filterGalleryFiles(TEST_FILES, { search: '' });
    expect(result.map((f) => f.name)).toEqual(TEST_FILES.map((f) => f.name));
  });
});
