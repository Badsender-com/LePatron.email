'use strict';

module.exports = {
  trimString,
  normalizeString,
  isFromGroup,
  addGroupFilter,
  addStrictGroupFilter,
};

// normalize string to have a better ordering
function normalizeString(string) {
  string = String(string);
  return trimString(string).toLowerCase();
}

function trimString(string) {
  string = String(string);
  return string.trim();
}

// TODO: check where it's used
function isFromGroup(user, groupId) {
  if (!user) return false;
  if (user.isAdmin) return true;
  // creations from admin doesn't gave a groupId
  if (!groupId) return false;
  return String(user._company) === String(groupId);
}

// users can access only same group content
// admin everything
function addGroupFilter(user, filter) {
  if (user.isAdmin) return filter;
  filter._company = user.group.id;
  return filter;
}

// Strict difference from above:
// Admin can't get content with a group
function addStrictGroupFilter(user, filter) {
  const group = user.isAdmin ? { $exists: false } : user.group.id;
  filter._company = group;
  return filter;
}
