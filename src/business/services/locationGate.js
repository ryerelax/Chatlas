// Attraction Explorer's own gate for "is this user Melaka-based", used by
// Steps 4/5's community photo/description contributions. Reads only the
// already-exposed session.user.location (populated by auth.ts's own session
// callback from User.location) — does not query the User model or touch
// anything in the User/auth module itself.
//
// User.location is completely free text (a plain <input type="text">, no
// enum, no normalization anywhere, not even trimmed on save), so this can't
// be a strict equality check. Matches "Melaka" as a whole word,
// case-insensitively, tolerating variants like "Melaka, Malaysia",
// "melaka", "Bandar Melaka, Malaysia", etc. Also matches "Malacca" (the
// same place's English/colonial-era name), since that's the name Google
// Places itself uses in a large share of this project's real seeded
// address data — flagged for confirmation, not a silent assumption.
const MELAKA_LOCATION_PATTERN = /\b(melaka|malacca)\b/i;

export function isMelakaLocation(locationText) {
  if (!locationText) {
    return false;
  }

  return MELAKA_LOCATION_PATTERN.test(locationText.trim());
}

export function isMelakaBasedUser(session) {
  return isMelakaLocation(session?.user?.location);
}
