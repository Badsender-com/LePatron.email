'use strict';

// jsdom has no IntersectionObserver. vue-virtual-scroller's RecycleScroller
// watches its own visibility with one (vue-observe-visibility) and, without
// it, warns once per mounted panel: dozens of lines that bury a real
// `[Vue warn]` in the output. This observer never reports anything, which is
// what jsdom's zero-size layout would report anyway: the scroller keeps
// rendering from its buffer, as it did without the stub.
class IntersectionObserverStub {
  observe() {}

  unobserve() {}

  disconnect() {}

  takeRecords() {
    return [];
  }
}

if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  window.IntersectionObserver = IntersectionObserverStub;
}
