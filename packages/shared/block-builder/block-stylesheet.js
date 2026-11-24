'use strict';

const { parseState } = require('./state.js');
const { classesOf, cssForClasses } = require('./stylesheet.js');

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

// What each stored state asks for, remembered by the state itself. The
// canvas re-derives the stylesheet on every change to the mailing — a block
// moved, a text typed — and reading every composed block again each time is
// what that cost. A stored state never changes in place: an edit stores a new
// string, so the string is the whole key and there is nothing to invalidate.
//
// Bounded, because a session edits blocks and leaves states behind. Sixty-four
// is more composed blocks than a mailing holds, with room for the states an
// edit has just replaced; past it, the state used least recently goes.
const CACHE_LIMIT = 64;
const classesByState = new Map();

/**
 * The classes one stored state asks for, read with parseState the first time
 * only.
 *
 * @param {string} serialisedState
 * @returns {ReadonlyArray<string>}
 */
function classesOfState(serialisedState) {
  // Only a string is a stored state, and only a string makes a key that says
  // what it holds: anything else asks for nothing, and is not remembered.
  if (typeof serialisedState !== 'string') return [];

  if (classesByState.has(serialisedState)) {
    const known = classesByState.get(serialisedState);
    // Read again: moved to the end, so it is the last to go.
    classesByState.delete(serialisedState);
    classesByState.set(serialisedState, known);
    return known;
  }

  const composition = parseState(serialisedState);
  // A composition this version cannot read contributes nothing rather than
  // breaking the export of the whole mailing. The block itself is refused
  // elsewhere, loudly; an export is not the place to find out.
  const classes = Object.freeze(composition ? classesOf(composition) : []);

  if (classesByState.size >= CACHE_LIMIT) {
    classesByState.delete(classesByState.keys().next().value);
  }
  classesByState.set(serialisedState, classes);
  return classes;
}

/**
 * @param {Array<string>} serialisedStates the `builderState` of each composed
 *   block, exactly as stored
 * @returns {string} the rules those blocks need, or an empty string
 */
function stylesheetForComposedBlocks(serialisedStates) {
  return cssForClasses(
    (serialisedStates || []).reduce(
      (names, state) => names.concat(classesOfState(state)),
      []
    )
  );
}

module.exports = { stylesheetForComposedBlocks, CACHE_LIMIT };
