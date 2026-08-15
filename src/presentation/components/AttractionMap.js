"use client";

import { useEffect, useRef, useState } from "react";
import { LocationPinIcon } from "@/presentation/components/AttractionIcons";
import { loadGoogleMaps } from "@/presentation/lib/googleMapsLoader";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function AttractionMap({ attraction }) {
  const mapContainerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const hasCoordinates =
    typeof attraction.latitude === "number" &&
    typeof attraction.longitude === "number";

  const isMapAvailable = Boolean(GOOGLE_MAPS_API_KEY) && hasCoordinates && !mapError;

  useEffect(() => {
    if (!isMapAvailable) return;

    let cancelled = false;

    async function initMap() {
      try {
        const importLibrary = await loadGoogleMaps(GOOGLE_MAPS_API_KEY);
        const [{ Map }, { Marker }] = await Promise.all([importLibrary("maps"), importLibrary("marker")]);

        if (cancelled || !mapContainerRef.current) return;

        const position = {
          lat: attraction.latitude,
          lng: attraction.longitude,
        };

        const map = new Map(mapContainerRef.current, {
          center: position,
          zoom: 15,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        new Marker({
          position,
          map,
          title: attraction.name,
        });

        if (!cancelled) setMapReady(true);
      } catch (error) {
        console.error("Failed to initialize Google Map:", error.message);
        if (!cancelled) setMapError(true);
      }
    }

    initMap();

    return () => {
      cancelled = true;
    };
  }, [isMapAvailable, attraction.latitude, attraction.longitude, attraction.name]);

  if (!isMapAvailable) {
    return <MapUnavailable attraction={attraction} />;
  }

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-[18px] border border-attraction-border">
      {!mapReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-attraction-surface-soft">
          <p className="text-sm text-attraction-muted">Loading map...</p>
        </div>
      )}

      <div ref={mapContainerRef} className="h-full min-h-[420px] w-full" />
    </div>
  );
}

function MapUnavailable({ attraction }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-[18px] border border-attraction-border bg-attraction-surface-soft px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-attraction-primary-soft text-attraction-primary">
        <LocationPinIcon size={22} />
      </div>

      <p className="text-[15px] font-semibold text-attraction-ink">
        Map is currently unavailable
      </p>

      <p className="max-w-sm text-sm leading-relaxed text-attraction-muted">
        {attraction.address}
      </p>
    </div>
  );
}
