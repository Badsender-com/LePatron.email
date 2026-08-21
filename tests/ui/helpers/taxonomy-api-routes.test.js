'use strict';

// The taxonomy screens read through the per-company route, never the ambient one:
// a super admin browses a company other than their own, so the company must be in
// the URL rather than inferred from the session. These helpers are the only place
// that decision is expressed, and a wrong URL fails as an empty table rather than
// an error.

import {
  taxonomyItems,
  taxonomyItemsCreate,
  taxonomyItemsItem,
} from '../../../packages/ui/helpers/api-routes.js';

const GROUP_ID = '507f1f77bcf86cd799439a01';
const ITEM_ID = '507f1f77bcf86cd799439101';

describe('taxonomyItems', () => {
  it('targets the company named in the URL', () => {
    expect(taxonomyItems(GROUP_ID)).toContain(
      `/taxonomy-items/groups/${GROUP_ID}`
    );
  });

  it('defaults to the emailType taxonomy', () => {
    expect(taxonomyItems(GROUP_ID)).toContain('type=emailType');
  });

  it('carries an explicit taxonomy type', () => {
    expect(taxonomyItems(GROUP_ID, { type: 'language' })).toContain(
      'type=language'
    );
  });

  it('omits activeOnly by default, so the admin table shows deactivated items', () => {
    expect(taxonomyItems(GROUP_ID)).not.toContain('activeOnly');
  });

  it('asks for active items only when requested', () => {
    expect(taxonomyItems(GROUP_ID, { activeOnly: true })).toContain(
      'activeOnly=true'
    );
  });

  it('escapes the query values instead of concatenating them raw', () => {
    expect(taxonomyItems(GROUP_ID, { type: 'a b&c=d' })).toContain(
      'type=a+b%26c%3Dd'
    );
  });
});

describe('taxonomyItemsCreate / taxonomyItemsItem', () => {
  it('posts to the collection, the company travelling in the body', () => {
    expect(taxonomyItemsCreate()).toBe('/taxonomy-items');
  });

  it('addresses a single item by id', () => {
    expect(taxonomyItemsItem(ITEM_ID)).toBe(`/taxonomy-items/${ITEM_ID}`);
  });
});
