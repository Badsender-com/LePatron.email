'use strict';

const { databaseHost } = require('../../scripts/database-host');

describe('databaseHost', () => {
  it('keeps the host and port of a connection string', () => {
    expect(
      databaseHost('mongodb://user:secret@db.example.com:27017/app?ssl=true')
    ).toBe('db.example.com:27017');
  });

  it('keeps the host of an SRV connection string', () => {
    expect(
      databaseHost('mongodb+srv://user:secret@cluster.example.net/app')
    ).toBe('cluster.example.net');
  });

  it('keeps the host of a connection string without credentials', () => {
    expect(databaseHost('mongodb://localhost:27019/lepatron')).toBe(
      'localhost:27019'
    );
  });

  it('falls back to a placeholder when the string cannot be parsed', () => {
    expect(databaseHost(undefined)).toBe('mongo');
    expect(databaseHost('not a uri secret')).toBe('mongo');
    expect(
      databaseHost('mongodb://user:secret@h1:27017,h2:27017/app?replicaSet=rs')
    ).toBe('mongo');
  });
});
