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
