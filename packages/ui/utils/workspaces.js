import { WORKSPACE } from '../../server/constant/space-type';
import { getRecursiveFolderMap } from '~/utils/folders';

export function getTreeviewWorkspaces(workspaces) {
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
          getRecursiveFolderMap(folder, workspace.hasRights, path)
        ),
        ...mapWorkspaceToTreeviewTypeData,
      };
    }
    return mapWorkspaceToTreeviewTypeData;
  });
}

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
