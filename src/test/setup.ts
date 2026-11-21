import "@testing-library/jest-dom/vitest";

const entries = new Map<string, string>();
Object.defineProperties(Storage.prototype, {
  length: { configurable: true, get: () => entries.size },
  clear: { configurable: true, value: () => entries.clear() },
  getItem: { configurable: true, value: (key: string) => entries.get(String(key)) ?? null },
  key: { configurable: true, value: (index: number) => [...entries.keys()][index] ?? null },
  removeItem: { configurable: true, value: (key: string) => entries.delete(String(key)) },
  setItem: {
    configurable: true,
    value: (key: string, value: string) => entries.set(String(key), String(value)),
  },
});
const localStorageForTests = Object.create(Storage.prototype) as Storage;
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorageForTests,
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
