'use strict';

// The export menu labels each image host with its integration's name, which a
// tech admin types. jQuery UI's button writes its label as HTML: the name must
// reach it escaped, or it runs in every editor of the company (ADR 0028).

const {
  imageHostMenuItems,
} = require('../../packages/editor/src/js/ext/image-host-menu.js');

describe('the image hosts of the export menu', () => {
  it('keeps the id and the name, and escapes the label', () => {
    expect(
      imageHostMenuItems([
        { id: 'a1', name: 'Emarsys <img src=x onerror=alert(1)> & "co"' },
      ])
    ).toEqual([
      {
        id: 'a1',
        name: 'Emarsys <img src=x onerror=alert(1)> & "co"',
        label:
          'Emarsys &lt;img src=x onerror=alert(1)&gt; &amp; &quot;co&quot;',
      },
    ]);
  });

  it("escapes a name's quotes", () => {
    expect(imageHostMenuItems([{ id: 'a1', name: "L'Oréal" }])[0].label).toBe(
      'L&#39;Oréal'
    );
  });

  it('is empty without image hosts', () => {
    expect(imageHostMenuItems(undefined)).toEqual([]);
  });
});
