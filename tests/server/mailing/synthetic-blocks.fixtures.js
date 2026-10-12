'use strict';

// Synthetic blocks and the content models holding them, as the guard tests,
// the save tests and the personalized-block tests build them.

const htmlBlock = (htmlCode) => ({ type: 'htmlCodeBlock', htmlCode });

// A composed block. Its markup comes first: most tests are about the markup,
// and leave the state out.
const builderBlock = (builderHtml, builderState) => ({
  type: 'blockBuilderBlock',
  builderHtml,
  builderState,
});

const dataWith = (...blocks) => ({ mainBlocks: { blocks } });

const longerThan = (limit) => 'x'.repeat(limit + 1);

module.exports = { htmlBlock, builderBlock, dataWith, longerThan };
