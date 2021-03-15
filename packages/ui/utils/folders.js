import { FOLDER } from '../../server/constant/space-type';

export function recursivePath(childPath, parentPath) {
  if (parentPath?.pathChild) {
    return {
      ...parentPath,
      pathChild: recursivePath(childPath, parentPath.pathChild),
    };
  } else {
    return {
      ...parentPath,
      pathChild: childPath,
    };
  }
}

export function recursiveFolderMap(folder, isAllowed, parentPath) {
  const path = recursivePath(
    {
      id: folder.id,
      name: folder.name,
      type: FOLDER,
    },
    parentPath
  );

  let formattedData = {
    id: folder._id,
    name: folder.name,
    isAllowed,
    type: FOLDER,
    path,
  };

  if (folder.childFolders?.length > 0) {
    formattedData = {
      ...formattedData,
      children: folder.childFolders.map((child) =>
        this.recursiveFolderMap(child, isAllowed, path)
      ),
    };
  }
  return formattedData;
}
