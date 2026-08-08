'use strict';

const {
  findNodeById,
  findNodesByIds,
  findPathToNode,
} = require('../../../packages/ui/utils/tree');

// w1 ── f1 ── sf1
//   └─ f2
// w2
const TREE = [
  {
    id: 'w1',
    type: 'workspace',
    children: [
      {
        id: 'f1',
        type: 'folder',
        children: [{ id: 'sf1', type: 'folder' }],
      },
      { id: 'f2', type: 'folder' },
    ],
  },
  { id: 'w2', type: 'workspace' },
];

describe('tree helpers', () => {
  describe('findNodeById', () => {
    it('finds a top-level node', () => {
      expect(findNodeById('w1', TREE).id).toBe('w1');
    });
    it('finds a deeply nested node', () => {
      expect(findNodeById('sf1', TREE).id).toBe('sf1');
    });
    it('returns null when not found / bad input', () => {
      expect(findNodeById('nope', TREE)).toBeNull();
      expect(findNodeById('w1', [])).toBeNull();
      expect(findNodeById(null, TREE)).toBeNull();
    });
  });

  describe('findNodesByIds', () => {
    it('collects every matching node across depths', () => {
      const found = findNodesByIds(['w1', 'sf1', 'f2'], TREE).map((n) => n.id);
      expect(found).toEqual(expect.arrayContaining(['w1', 'sf1', 'f2']));
      expect(found).toHaveLength(3);
    });
    it('returns [] for empty inputs', () => {
      expect(findNodesByIds([], TREE)).toEqual([]);
      expect(findNodesByIds(['w1'], [])).toEqual([]);
    });
  });

  describe('findPathToNode', () => {
    it('returns [] for a top-level node (no ancestors to open)', () => {
      expect(findPathToNode('w1', TREE)).toEqual([]);
    });
    it('returns the full ancestor branch for a nested node', () => {
      const path = findPathToNode('sf1', TREE).map((n) => n.id);
      expect(path).toEqual(['w1', 'f1']);
    });
    it('returns the single parent for a direct child', () => {
      const path = findPathToNode('f2', TREE).map((n) => n.id);
      expect(path).toEqual(['w1']);
    });
    it('returns null when the node is absent', () => {
      expect(findPathToNode('ghost', TREE)).toBeNull();
    });
  });
});
