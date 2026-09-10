"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMaps } from "@/presentation/lib/googleMapsLoader";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const VISITED_MARKER_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42"><path fill="#006C56" stroke="#ffffff" stroke-width="2" d="M15 1C7.82 1 2 6.82 2 14c0 10.25 13 26 13 26s13-15.75 13-26C28 6.82 22.18 1 15 1Z"/><circle cx="15" cy="14" r="5" fill="#ffffff"/></svg>'
)}`;
const COMPARISON_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#edf4f0" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#405066" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f7faf8" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#c7d6cf" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#e1ece6" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#d3e8dc" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d9e3de" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#f4e4b5" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#dfe9e4" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9e0e5" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#5c7880" }],
  },
];

export default function SocialExplorationMap({
  attractions,
  ariaLabel = "Visited attractions map",
  appearance = "default",
}) {
  const mapContainerRef = useRef(null);
  const [mapState, setMapState] = useState("loading");
  const mappedAttractions = useMemo(
    () =>
      attractions.filter(
        (attraction) =>
          typeof attraction.latitude === "number" &&
          typeof attraction.longitude === "number"
      ),
    [attractions]
  );

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;

    let cancelled = false;

    async function initialiseMap() {
      try {
        const importLibrary = await loadGoogleMaps(GOOGLE_MAPS_API_KEY);
        const [{ Map }, { Marker }, { LatLngBounds }] = await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
          importLibrary("core"),
        ]);

        if (cancelled || !mapContainerRef.current) return;

        const bounds = new LatLngBounds();
        const map = new Map(mapContainerRef.current, {
          center: { lat: 2.1896, lng: 102.2501 },
          zoom: 11,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          ...(appearance === "comparison"
            ? { styles: COMPARISON_MAP_STYLES }
            : {}),
        });

        mappedAttractions.forEach((attraction) => {
          const position = {
            lat: attraction.latitude,
            lng: attraction.longitude,
          };
          const marker = new Marker({
            position,
            map,
            title: attraction.name,
            icon: VISITED_MARKER_ICON,
          });

          marker.addListener("click", () => {
            window.location.assign(`/attractions/${attraction.id}`);
          });
          bounds.extend(position);
        });

        if (mappedAttractions.length === 1) {
          map.setCenter(bounds.getCenter());
          map.setZoom(15);
        } else if (mappedAttractions.length > 1) {
          map.fitBounds(bounds, 48);
        }

        if (!cancelled) setMapState("ready");
      } catch (error) {
        console.error("Failed to initialise the public exploration map:", error.message);
        if (!cancelled) setMapState("error");
      }
    }

    initialiseMap();
    return () => {
      cancelled = true;
    };
  }, [appearance, mappedAttractions]);

  if (!GOOGLE_MAPS_API_KEY || mapState === "error") {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-[18px] border border-attraction-border bg-attraction-surface-soft px-6 text-center">
        <p className="max-w-md text-sm text-attraction-muted">
          Exploration map is currently unavailable. Visited attractions remain available in the list below.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-80 overflow-hidden rounded-[18px] border border-attraction-border md:min-h-[420px]"
      role="region"
      aria-label={ariaLabel}
    >
      {mapState !== "ready" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-attraction-surface-soft">
          <p className="text-sm text-attraction-muted">Loading exploration map...</p>
        </div>
      )}
      <div ref={mapContainerRef} className="h-full min-h-80 w-full md:min-h-[420px]" />
    </div>
  );
}
