import { locationPath, locationRoute } from '~/utils/mailing-location.js';

// Each result of the search across workspaces shows where its email is and
// links to that listing (epic #1144, ADR 0007).

const workspace = { id: 'w1', name: 'Newsletters' };
const folder = { id: 'f1', name: '2026' };
const subfolder = { id: 's1', name: 'Spring' };

describe('the location of a search result', () => {
  it.each([
    [{ workspace }, 'Newsletters'],
    [{ workspace, folder }, 'Newsletters › 2026'],
    [{ workspace, folder, subfolder }, 'Newsletters › 2026 › Spring'],
  ])('reads %o from the workspace down', (location, path) => {
    expect(locationPath(location)).toBe(path);
  });

  it.each([
    [{ workspace }, { wid: 'w1' }],
    [{ workspace, folder }, { fid: 'f1' }],
    [{ workspace, folder, subfolder }, { fid: 's1' }],
  ])(
    'links %o to its listing, in the current folder scope',
    (location, query) => {
      expect(locationRoute(location)).toEqual({ path: '/mailings', query });
    }
  );
});
