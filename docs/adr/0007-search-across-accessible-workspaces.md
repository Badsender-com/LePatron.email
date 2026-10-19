# Searching every accessible workspace: a read-only listing, its rights applied by the database on an explicit list of locations

- Status: proposed
- Date: 2026-10-19
- Epic: #1144

The email search gets a second search scope, "All my workspaces", next to the current folder. It looks through every email of the user's accessible workspaces, in any folder or subfolder, within their group (the selected group for a super admin). It has its own route and service (`GET /api/mailings/search`, `searchMailings`), apart from the folder listing, which keeps its contract of exactly one location and does not change.

The rights are applied by the database, before pagination. The server first lists the accessible workspaces of the group by the listing's own rule (`canReadWorkspace`), then their folders and subfolders, and asks for the group's emails whose location is in that list. There is no shortcut for the users who read the whole group (company admins, groups that open every workspace to their users): they go through the same list, so a single rule decides what can come back, and an email whose location is gone never does.

A result is read, not acted on. Each row carries its location and whether the user may open it in the editor, by the rule the folder listing applies to its location; the rest (copying, moving, deleting, selecting several) is done from the location, one click away. Pages hold at most 100 emails and "All" is not offered in this scope. Searching is a read: every role may do it, within its accessible workspaces, and it declares no capability (ADR 0004).

## Considered Options

- **A `scope=all` parameter on `GET /api/mailings`**: rejected. Every check of that route assumes one location; a third case in its validation, its access check and its query is one more place where a mistake returns another workspace's emails.
- **Querying the whole group for the users who read all of it**: rejected. It is not faster (the cost is the match on the name, the same either way), it adds a second path whose condition can be wrong, and it returns the emails a failed workspace deletion left behind.
- **Fetching the group's emails and filtering them in the server**: rejected. Memory grows with the group, not with the page, and the pagination counts emails the user cannot see.
- **A minimum search length (three characters), as first suggested**: not taken. Without a text, the scope lists the most recently updated emails, a query the indexes serve and the page bounds; the name is matched from the first character, after the listing's debounce, as in the current folder.
- **Actions on the results, with rights computed row by row**: rejected. Each action's rule is written for the current location; finding the email is the need, and the location gives back every action.

## Consequences

- The name is still matched by an unanchored, case-insensitive pattern, which no index serves: the cost grows with the number of emails in the accessible workspaces. It is measured on a local database before release; a text index is a separate change.
- The folder listing still shows only the emails directly in its location; this scope does not change it.
- A location is read from the folder's parent before its workspace: a subfolder from older data may still carry a workspace, and a moved email keeps `null` in the field it left.
