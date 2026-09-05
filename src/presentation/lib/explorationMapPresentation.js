import {
  MAP_STATUS,
  VISITED_DATA_STATUS,
} from "@/business/services/explorationMapService";

export const MELAKA_MAP_CENTRE = Object.freeze({
  lat: 2.1896,
  lng: 102.2501,
});

export function getAttractionsPanelMapStatusMessageKey(mapStatus) {
  if (mapStatus === MAP_STATUS.READY) {
    return null;
  }

  return mapStatus === MAP_STATUS.UNAVAILABLE ? "mapFailed" : "mapLoading";
}

export function formatApproximateDistance(distanceMeters, language = "en") {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    return null;
  }

  const isKilometres = distanceMeters >= 1000;
  const value = isKilometres
    ? Math.round(distanceMeters / 100) / 10
    : Math.round(distanceMeters / 10) * 10;
  const unit = isKilometres ? "km" : "m";

  if (language === "zh") {
    return `约 ${value} ${isKilometres ? "公里" : "米"}`;
  }

  if (language === "ms" || language === "bm") {
    return `Kira-kira ${value} ${unit}`;
  }

  return `Approx. ${value} ${unit} away`;
}

export function getMapMarkerPresentation(attraction, index) {
  const markerNumber = Number.isInteger(index) && index >= 0 ? index + 1 : 1;
  const attractionName = attraction?.name?.trim() || "Unnamed attraction";

  if (attraction?.isVisited === true) {
    return {
      title: `${markerNumber}. ${attractionName} - Visited`,
      background: "#006C56",
      borderColor: "#004638",
      glyphColor: "#FFFFFF",
      glyphText: "\u2713",
      scale: 1.15,
      zIndex: 10000 + markerNumber,
    };
  }

  return {
    title: `${markerNumber}. ${attractionName}`,
    background: "#E3EAE7",
    borderColor: "#65748A",
    glyphColor: "#10213B",
    glyphText: String(markerNumber),
    scale: 1.05,
    zIndex: markerNumber,
  };
}

export function getAttractionDetailsHref(attractionId) {
  return `/attractions/${encodeURIComponent(attractionId)}`;
}

export function getVisitedAuthenticationPresentation(status) {
  if (status !== VISITED_DATA_STATUS.AUTH_REQUIRED) {
    return null;
  }

  return {
    message: "Sign in to view your verified visits.",
    signInHref: "/login",
    signInLabel: "Sign in",
  };
}
