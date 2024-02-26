'use strict';

// This deals with Cheerio/jQuery issues.
// Most of this could be done without jQuery, too, but jQuery is easier to be mocked with Cheerio
// Otherwise we would need jsDom to run the compiler in the server (without a real browser)

var $ = require('jquery');

function _extend(target, source) {
  if (source) {
    for (var prop in source) {
      if (source.hasOwnProperty(prop)) {
        target[prop] = source[prop];
      }
    }
  }
  return target;
}

var objExtend = function (obj, extender) {
  if (typeof $.extend == 'function') {
    return $.extend(true, obj, extender);
  } else {
    return _extend(obj, JSON.parse(JSON.stringify(extender)));
  }
};

var getAttribute = function (element, attribute) {
  var res = $(element).attr(attribute);
  if (typeof res == 'undefined') res = null;
  return res;
  // return element.getAttribute(attribute);
};

var setAttribute = function (element, attribute, value) {
  $(element).attr(attribute, value);
  // element.setAttribute(attribute, value);
};

var removeAttribute = function (element, attribute) {
  $(element).removeAttr(attribute);
  // element.removeAttribute(attribute);
};

var getInnerText = function (element) {
  return $(element).text();
  // if (typeof element.innerText != 'undefined') return element.innerText;
  // else return element.textContent;
};

var getInnerHtml = function (element) {
  return $(element).html();
  // return element.innerHTML;
};

var getLowerTagName = function (element) {
  // sometimes cheerio doesn't have tagName but "name".
  // Browsers have "name" with empty string
  // Sometimes cheerio has tagName but no prop function.
  if (element.tagName === '' && typeof element.name == 'string')
    return element.name.toLowerCase();
  if (element.tagName !== '') return element.tagName.toLowerCase();
  return $(element).prop('tagName').toLowerCase();
  // return element.tagName.toLowerCase();
};

var setContent = function (element, content) {
  $(element).html(content);
  // element.innerHTML = content;
};

var replaceHtml = function (element, html) {
  $(element).replaceWith(html);
  // element.outerHTML = html;
};

var removeElements = function ($elements, tryDetach) {
  if (tryDetach && typeof $elements.detach !== 'undefined') $elements.detach();
  // NOTE: we don't need an else, as detach is simply an optimization
  $elements.remove();
};

// https://dev.to/qausim/convert-html-inline-styles-to-a-style-object-for-react-components-2cbi
var formatStringToCamelCase = function(str) {
  const splitted = str.split("-");
  if (splitted.length === 1) return splitted[0];
  return (
    splitted[0] +
    splitted
      .slice(1)
      .map(word => word[0].toUpperCase() + word.slice(1))
      .join("")
  );
};

var getStyleObjectFromString = function(str) {
  const style = {};
  console.log({ str });
  str.split(";").forEach(el => {
    const [property, value] = el.split(":");

    const includedProperties = ["margin"];

    if (
      !property ||
      !property.trim() ||
      typeof property === "undefined" ||
      !value ||
      !value.trim ||
      typeof value === "undefined"||
      !includedProperties.includes(property)
    ) return;
    const formattedProperty = formatStringToCamelCase(property.trim());
    style[formattedProperty] = value.trim();
  });

  return style;
};



var concatObjectProperties = function(str) {
  const resultValue = Object.entries(str).reduce((accumulator, value ) => {
    const valueBasedOnType  = isNaN(value[1]) ?  `'${value[1]}'`: value[1];
    return `${accumulator }, ${value[0]} : ${valueBasedOnType}`
  }, "");
  return resultValue;
}

module.exports = {
  getAttribute: getAttribute,
  setAttribute: setAttribute,
  concatObjectProperties,
  removeAttribute: removeAttribute,
  getStyleObjectFromString: getStyleObjectFromString,
  getInnerText: getInnerText,
  getInnerHtml: getInnerHtml,
  getLowerTagName: getLowerTagName,
  setContent: setContent,
  replaceHtml: replaceHtml,
  removeElements: removeElements,
  objExtend: objExtend,
};
