const INTERGER_REGEX = /^\d+$/;

function ensureInteger(object = {}) {
  Object.entries(object).forEach(([key, value]) => {
    const isString = typeof value === `string`;
    const canBeInteger = isString && INTERGER_REGEX.test(value);
    if (canBeInteger) return (object[key] = parseInt(value, 10));
    const isObject = value && typeof value === `object`;
    if (isObject) return (object[key] = ensureInteger(value));
  });
  return object;
}

module.exports = {
  ensureInteger,
};
