/**
 * Duplicate + translate puts the copy back next to its source when no
 * destination is chosen: the server accepts that only where the user writes.
 * Where it only reads the source, a destination it writes to is required.
 *
 * @param {Object} params
 * @param {boolean} params.canWriteSource whether the user writes where the
 *   source lies
 * @param {Object|null} params.selectedLocation the destination chosen
 * @returns {boolean}
 */
export function isDestinationMissing({ canWriteSource, selectedLocation }) {
  return !canWriteSource && !selectedLocation;
}
