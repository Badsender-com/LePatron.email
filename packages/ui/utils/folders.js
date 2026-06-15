import { FOLDER } from '../../server/constant/space-type';

// This function will save the path of each workspace / folder in the tree structure so we can use that in the breadcrumb component
export function getRecursivePath(childPath, parentPath) {
  if (parentPath?.pathChild) {
    return {
      ...parentPath,
      pathChild: getRecursivePath(childPath, parentPath.pathChild),
    };
  }
  return {
    ...parentPath,
    pathChild: childPath,
  };
}

// This function will map workspace data from the server and map it to the format handled by the treeview component
export function getRecursiveFolderMap(folder, hasAccess, parentPath) {
  return getFolders(folder, hasAccess, parentPath, getRecursiveFolderMap);
}

// This function will map workspace data from the server and map it to the format handled by the treeview component for one level sub folders
export function getFoldersMapWithoutSubFolder(folder, hasAccess, parentPath) {
  return getFolders(folder, hasAccess, parentPath, null);
}

export const getFolders = (folder, hasAccess, parentPath, callback) => {
  const path = getRecursivePath(
    {
      id: folder.id,
      name: folder.name,
      type: FOLDER,
    },
    parentPath
  );

  let mapFolderToTreeviewTypeData = {
    id: folder._id,
    name: folder.name,
    hasAccess,
    type: FOLDER,
    path,
  };

  if (folder.childFolders?.length > 0) {
    mapFolderToTreeviewTypeData = {
      ...mapFolderToTreeviewTypeData,
      ...(callback
        ? {
            children: folder.childFolders.map((child) =>
              callback(child, hasAccess, path)
            ),
          }
        : {}),
    };
  } else if (folder.hasChildren) {
    // Lazy-loading: an empty `children` array makes Vuetify render the expand
    // arrow and trigger `load-children` on first open. The actual children are
    // fetched on demand via GET /folders/:id/children.
    mapFolderToTreeviewTypeData = {
      ...mapFolderToTreeviewTypeData,
      children: [],
    };
  }
  return mapFolderToTreeviewTypeData;
};

// Maps a single lazy-loaded child folder (from GET /folders/:id/children) to
// the treeview node shape, building its breadcrumb path from the parent's.
export function mapChildFolderToTreeviewNode(folder, hasAccess, parentPath) {
  return getFolders(folder, hasAccess, parentPath, null);
}
