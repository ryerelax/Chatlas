import assert from "node:assert/strict";
import test from "node:test";

test("Google Maps loader retries with a new script after the first script fails", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const scripts = [];
  let removedScripts = 0;

  globalThis.window = {};
  globalThis.document = {
    createElement() {
      return {
        remove() {
          removedScripts += 1;
        },
      };
    },
    head: {
      appendChild(script) {
        scripts.push(script);
      },
    },
  };

  try {
    const { loadGoogleMaps } = await import(
      `../src/presentation/lib/googleMapsLoader.js?retry=${Date.now()}`
    );
    const firstAttempt = loadGoogleMaps("test-key");

    assert.equal(scripts.length, 1);
    scripts[0].onerror();
    await assert.rejects(firstAttempt, /Google Maps script failed to load/);
    assert.equal(removedScripts, 1);
    assert.equal(window.__chatlasGoogleMapsReady__, undefined);

    const secondAttempt = loadGoogleMaps("test-key");

    assert.equal(scripts.length, 2);
    scripts[1].onerror();
    await assert.rejects(secondAttempt, /Google Maps script failed to load/);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("Google Maps loader shares concurrent callers and clears successful callback state", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const scripts = [];
  let removedScripts = 0;
  const importLibrary = () => Promise.resolve({});

  globalThis.window = {};
  globalThis.document = {
    createElement() {
      return {
        remove() {
          removedScripts += 1;
        },
      };
    },
    head: {
      appendChild(script) {
        scripts.push(script);
      },
    },
  };

  try {
    const { loadGoogleMaps } = await import(
      `../src/presentation/lib/googleMapsLoader.js?success=${Date.now()}`
    );
    const firstCaller = loadGoogleMaps("test-key");
    const secondCaller = loadGoogleMaps("test-key");

    assert.equal(firstCaller, secondCaller);
    assert.equal(scripts.length, 1);

    window.google = { maps: { importLibrary } };
    window.__chatlasGoogleMapsReady__();

    assert.equal(await firstCaller, importLibrary);
    assert.equal(await secondCaller, importLibrary);
    assert.equal(window.__chatlasGoogleMapsReady__, undefined);
    assert.equal(removedScripts, 1);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});
