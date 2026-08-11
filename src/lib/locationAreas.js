// Draft Melaka zone list for PB09 (team has not confirmed this yet — see
// scripts/classifyLocationAreas.mjs report for reconciliation against real
// seeded attraction addresses before treating this as final).
export const LOCATION_AREAS = [
  "Melaka Historic City Centre (Bandar Hilir)",
  "Melaka Raya / Central Melaka",
  "Ayer Keroh",
  "Klebang & Coastal Melaka",
  "Other / Greater Melaka",
];

// Catch-all for anything within Melaka state that isn't one of the four named
// tourist zones above (outskirts like Bukit Serindit/Batu Berendam, and Jasin
// district — still within Melaka state, just not a designated tourist zone).
const CATCH_ALL_ZONE = "Other / Greater Melaka";

// Ordered rule list: first matching rule wins. Keyword rules are checked before
// the broader postcode-range rules so a specific locality (e.g. "Klebang Kecil,
// 75200") isn't swallowed by a neighbouring zone's postcode range.
//
// Jonker Street/Hang Jebat, Bukit China, and Kampung Morten are grouped under
// Bandar Hilir (not Central) — geographically they're the same walkable
// historic core as Dutch Square/A Famosa/St Paul's Hill.
const RULES = [
  {
    zone: "Ayer Keroh",
    test: (text) => /ayer keroh|bukit beruang|durian tunggal|bukit katil/i.test(text) || /\b75450\b/.test(text),
  },
  {
    zone: "Klebang & Coastal Melaka",
    test: (text) => /klebang|duyong|pantai|tanjung kling/i.test(text),
  },
  {
    zone: "Melaka Historic City Centre (Bandar Hilir)",
    test: (text) =>
      /banda(r)? hilir|jonker|hang jebat|bukit china|kampung morten|kg morten/i.test(text) ||
      /\b7500[0-5]\b/.test(text),
  },
  {
    zone: "Melaka Raya / Central Melaka",
    test: (text) => /melaka raya|kota laksamana|bukit baru/i.test(text) || /\b751\d{2}\b|\b752\d{2}\b|\b7530\d\b/.test(text),
  },
];

function matchZone(text) {
  if (!text) return "";

  const match = RULES.find((rule) => rule.test(text));
  return match ? match.zone : "";
}

// Returns one of LOCATION_AREAS. Checks the address first, then falls back to
// the attraction name (some seeded addresses are too generic to classify, e.g.
// "Malacca, Malaysia", even though the name itself names a real locality).
// Only returns "" when neither address nor name is available at all.
export function classifyLocationArea(address, name = "") {
  if (!address && !name) return "";

  return matchZone(address) || matchZone(name) || CATCH_ALL_ZONE;
}
