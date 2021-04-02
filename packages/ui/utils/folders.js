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
      children: folder.childFolders.map((child) =>
        getRecursiveFolderMap(child, hasAccess, path)
      ),
    };
  }
  return mapFolderToTreeviewTypeData;
}

// This function will map workspace data from the server and map it to the format handled by the treeview component
export function getFolderMap(folder, hasAccess, parentPath) {
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
    };
  }
  return mapFolderToTreeviewTypeData;
}
