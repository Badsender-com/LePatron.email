'use strict';

/**
 * Manual jest mock for models.common.js, used by bare `jest.mock(...)` calls
 * (no factory — currently tests/server/comment/comment.test.js).
 *
 * Why it exists: jest's AUTOMOCK deep-traverses every export. Compiled
 * mongoose subdocument prototypes expose path getters (e.g. the `model` path
 * of AISkillInvocation.resolvedConfig) that throw when read without a
 * document instance — automocking the real module crashes with
 * "Cannot read properties of undefined (reading 'Symbol(mongoose#Document#scope)')".
 * A manual mock short-circuits the traversal entirely.
 *
 * Tests that pass an explicit factory to jest.mock() are unaffected. Add the
 * methods you need when a new bare-automock consumer appears.
 */

module.exports = {
  Comments: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countUnresolvedByMailing: jest.fn(),
    deleteWithReplies: jest.fn(),
    getBlockCommentCounts: jest.fn(),
  },
  Mailings: {
    findById: jest.fn(),
  },
  Users: {
    find: jest.fn(),
  },
};
