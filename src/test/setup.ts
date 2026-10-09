import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => cleanup());

// jsdom does not implement scrolling; the router calls it on navigation.
window.scrollTo = () => {};

// jsdom has no layout engine and therefore no ResizeObserver; every browser does.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom does not implement scrolling.
Element.prototype.scrollIntoView ??= () => {};
