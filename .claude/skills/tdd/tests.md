# Good and Bad Tests

## Good Tests

**Integration-style**: Test through real interfaces, not mocks of internal parts.

```javascript
// GOOD: Tests observable behavior through the route
// (makeApp mounts the real router behind a stub that sets req.user,
// as in tests/server/ai-skill/routes/ai-skill.routes.test.js)
it('rejects non-admin users with 401', async () => {
  const res = await request(makeApp({ asAdmin: false })).get('/api/ai-skills');

  expect(res.status).toBe(401);
});
```

Characteristics:

- Tests behavior users/callers care about
- Uses public API only
- Survives internal refactors
- Describes WHAT, not HOW
- One logical assertion per test

## Bad Tests

**Implementation-detail tests**: Coupled to internal structure.

```javascript
// BAD: Tests implementation details
it('deleteFolder calls Folders.findOne with the group', async () => {
  await folderService.deleteFolder(folderId, user);
  expect(Folders.findOne).toHaveBeenCalledWith({
    _id: folderId,
    _company: groupId,
  });
});
```

Red flags:

- Mocking internal collaborators (your own services, helpers)
- Testing private functions
- Asserting on call counts/order
- Test breaks when refactoring without behavior change
- Test name describes HOW not WHAT
- Verifying through external means instead of the interface

```javascript
// BAD: Bypasses the interface to verify
it('createMailing saves to the database', async () => {
  await mailingService.createMailing({ name: 'Newsletter' }, user);
  expect(Mailings.prototype.save).toHaveBeenCalled();
});

// GOOD: Verifies through the interface
it('a created mailing can be read back', async () => {
  const created = await mailingService.createMailing(
    { name: 'Newsletter' },
    user
  );
  const found = await mailingService.findOne(created.id, user);
  expect(found.name).toBe('Newsletter');
});
```

**Tautological tests**: Expected value restates the implementation, so the test passes by construction.

```javascript
// BAD: Expected value is recomputed the way the code computes it
it('counts the translatable blocks', () => {
  const blocks = [{ text: 'a' }, { text: '' }, { text: 'b' }];
  const expected = blocks.filter((b) => b.text).length;
  expect(countTranslatable(blocks)).toBe(expected);
});

// GOOD: Expected value is an independent, known literal
it('counts the translatable blocks', () => {
  expect(countTranslatable([{ text: 'a' }, { text: '' }, { text: 'b' }])).toBe(
    2
  );
});
```
