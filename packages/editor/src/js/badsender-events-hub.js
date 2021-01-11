'use strict'

const WINDOW_CLICK = `WINDOW_CLICK`

// https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
class EventsHub extends EventTarget {
  windowClick(event) {
    this.dispatchEvent(new CustomEvent(WINDOW_CLICK, { detail: event }))
  }
}
const eventsHub = new EventsHub()

// This will be called on the star of Knockout application
// • so we are sure we have a body
// Many events in knockout have a cancelBubble attribute
// • it's still an unreliable way of getting a global click…
// `eventsHub` is exposed in the viewModel
// • we should try to call it whenever we have a `cancelBubble`
//   (ex: main.tmpl.html #main-edit-area)
function initEventHub() {
  document.body.addEventListener(
    `click`,
    event => eventsHub.windowClick(event),
    {
      passive: true,
    }
  )
}

function exposeToKnockout(vm) {
  vm.bsEventsHub = eventsHub
}

module.exports = {
  eventsHub,
  WINDOW_CLICK,
  initEventHub,
  exposeToKnockout,
}
