'use strict';

const { parseState } = require('./state.js');
const { collectCssFor } = require('./stylesheet.js');

// The stylesheet a set of composed blocks needs, from what is stored on them.
//
// One module because both ends of the chain need the same answer and must not
// reach it two ways: the editor walks a Knockout content model, the server
// walks a plain one, and the only thing they share is a list of stored
// compositions. They each collect that list their own way and come here for
// the rest — so a change to what a column emits lands once.
//
// Nothing here is stored. The stylesheet is derived from the composition every
// time, which is why a block saved to the library and reinserted somewhere
// else keeps stacking with nothing extra carried along.

/**
 * @param {Array<string>} serialisedStates the `builderState` of each composed
 *   block, exactly as stored
 * @returns {string} the rules those blocks need, or an empty string
 */
function stylesheetForComposedBlocks(serialisedStates) {
  const compositions = (serialisedStates || [])
    .map(parseState)
    // A composition this version cannot read contributes nothing rather than
    // breaking the export of the whole mailing. The block itself is refused
    // elsewhere, loudly; an export is not the place to find out.
    .filter(Boolean);

  return collectCssFor(compositions);
}

module.exports = { stylesheetForComposedBlocks };
