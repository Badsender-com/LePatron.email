import { WORKSPACE } from '../../server/constant/space-type';
import {
  getRecursiveFolderMap,
  getFoldersMapWithoutSubFolder,
} from '~/utils/folders';

export function getTreeviewWorkspaces(workspaces) {
  return getTreeview(workspaces, getRecursiveFolderMap);
}

export function getTreeviewWorkspacesWithoutSubfolders(workspaces) {
  return getTreeview(workspaces, getFoldersMapWithoutSubFolder);
}

export function getTreeview(workspaces, callback) {
  return workspaces.map((workspace) => {
    const path = {
      name: workspace.name,
      id: workspace._id,
      type: WORKSPACE,
    };

    let mapWorkspaceToTreeviewTypeData = {
      icon: 'mdi-account-multiple-outline',
      id: workspace._id,
      name: workspace.name,
      hasAccess: workspace.hasRights,
      type: WORKSPACE,
      path,
    };

    if (workspace.folders?.length > 0) {
      mapWorkspaceToTreeviewTypeData = {
        children: workspace.folders.map((folder) =>
          callback(folder, workspace.hasRights, path)
        ),
        ...mapWorkspaceToTreeviewTypeData,
      };
    }
    return mapWorkspaceToTreeviewTypeData;
  });
}
// Flatten the path from the current location element, this is required to match the data expected by the breadcrumbs component
export function getPathToBreadcrumbsDataType(selectedMenuLocation) {
  let items = [];
  if (selectedMenuLocation?.path) {
    items[0] = {
      text: selectedMenuLocation?.path?.name,
      id: selectedMenuLocation?.path?.id,
      type: selectedMenuLocation?.path?.type,
      disabled: !selectedMenuLocation?.path?.pathChild,
    };
    items = getRecursivePathChild(items, selectedMenuLocation?.path);
  }
  return items;
}

// Part of the above function, we will extract nested child to an array
function getRecursivePathChild(array, path) {
  if (path?.pathChild && Array.isArray(array)) {
    array.push({
      text: path?.pathChild?.name,
      id: path?.pathChild?.id,
      type: path?.pathChild?.type,
      disabled: !path?.pathChild?.pathChild,
    });
    return getRecursivePathChild(array, path?.pathChild);
  }
  return array;
}

// This method will allow us to find the current location from the collections of workspaces.
export function findNestedLocation(collection, key, value) {
  for (const location of collection) {
    for (const [locationKey, locationValue] of Object.entries(location)) {
      if (locationKey === key && locationValue === value) {
        return location;
      }
      if (Array.isArray(locationValue)) {
        const foundLocation = findNestedLocation(locationValue, key, value);
        if (foundLocation) {
          return foundLocation;
        }
      }
    }
  }
}
