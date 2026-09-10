const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const WIKIDATA_USER_AGENT =
  "Chatlas/1.0 (Melaka tourism PWA, university project; description backfill investigation)";

// Coordinate-matched Wikidata lookup for the description backfill (see
// wikidataDescriptionMatchService.js for the matching/ranking logic that
// consumes this). SPARQL is free/public, no API key needed.
export async function findNearbyWikidataEntities(latitude, longitude, { radiusKm = 0.15, limit = 5 } = {}) {
  const sparql = `
    SELECT ?item ?itemLabel ?itemDescription ?dist ?article WHERE {
      SERVICE wikibase:around {
        ?item wdt:P625 ?location .
        bd:serviceParam wikibase:center "Point(${longitude} ${latitude})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "${radiusKm}" .
        bd:serviceParam wikibase:distance ?dist .
      }
      OPTIONAL {
        ?article schema:about ?item ;
                 schema:isPartOf <https://en.wikipedia.org/> .
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY ?dist
    LIMIT ${limit}
  `;

  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": WIKIDATA_USER_AGENT,
      Accept: "application/sparql-results+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL request failed with status ${response.status}`);
  }

  const data = await response.json();

  return data.results.bindings.map((binding) => ({
    qid: binding.item?.value?.split("/").pop(),
    label: binding.itemLabel?.value || "",
    wikidataDescription: binding.itemDescription?.value || "",
    distanceKm: binding.dist?.value ? parseFloat(binding.dist.value) : null,
    wikipediaUrl: binding.article?.value || null,
  }));
}

// Fetches the intro extract for a linked Wikipedia article. Not every
// Wikidata entity has one — callers should treat null as "no extract
// available", not an error.
export async function fetchWikipediaExtract(wikipediaUrl) {
  if (!wikipediaUrl) {
    return null;
  }

  const title = decodeURIComponent(wikipediaUrl.split("/wiki/")[1] || "");
  if (!title) {
    return null;
  }

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const response = await fetch(url, { headers: { "User-Agent": WIKIDATA_USER_AGENT } });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.extract || null;
}
