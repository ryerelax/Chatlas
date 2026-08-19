"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMaps } from "@/presentation/lib/googleMapsLoader";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const VISITED_MARKER_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42"><path fill="#006C56" stroke="#ffffff" stroke-width="2" d="M15 1C7.82 1 2 6.82 2 14c0 10.25 13 26 13 26s13-15.75 13-26C28 6.82 22.18 1 15 1Z"/><circle cx="15" cy="14" r="5" fill="#ffffff"/></svg>'
)}`;

export default function SocialExplorationMap({ attractions }) {
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
    if (!GOOGLE_MAPS_API_KEY || mappedAttractions.length === 0) return;

    let cancelled = false;

    async function initialiseMap() {
      try {
        const importLibrary = await loadGoogleMaps(GOOGLE_MAPS_API_KEY);
        const [{ Map, LatLngBounds }, { Marker }] = await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
        ]);

        if (cancelled || !mapContainerRef.current) return;

        const bounds = new LatLngBounds();
        const map = new Map(mapContainerRef.current, {
          center: { lat: 2.1896, lng: 102.2501 },
          zoom: 11,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
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
        } else {
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
  }, [mappedAttractions]);

  if (!GOOGLE_MAPS_API_KEY || mappedAttractions.length === 0 || mapState === "error") {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-[18px] border border-attraction-border bg-attraction-surface-soft px-6 text-center">
        <p className="max-w-md text-sm text-attraction-muted">
          Exploration map is currently unavailable. Visited attractions remain available in the list below.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-80 overflow-hidden rounded-[18px] border border-attraction-border md:min-h-[420px]">
      {mapState !== "ready" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-attraction-surface-soft">
          <p className="text-sm text-attraction-muted">Loading exploration map...</p>
        </div>
      )}
      <div ref={mapContainerRef} className="h-full min-h-80 w-full md:min-h-[420px]" />
    </div>
  );
}
