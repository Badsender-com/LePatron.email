// convert a fibonacci suite to em
const materialColorScheme = require('./material-color-schema');

var defaultFibonacciSpacing = [0, 1, 2, 3, 5, 8, 13]
  .map(function (e) {
    return Math.round(e * 0.1 * 100) / 100;
  })
  .map(function (i) {
    return i + '=' + i + 'em';
  })
  .join(' ');

// Util function copied from Tiny MCE
function each(o, cb, s) {
  var n, l;

  if (!o) {
    return 0;
  }

  s = s || o;

  if (o.length !== undefined) {
    // Indexed arrays, needed for Safari
    for (n = 0, l = o.length; n < l; n++) {
      if (cb.call(s, o[n], n, o) === false) {
        return 0;
      }
    }
  } else {
    // Hashtables
    for (n in o) {
      if (o.hasOwnProperty(n)) {
        if (cb.call(s, o[n], n, o) === false) {
          return 0;
        }
      }
    }
  }

  return 1;
}

function getColorsSet(colors) {
  return [
    colors?.length
      ? {
          name: 'Group Scheme',
          colors,
        }
      : {
          name: 'Material',
          colors: materialColorScheme.map((color) => `#${color}`),
        },
  ];
}

function formattedColorSchema(colors) {
  return colors.reduce((acc, color) => [...acc, color, `#${color}`], []);
}

function formattedGroupColorSchema(colors) {
  return colors.reduce((acc, color) => [...acc, color.substring(1), color], []);
}

module.exports = {
  defaultFibonacciSpacing,
  each,
  formattedColorSchema,
  formattedGroupColorSchema,
  getColorsSet,
};
