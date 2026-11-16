'use strict';

const { databaseHost } = require('../../scripts/database-host');

// The connection string carries the database password: what the scripts print
// about it comes from here.
describe('databaseHost', () => {
  it('keeps the host, port and database name of a connection string', () => {
    expect(
      databaseHost('mongodb://user:secret@db.example.com:27017/app?ssl=true')
    ).toBe('db.example.com:27017/app');
  });

  it('keeps every host of a replica set', () => {
    expect(
      databaseHost('mongodb://user:secret@h1:27017,h2:27017/app?replicaSet=rs')
    ).toBe('h1:27017,h2:27017/app');
  });

  it('keeps the host of an SRV connection string', () => {
    expect(
      databaseHost('mongodb+srv://user:secret@cluster0.abcd.mongodb.net/app')
    ).toBe('cluster0.abcd.mongodb.net/app');
  });

  it('reads a connection string without credentials', () => {
    expect(databaseHost('mongodb://localhost:27017/lepatron')).toBe(
      'localhost:27017/lepatron'
    );
  });

  it('keeps the hosts alone when the string names no database', () => {
    expect(databaseHost('mongodb://user:secret@db.example.com:27017')).toBe(
      'db.example.com:27017'
    );
    expect(databaseHost('mongodb://h1,h2/?replicaSet=rs')).toBe('h1,h2');
  });

  it('falls back when the string is not a connection string', () => {
    expect(databaseHost(undefined)).toBe('mongo');
    expect(databaseHost('not a uri secret')).toBe('mongo');
    expect(databaseHost('postgres://user:secret@host/app')).toBe('mongo');
    expect(databaseHost('mongodb://host:27017/not a name')).toBe('mongo');
  });

  // A password with an unencoded character shifts the parts of the URI: the
  // fallback, rather than a fragment of the credentials taken for a host.
  describe.each([
    ['an unencoded slash in the password', 'mongodb://u:12/34@host/db', '12'],
    ['an unencoded @ in the password', 'mongodb://u:p@ss@host/db', 'ss'],
    [
      'an unencoded question mark in the password',
      'mongodb://u:12?34@host/db',
      '12',
    ],
    ['a socket path', 'mongodb://u:p@/tmp%2Fm.sock/db', 'u:p'],
  ])('with %s', (_case, uri, fragment) => {
    it('falls back without any part of the credentials', () => {
      const printed = databaseHost(uri);

      expect(printed).toBe('mongo');
      expect(printed).not.toContain(fragment);
      expect(printed).not.toContain('u:');
      expect(printed).not.toContain('@');
    });
  });
});
