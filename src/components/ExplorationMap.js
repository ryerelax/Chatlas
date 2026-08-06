"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAttractionDetailsHref,
  MELAKA_MAP_CENTRE,
  normaliseMapAttractions,
} from "@/lib/explorationMap";

let configuredMapsKey = "";

function configureMapsLoader(apiKey) {
  if (!configuredMapsKey) {
    setOptions({
      key: apiKey,
      v: "weekly",
      language: "en",
      region: "MY",
      authReferrerPolicy: "origin",
    });
    configuredMapsKey = apiKey;
  }

  if (configuredMapsKey !== apiKey) {
    throw new Error("Google Maps has already been configured.");
  }
}

function createInfoWindowContent(attraction) {
  const content = document.createElement("article");
  content.className = "max-w-64 p-1 text-[#10213B]";

  const category = document.createElement("p");
  category.className = "text-xs font-semibold uppercase tracking-wide text-[#006C56]";
  category.textContent = attraction.category;

  const heading = document.createElement("h2");
  heading.className = "mt-1 text-base font-bold";
  heading.textContent = attraction.name;

  const address = document.createElement("p");
  address.className = "mt-1 text-sm leading-5 text-[#405066]";
  address.textContent = attraction.address;

  const link = document.createElement("a");
  link.className = "mt-3 inline-block font-semibold text-[#006C56] underline-offset-4 hover:underline";
  link.href = getAttractionDetailsHref(attraction.id);
  link.textContent = "View attraction details";

  content.append(category, heading, address, link);
  return content;
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <div className="min-h-80 animate-pulse rounded-3xl border border-[#D8E1E7] bg-[#E6F7F0] lg:min-h-136" />

      <div className="rounded-3xl border border-[#D8E1E7] bg-white p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-[#E8EDF1]" />
        <div className="mt-3 h-4 w-56 animate-pulse rounded bg-[#E8EDF1]" />

        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-2xl bg-[#F1F6F4]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ExplorationMap() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerByAttractionIdRef = useRef(new Map());
  const [attractions, setAttractions] = useState([]);
  const [dataStatus, setDataStatus] = useState("loading");
  const [dataError, setDataError] = useState("");
  const [mapStatus, setMapStatus] = useState("idle");
  const [mapError, setMapError] = useState("");
  const [dataRequest, setDataRequest] = useState(0);
  const [mapRequest, setMapRequest] = useState(0);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const googleMapsMapId =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

  const loadAttractions = useCallback(() => {
    setDataRequest((request) => request + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function retrieveAttractions() {
      setDataStatus("loading");
      setDataError("");

      try {
        const response = await fetch("/api/attractions", {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok || result.success === false) {
          throw new Error("The attraction service is unavailable.");
        }

        setAttractions(normaliseMapAttractions(result.data));
        setDataStatus("success");
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setAttractions([]);
        setDataError(
          "We could not load the supported Melaka attractions. Please try again."
        );
        setDataStatus("error");
      }
    }

    retrieveAttractions();

    return () => controller.abort();
  }, [dataRequest]);

  useEffect(() => {
    if (dataStatus !== "success" || !mapContainerRef.current) {
      return undefined;
    }

    let isCancelled = false;
    let createdMarkers = [];
    let infoWindow;

    async function initialiseMap() {
      setMapStatus("loading");
      setMapError("");

      if (!googleMapsApiKey) {
        setMapError(
          "The interactive map is unavailable because Google Maps has not been configured."
        );
        setMapStatus("unavailable");
        return;
      }

      try {
        configureMapsLoader(googleMapsApiKey);

        const [mapsLibrary, markerLibrary, coreLibrary] = await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
          importLibrary("core"),
        ]);

        if (isCancelled || !mapContainerRef.current) {
          return;
        }

        const { InfoWindow, Map: GoogleMap } = mapsLibrary;
        const { AdvancedMarkerElement, PinElement } = markerLibrary;
        const { LatLngBounds } = coreLibrary;

        const map = new GoogleMap(mapContainerRef.current, {
          center: MELAKA_MAP_CENTRE,
          zoom: 13,
          mapId: googleMapsMapId,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "cooperative",
        });

        const bounds = new LatLngBounds();
        infoWindow = new InfoWindow();
        markerByAttractionIdRef.current = new Map();

        createdMarkers = attractions.map((attraction, index) => {
          const position = {
            lat: attraction.latitude,
            lng: attraction.longitude,
          };
          const marker = new AdvancedMarkerElement({
            map,
            position,
            title: `${index + 1}. ${attraction.name}`,
            gmpClickable: true,
          });
          const pin = new PinElement({
            background: "#006C56",
            borderColor: "#004638",
            glyphColor: "#FFFFFF",
            glyphText: String(index + 1),
            scale: 1.05,
          });

          marker.append(pin);
          marker.addEventListener("gmp-click", () => {
            infoWindow.close();
            infoWindow.setContent(createInfoWindowContent(attraction));
            infoWindow.open({ map, anchor: marker, shouldFocus: false });
          });

          markerByAttractionIdRef.current.set(attraction.id, marker);
          bounds.extend(position);
          return marker;
        });

        if (attractions.length === 1) {
          map.setCenter({
            lat: attractions[0].latitude,
            lng: attractions[0].longitude,
          });
          map.setZoom(15);
        } else if (attractions.length > 1) {
          map.fitBounds(bounds, 52);
        }

        mapInstanceRef.current = map;
        setMapStatus("ready");
      } catch {
        if (!isCancelled) {
          setMapError(
            "The interactive map could not be loaded. The attraction list is still available below."
          );
          setMapStatus("unavailable");
        }
      }
    }

    initialiseMap();

    return () => {
      isCancelled = true;
      infoWindow?.close();
      createdMarkers.forEach((marker) => {
        marker.map = null;
      });
      markerByAttractionIdRef.current = new Map();
      mapInstanceRef.current = null;
    };
  }, [
    attractions,
    dataStatus,
    googleMapsApiKey,
    googleMapsMapId,
    mapRequest,
  ]);

  function focusAttraction(attraction) {
    const map = mapInstanceRef.current;
    const marker = markerByAttractionIdRef.current.get(attraction.id);

    if (!map || !marker) {
      return;
    }

    map.panTo({ lat: attraction.latitude, lng: attraction.longitude });
    map.setZoom(16);
    marker.dispatchEvent(new Event("gmp-click"));
  }

  if (dataStatus === "loading") {
    return <LoadingSkeleton />;
  }

  if (dataStatus === "error") {
    return (
      <section
        className="rounded-3xl border border-[#F0C8C5] bg-white px-6 py-14 text-center shadow-sm"
        role="alert"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FBE9E8] text-2xl">
          !
        </div>
        <h2 className="mt-5 text-xl font-bold text-[#10213B]">
          Attractions unavailable
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-[#405066]">{dataError}</p>
        <button
          type="button"
          onClick={loadAttractions}
          className="mt-6 min-h-11 rounded-xl bg-[#006C56] px-5 py-3 font-semibold text-white transition hover:bg-[#005E4B] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56]"
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="exploration-map-heading">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#006C56]">
            Melaka map
          </p>
          <h2
            id="exploration-map-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-[#10213B] sm:text-3xl"
          >
            Supported attractions
          </h2>
          <p className="mt-2 max-w-2xl text-[#405066]">
            Select a green marker or a place in the list to explore its location.
          </p>
        </div>

        <div className="w-fit rounded-full bg-[#E6F7F0] px-4 py-2 text-sm font-semibold text-[#004638]">
          {attractions.length} attraction{attractions.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="relative min-h-80 overflow-hidden rounded-3xl border border-[#D8E1E7] bg-[#F1F6F4] shadow-sm lg:min-h-136">
          <div
            ref={mapContainerRef}
            className="absolute inset-0"
            aria-label="Interactive map of supported Melaka attractions"
          />

          {mapStatus === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#F1F6F4]" role="status">
              <div className="text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#CDF5E5] border-t-[#006C56]" />
                <p className="mt-4 font-semibold text-[#405066]">Loading map...</p>
              </div>
            </div>
          )}

          {mapStatus === "unavailable" && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-[#F1F6F4] p-6 text-center"
              role="alert"
            >
              <div className="max-w-md rounded-2xl border border-[#D8E1E7] bg-white p-6 shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F7F0] text-xl text-[#006C56]">
                  ⌖
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#10213B]">
                  Map unavailable
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#405066]">
                  {mapError}
                </p>
                {googleMapsApiKey && (
                  <button
                    type="button"
                    onClick={() => setMapRequest((request) => request + 1)}
                    className="mt-5 min-h-11 rounded-xl border border-[#BBC8D0] bg-white px-4 py-2.5 text-sm font-semibold text-[#004638] transition hover:bg-[#E6F7F0] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56]"
                  >
                    Retry map
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="max-h-136 overflow-hidden rounded-3xl border border-[#D8E1E7] bg-white shadow-sm">
          <div className="border-b border-[#E8EDF1] p-5">
            <h3 className="text-lg font-bold text-[#10213B]">Places on this map</h3>
            <p className="mt-1 text-sm text-[#65748A]">
              Location details remain available if the map cannot load.
            </p>
          </div>

          {attractions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-[#10213B]">No mapped attractions yet</p>
              <p className="mt-2 text-sm leading-6 text-[#65748A]">
                Supported attractions will appear here once coordinates are available.
              </p>
            </div>
          ) : (
            <ol className="max-h-[calc(34rem-92px)] divide-y divide-[#E8EDF1] overflow-y-auto">
              {attractions.map((attraction, index) => (
                <li key={attraction.id} className="p-4">
                  <button
                    type="button"
                    onClick={() => focusAttraction(attraction)}
                    disabled={mapStatus !== "ready"}
                    className="group flex min-h-11 w-full items-start gap-3 rounded-xl text-left focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56] disabled:cursor-default"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#006C56] text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-[#10213B] transition group-enabled:group-hover:text-[#006C56]">
                        {attraction.name}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-[#65748A]">
                        {attraction.address}
                      </span>
                    </span>
                  </button>

                  <div className="mt-3 flex items-center justify-between gap-3 pl-12 text-xs">
                    <span className="rounded-full bg-[#E6F7F0] px-2.5 py-1 font-semibold text-[#004638]">
                      {attraction.category}
                    </span>
                    <Link
                      href={getAttractionDetailsHref(attraction.id)}
                      className="min-h-11 content-center font-semibold text-[#006C56] underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56]"
                    >
                      View details
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      <p className="mt-4 text-sm text-[#65748A]">
        This map shows attraction locations only. Chatlas does not request your current location or provide route navigation.
      </p>
    </section>
  );
}
