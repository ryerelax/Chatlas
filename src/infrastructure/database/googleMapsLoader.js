"use client";

let apiPromise = null;

// Loads the Google Maps JavaScript API exactly once per page and resolves
// with its importLibrary function. Uses Google's `callback=` query param so
// readiness is signalled explicitly by Google once loading=async's internal
// chunk loading (main.js/common.js/util.js) has actually finished — the
// script tag's own `load` event fires too early for that under loading=async
// and isn't a reliable readiness signal.
export function loadGoogleMaps(apiKey) {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) {
      resolve(window.google.maps.importLibrary);
      return;
    }

    const callbackName = "__chatlasGoogleMapsReady__";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps.importLibrary);
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps script failed to load."));
    document.head.appendChild(script);
  });

  return apiPromise;
}
