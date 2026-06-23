// Pure helpers for navigating the workspace/folder treeview node structure.
// Nodes have the shape { id, type, children?: [...] }. Kept framework-free so
// they can be unit-tested without mounting the Vue component.

// Depth-first search for a node by id. Returns the node or null.
export function findNodeById(id, items) {
  if (!items || items.length === 0 || !id) {
    return null;
  }
  for (const node of items) {
    if (node.id === id) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findNodeById(id, node.children);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

// Collect every node whose id is in `ids` (order follows the tree traversal).
export function findNodesByIds(ids, items) {
  const result = [];
  if (!items || items.length === 0 || !ids || ids.length === 0) {
    return result;
  }
  const walk = (nodes) => {
    nodes.forEach((node) => {
      if (ids.includes(node.id)) {
        result.push(node);
      }
      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    });
  };
  walk(items);
  return result;
}

// Returns the list of ancestor nodes leading to (and excluding) the node with
// the given id — i.e. the branch that must be open for that node to be visible.
// Returns null when the id is not found, [] when the node is a top-level node.
// Note: only resolves ancestors already present in the in-memory tree. With
// lazy-loading, a deep node's branch must first be loaded (see loadActiveBranch
// in the sidebar tree, which fetches the parent's children via
// FETCH_FOLDER_CHILDREN) before ensureCurrentPathOpen can resolve it here.
export function findPathToNode(id, items, ancestors = []) {
  if (!items || items.length === 0 || !id) {
    return null;
  }
  for (const node of items) {
    if (node.id === id) {
      return ancestors;
    }
    if (node.children && node.children.length > 0) {
      const found = findPathToNode(id, node.children, [...ancestors, node]);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
