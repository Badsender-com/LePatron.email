/**
 * @jest-environment jsdom
 */

'use strict';

// The bundle aliases this name to ko-reactor (package.json aliasify), which
// registers `ko.watch` instead of exporting it, as head-css-undo.test.js says.
jest.mock(
  'knockoutjs-reactor',
  () => {
    require('ko-reactor/dist/ko-reactor.js');
    return {};
  },
  { virtual: true }
);

const ko = require('knockout');
const {
  watchContent,
} = require('../../../packages/editor/src/js/ext/quality/content-watch.js');

function makeEditor() {
  const title = ko.observable('Hello');
  const blocks = ko.observableArray([ko.observable({ id: 'b1', text: title })]);
  return {
    viewModel: {
      content: ko.observable({ mainBlocks: ko.observable({ blocks }) }),
      headCss: ko.observable(''),
    },
    title,
    blocks,
  };
}

describe('watchContent', () => {
  it('fires on an edit anywhere in the content, and on the head CSS', () => {
    const { viewModel, title, blocks } = makeEditor();
    const onChange = jest.fn();
    watchContent(viewModel, ko, onChange);

    title('Hello there');
    expect(onChange).toHaveBeenCalledTimes(1);
    blocks.push(ko.observable({ id: 'b2' }));
    expect(onChange).toHaveBeenCalledTimes(2);
    viewModel.headCss('.x{}');
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('stops once disposed', () => {
    const { viewModel, title } = makeEditor();
    const onChange = jest.fn();
    const stop = watchContent(viewModel, ko, onChange);

    stop();
    title('Changed');
    viewModel.headCss('.y{}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is harmless on a view model without content', () => {
    const onChange = jest.fn();
    expect(() => watchContent({}, ko, onChange)()).not.toThrow();
  });
});
