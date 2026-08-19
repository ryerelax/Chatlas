export const MELAKA_MAP_CENTRE = Object.freeze({
  lat: 2.1896,
  lng: 102.2501,
});

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
