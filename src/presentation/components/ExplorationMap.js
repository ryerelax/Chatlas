"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import ExplorationProgress from "@/presentation/components/ExplorationProgress";
import LiveLocationControls from "@/presentation/components/LiveLocationControls";
import VisitVerificationFlow from "@/presentation/components/VisitVerificationFlow";
import VisitedAttractionsList from "@/presentation/components/VisitedAttractionsList";
import { useLanguage } from "@/presentation/contexts/LanguageContext";
import useLiveLocation from "@/presentation/hooks/useLiveLocation";
import { loadGoogleMaps } from "@/presentation/lib/googleMapsLoader";
import {
  createLiveLocationMapOverlayController,
  getLiveLocationCopy,
} from "@/presentation/lib/liveLocationPresentation";
import {
  ATTRACTION_DATA_STATUS,
  createVisibleAttractions,
  createExplorationPageState,
  getExplorationMapFilterCountLabel,
  getNextExplorationMapFilter,
  MAP_VISIT_FILTER,
  MAP_STATUS,
  normaliseMapAttractions,
  orderAttractionsByDistance,
  VISITED_DATA_STATUS,
} from "@/business/services/explorationMapService";
import {
  formatApproximateDistance,
  getAttractionDetailsHref,
  getAttractionsPanelMapStatusMessageKey,
  getMapMarkerPresentation,
  MELAKA_MAP_CENTRE,
} from "@/presentation/lib/explorationMapPresentation";
import {
  canLoadVisitedAttractions,
  createVisitedDataReloadRevision,
  createDevelopmentVisitedPreviewAdapter,
  getDevelopmentMapPreviewMode,
  getDevelopmentVisitedPreviewMode,
  loadVisitedAttractionIds,
} from "@/presentation/lib/visitedAttractionsAdapter";
import { getVerificationAuthenticationState } from "@/presentation/lib/visitVerificationPresentation";

function createLiveLocationMarkerContent() {
  const marker = document.createElement("div");
  marker.className =
    "h-4 w-4 rounded-full border-[3px] border-white bg-[#1769E0] shadow-[0_0_0_2px_#1769E0,0_3px_10px_rgba(23,105,224,0.45)]";
  marker.setAttribute("aria-hidden", "true");
  return marker;
}

function subscribeToDevelopmentPreviewQuery(onStoreChange) {
  if (process.env.NODE_ENV !== "development") {
    return () => {};
  }
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getDevelopmentPreviewQuerySnapshot() {
  if (process.env.NODE_ENV !== "development") {
    return "";
  }
  return window.location.search;
}

function getServerDevelopmentPreviewQuerySnapshot() {
  return null;
}

function createInfoWindowContent(attraction, t, translateCategory) {
  const content = document.createElement("article");
  content.className = "max-w-64 p-1 text-[#10213B]";

  const category = document.createElement("p");
  category.className =
    "text-xs font-semibold uppercase tracking-wide text-[#006C56]";
  category.textContent = attraction.category
    ? translateCategory
      ? translateCategory(attraction.category)
      : attraction.category
    : "";

  const heading = document.createElement("h2");
  heading.className = "mt-1 text-base font-bold";
  heading.textContent = attraction.name;

  const address = document.createElement("p");
  address.className = "mt-1 text-sm leading-5 text-[#405066]";
  address.textContent = attraction.address;

  const visitedStatus = document.createElement("p");
  visitedStatus.className =
    "mt-3 w-fit rounded-full bg-[#E6F7F0] px-2.5 py-1 text-xs font-bold text-[#004638]";
  visitedStatus.textContent = "\u2713 " + t("visited");

  const link = document.createElement("a");
  link.className =
    "mt-3 inline-block font-semibold text-[#006C56] underline-offset-4 hover:underline";
  link.href = getAttractionDetailsHref(attraction.id);
  link.textContent = t("details");

  content.append(category, heading, address);
  if (attraction.isVisited) {
    content.append(visitedStatus);
  }
  content.append(link);
  return content;
}

function createVisitedDataState(result) {
  if (
    !result ||
    !Object.values(VISITED_DATA_STATUS).includes(result.status) ||
    (result.status === VISITED_DATA_STATUS.SUCCESS &&
      !Array.isArray(result.data))
  ) {
    throw new Error("The visited attraction response is invalid.");
  }

  return {
    status: result.status,
    attractionIds:
      result.status === VISITED_DATA_STATUS.SUCCESS ? result.data : [],
    message: typeof result.message === "string" ? result.message : "",
    latestVisitedDateByAttractionId:
      result.status === VISITED_DATA_STATUS.SUCCESS
        ? result.latestVisitedDateByAttractionId || {}
        : {},
    latestVerifiedAtByAttractionId:
      result.status === VISITED_DATA_STATUS.SUCCESS
        ? result.latestVerifiedAtByAttractionId || {}
        : {},
  };
}

function MarkerLegend({ visitedDataStatus, filter, onFilterChange, t }) {
  const visitStatusResolved =
    visitedDataStatus === VISITED_DATA_STATUS.SUCCESS;
  const statusLabel =
    visitedDataStatus === VISITED_DATA_STATUS.LOADING
      ? t("loading")
      : visitedDataStatus === VISITED_DATA_STATUS.AUTH_REQUIRED
        ? t("signInForMapFeatures")
        : t("mapFailed");

  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#405066]"
      aria-label={t("mapTitle")}
    >
      {visitStatusResolved && (
        <button
          type="button"
          onClick={() => onFilterChange("visited")}
          aria-pressed={filter === "visited"}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#B7E5D2] bg-white px-3 py-1.5 focus-visible:outline-3 focus-visible:outline-[#006C56]"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#006C56] text-sm font-bold text-white"
            aria-hidden="true"
          >
            {"\u2713"}
          </span>
          {t("visited")}
        </button>
      )}
      <button
        type="button"
        onClick={() => onFilterChange("unvisited")}
        disabled={!visitStatusResolved}
        aria-pressed={filter === "unvisited"}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D8E1E7] bg-white px-3 py-1.5 focus-visible:outline-3 focus-visible:outline-[#006C56] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full border border-[#768780] bg-[#E3EAE7] text-[10px] font-bold text-[#31463F]"
          aria-hidden="true"
        >
          1
        </span>
        {visitStatusResolved ? t("notVisited") : t("attractions")}
      </button>
      {!visitStatusResolved && (
        <span className="rounded-full bg-[#F1F4F6] px-3 py-1.5 text-[#65748A]">
          {statusLabel}
        </span>
      )}
    </div>
  );
}

function LoadingSkeleton({ mapOnly = false, t }) {
  if (mapOnly) {
    return (
      <div
        className="flex min-h-80 items-center justify-center overflow-hidden rounded-3xl border border-[#D8E1E7] bg-[#F1F6F4] shadow-sm lg:min-h-136"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <div
            className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#CDF5E5] border-t-[#006C56]"
            aria-hidden="true"
          />
          <p className="mt-4 font-semibold text-[#405066]">{t("mapLoading")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div
          className="flex min-h-80 items-center justify-center rounded-3xl border border-[#D8E1E7] bg-[#F1F6F4] lg:min-h-136"
          role="status"
          aria-live="polite"
        >
          <div className="text-center">
            <div
              className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#CDF5E5] border-t-[#006C56]"
              aria-hidden="true"
            />
            <p className="mt-4 font-semibold text-[#405066]">
              {t("mapLoading")}
            </p>
          </div>
        </div>

        <div
          className="rounded-3xl border border-[#D8E1E7] bg-white p-5"
          aria-busy="true"
        >
          <div className="h-5 w-40 animate-pulse rounded bg-[#E8EDF1]" />
          <div className="mt-3 h-4 w-56 animate-pulse rounded bg-[#E8EDF1]" />
          <p className="mt-5 text-sm font-semibold text-[#405066]" role="status">
            {t("loadingAttractions")}
          </p>
          <div className="mt-4 space-y-3" aria-hidden="true">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-2xl bg-[#F1F6F4]"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <ExplorationProgress
          progress={{ status: VISITED_DATA_STATUS.LOADING }}
        />
        <VisitedAttractionsList
          status={VISITED_DATA_STATUS.LOADING}
          attractions={[]}
          mapStatus={MAP_STATUS.IDLE}
        />
      </div>
    </>
  );
}

export default function ExplorationMap({ mapOnly = false }) {
  const { data: session, status: sessionStatus } = useSession();
  const { lang, t, translateCategory } = useLanguage();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerByAttractionIdRef = useRef(new Map());
  const mapAttractionByIdRef = useRef(new Map());
  const infoWindowRef = useRef(null);
  const pinElementConstructorRef = useRef(null);
  const selectedAttractionIdRef = useRef(null);
  const liveLocationOverlayRef = useRef(null);
  const latestLiveLocationRef = useRef(null);
  const tRef = useRef(t);
  const translateCategoryRef = useRef(translateCategory);
  const liveLocationMarkerLabelRef = useRef(
    getLiveLocationCopy(lang).markerLabel
  );
  const [attractions, setAttractions] = useState([]);
  const [dataStatus, setDataStatus] = useState(
    ATTRACTION_DATA_STATUS.LOADING
  );
  const [dataError, setDataError] = useState("");
  const [mapStatus, setMapStatus] = useState(MAP_STATUS.IDLE);
  const [dataRequest, setDataRequest] = useState(0);
  const [mapRequest, setMapRequest] = useState(0);
  const [visitedRequest, setVisitedRequest] = useState(0);
  const [previewActionPending, setPreviewActionPending] = useState(false);
  const [mapVisitFilter, setMapVisitFilter] = useState(MAP_VISIT_FILTER.ALL);
  const [visitedData, setVisitedData] = useState({
    status: VISITED_DATA_STATUS.LOADING,
    attractionIds: [],
    message: "",
    latestVisitedDateByAttractionId: {},
    latestVerifiedAtByAttractionId: {},
  });

  useEffect(() => {
    tRef.current = t;
    translateCategoryRef.current = translateCategory;
  }, [t, translateCategory]);

  const updateLiveLocationOverlay = useCallback((position, options) => {
    latestLiveLocationRef.current = position;
    liveLocationOverlayRef.current?.update(position, options);
  }, []);
  const clearLiveLocationOverlay = useCallback(() => {
    latestLiveLocationRef.current = null;
    liveLocationOverlayRef.current?.clear();
  }, []);
  const liveLocation = useLiveLocation({
    mapStatus,
    onPosition: updateLiveLocationOverlay,
    onClear: clearLiveLocationOverlay,
  });
  const developmentPreviewQuery = useSyncExternalStore(
    subscribeToDevelopmentPreviewQuery,
    getDevelopmentPreviewQuerySnapshot,
    getServerDevelopmentPreviewQuerySnapshot
  );
  const isDevelopmentPreviewQueryReady = developmentPreviewQuery !== null;
  const developmentVisitedPreviewMode =
    process.env.NODE_ENV === "development"
      ? getDevelopmentVisitedPreviewMode(
          developmentPreviewQuery || "",
          process.env.NODE_ENV
        )
      : null;
  const developmentMapPreviewMode =
    process.env.NODE_ENV === "development"
      ? getDevelopmentMapPreviewMode(
          developmentPreviewQuery || "",
          process.env.NODE_ENV
        )
      : null;
  const developmentPreviewRequested =
    developmentVisitedPreviewMode !== null ||
    developmentMapPreviewMode !== null;

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const googleMapsMapId =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
  const developmentPreviewAdapter = useMemo(
    () =>
      process.env.NODE_ENV === "development" &&
      developmentVisitedPreviewMode !== null &&
      dataStatus === ATTRACTION_DATA_STATUS.SUCCESS
        ? createDevelopmentVisitedPreviewAdapter({
            supportedAttractions: attractions,
            mode: developmentVisitedPreviewMode,
          })
        : null,
    [attractions, dataStatus, developmentVisitedPreviewMode]
  );
  const visitedDataReloadRevision = createVisitedDataReloadRevision({
    sessionStatus,
    sessionUserId: session?.user?.id,
    requestRevision: visitedRequest,
    developmentPreviewActive: developmentVisitedPreviewMode !== null,
  });
  const isVisitedDataReadyToLoad = canLoadVisitedAttractions({
    isPreviewQueryReady: isDevelopmentPreviewQueryReady,
    developmentPreviewActive: developmentVisitedPreviewMode !== null,
    developmentPreviewReady: developmentPreviewAdapter !== null,
    sessionStatus,
  });

  const loadAttractions = useCallback(() => {
    setMapStatus(MAP_STATUS.IDLE);
    setDataRequest((request) => request + 1);
  }, []);

  const loadVisitedAttractions = useCallback(() => {
    setVisitedRequest((request) => request + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function retrieveAttractions() {
      setDataStatus(ATTRACTION_DATA_STATUS.LOADING);
      setDataError("");

      try {
        const response = await fetch("/api/exploration-map/attractions", {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok || result.success === false) {
          throw new Error("The attraction service is unavailable.");
        }

        setAttractions(normaliseMapAttractions(result.data));
        setDataStatus(ATTRACTION_DATA_STATUS.SUCCESS);
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setAttractions([]);
        setDataError(tRef.current("failedLoadAttractions"));
        setDataStatus(ATTRACTION_DATA_STATUS.ERROR);
      }
    }

    retrieveAttractions();

    return () => controller.abort();
  }, [dataRequest]);

  useEffect(() => {
    const controller = new AbortController();

    async function retrieveVisitedAttractions() {
      setVisitedData({
        status: VISITED_DATA_STATUS.LOADING,
        attractionIds: [],
        message: "",
      });

      if (!isVisitedDataReadyToLoad) {
        return;
      }

      try {
        const result =
          developmentVisitedPreviewMode !== null
            ? await developmentPreviewAdapter.load({
                signal: controller.signal,
              })
            : await loadVisitedAttractionIds({ signal: controller.signal });

        if (controller.signal.aborted) {
          return;
        }

        setVisitedData(createVisitedDataState(result));
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }

        setVisitedData({
          status: VISITED_DATA_STATUS.ERROR,
          attractionIds: [],
          message: tRef.current("errorGeneric"),
        });
      }
    }

    retrieveVisitedAttractions();

    return () => controller.abort();
  }, [
    developmentPreviewAdapter,
    developmentVisitedPreviewMode,
    isVisitedDataReadyToLoad,
    visitedDataReloadRevision,
  ]);

  const explorationPageState = useMemo(
    () =>
      createExplorationPageState({
        supportedAttractions: attractions,
        visitedAttractionIds: visitedData.attractionIds,
        attractionDataStatus: dataStatus,
        visitedDataStatus: visitedData.status,
        mapStatus,
      }),
    [
      attractions,
      dataStatus,
      mapStatus,
      visitedData.attractionIds,
      visitedData.status,
    ]
  );
  const explorationViewModel = explorationPageState.viewModel;
  const mapAttractions = explorationViewModel.attractions;
  const visibleAttractions = useMemo(
    () => createVisibleAttractions(mapAttractions, mapVisitFilter),
    [mapAttractions, mapVisitFilter]
  );
  const orderedVisibleAttractions = useMemo(
    () =>
      orderAttractionsByDistance(
        visibleAttractions,
        liveLocation.lastSuccessfulPosition
      ),
    [liveLocation.lastSuccessfulPosition, visibleAttractions]
  );
  const attractionsPanelMapStatusMessageKey =
    getAttractionsPanelMapStatusMessageKey(mapStatus);
  const visitedAttractions = explorationViewModel.visitedAttractions.map(
    (attraction) => ({
      ...attraction,
      latestVisitedDate:
        visitedData.latestVisitedDateByAttractionId?.[attraction.id] || null,
      latestVerifiedAt:
        visitedData.latestVerifiedAtByAttractionId?.[attraction.id] || null,
    })
  );
  const verificationAuthenticationState = getVerificationAuthenticationState(
    explorationViewModel.visitedDataStatus,
    { developmentPreviewActive: developmentVisitedPreviewMode !== null }
  );

  useEffect(() => {
    mapAttractionByIdRef.current = new Map(
      mapAttractions.map((attraction) => [attraction.id, attraction])
    );
  }, [mapAttractions]);

  useEffect(() => {
    const markerLabel = getLiveLocationCopy(lang).markerLabel;
    liveLocationMarkerLabelRef.current = markerLabel;
    liveLocationOverlayRef.current?.setMarkerTitle(markerLabel);
  }, [lang]);

  const updateDevelopmentPreview = useCallback(
    async (actionName) => {
      if (
        process.env.NODE_ENV !== "development" ||
        !developmentPreviewAdapter ||
        !["add", "remove", "reset"].includes(actionName)
      ) {
        return;
      }

      setPreviewActionPending(true);

      try {
        const result = await developmentPreviewAdapter[actionName]();
        setVisitedData(createVisitedDataState(result));
      } catch {
        setVisitedData({
          status: VISITED_DATA_STATUS.ERROR,
          attractionIds: [],
          message: tRef.current("errorGeneric"),
        });
      } finally {
        setPreviewActionPending(false);
      }
    },
    [developmentPreviewAdapter]
  );

  useEffect(() => {
    if (
      dataStatus !== ATTRACTION_DATA_STATUS.SUCCESS ||
      !isDevelopmentPreviewQueryReady ||
      !mapContainerRef.current
    ) {
      return undefined;
    }

    let isCancelled = false;
    let createdMarkers = [];
    let infoWindow;

    async function initialiseMap() {
      setMapStatus(MAP_STATUS.LOADING);

      if (developmentMapPreviewMode === MAP_STATUS.LOADING) {
        return;
      }

      if (developmentMapPreviewMode === MAP_STATUS.UNAVAILABLE) {
        setMapStatus(MAP_STATUS.UNAVAILABLE);
        return;
      }

      if (!googleMapsApiKey) {
        setMapStatus(MAP_STATUS.UNAVAILABLE);
        return;
      }

      try {
        const importLibrary = await loadGoogleMaps(googleMapsApiKey);

        const [mapsLibrary, markerLibrary, coreLibrary] = await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
          importLibrary("core"),
        ]);

        if (isCancelled || !mapContainerRef.current) {
          return;
        }

        const { Circle, InfoWindow, Map: GoogleMap } = mapsLibrary;
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

        infoWindowRef.current = infoWindow;
        pinElementConstructorRef.current = PinElement;

        createdMarkers = visibleAttractions.map((attraction, index) => {
          const currentAttraction =
            mapAttractionByIdRef.current.get(attraction.id) || attraction;
          const position = {
            lat: attraction.latitude,
            lng: attraction.longitude,
          };
          const markerPresentation = getMapMarkerPresentation(
            currentAttraction,
            index
          );
          const marker = new AdvancedMarkerElement({
            map,
            position,
            title: markerPresentation.title,
            gmpClickable: true,
            zIndex: markerPresentation.zIndex,
          });
          const pin = new PinElement({
            background: markerPresentation.background,
            borderColor: markerPresentation.borderColor,
            glyphColor: markerPresentation.glyphColor,
            glyphText: markerPresentation.glyphText,
            scale: markerPresentation.scale,
          });

          marker.append(pin);
          marker.addEventListener("gmp-click", () => {
            const current =
              mapAttractionByIdRef.current.get(attraction.id) || attraction;

            selectedAttractionIdRef.current = attraction.id;
            infoWindow.close();
            infoWindow.setContent(
              createInfoWindowContent(
                current,
                tRef.current,
                translateCategoryRef.current
              )
            );
            infoWindow.open({ map, anchor: marker, shouldFocus: false });
          });

          markerByAttractionIdRef.current.set(attraction.id, marker);
          bounds.extend(position);
          return marker;
        });

        if (visibleAttractions.length === 1) {
          map.setCenter({
            lat: visibleAttractions[0].latitude,
            lng: visibleAttractions[0].longitude,
          });
          map.setZoom(15);
        } else if (visibleAttractions.length > 1) {
          map.fitBounds(bounds, 52);
        }

        mapInstanceRef.current = map;
        liveLocationOverlayRef.current = createLiveLocationMapOverlayController({
          map,
          createMarker({ map: markerMap, position }) {
            const marker = new AdvancedMarkerElement({
              map: markerMap,
              position,
              title: liveLocationMarkerLabelRef.current,
              zIndex: 0,
            });
            marker.append(createLiveLocationMarkerContent());
            return marker;
          },
          createAccuracyCircle({ map: circleMap, center, radius }) {
            return new Circle({
              map: circleMap,
              center,
              radius,
              clickable: false,
              fillColor: "#1769E0",
              fillOpacity: 0.16,
              strokeColor: "#1769E0",
              strokeOpacity: 0.55,
              strokeWeight: 1.5,
              zIndex: 1,
            });
          },
        });
        if (latestLiveLocationRef.current) {
          liveLocationOverlayRef.current.update(
            latestLiveLocationRef.current,
            { shouldCenter: false }
          );
        }
        setMapStatus(MAP_STATUS.READY);
      } catch {
        if (!isCancelled) {
          setMapStatus(MAP_STATUS.UNAVAILABLE);
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
      infoWindowRef.current = null;
      pinElementConstructorRef.current = null;
      selectedAttractionIdRef.current = null;
      liveLocationOverlayRef.current?.clear();
      liveLocationOverlayRef.current = null;
      mapInstanceRef.current = null;
    };
  }, [
    dataStatus,
    developmentMapPreviewMode,
    googleMapsApiKey,
    googleMapsMapId,
    isDevelopmentPreviewQueryReady,
    mapRequest,
    visibleAttractions,
  ]);

  useEffect(() => {
    const PinElement = pinElementConstructorRef.current;

    if (mapStatus !== MAP_STATUS.READY || !PinElement) {
      return;
    }

    orderedVisibleAttractions.forEach((attraction, index) => {
      const marker = markerByAttractionIdRef.current.get(attraction.id);

      if (!marker) {
        return;
      }

      const markerPresentation = getMapMarkerPresentation(attraction, index);
      const pin = new PinElement({
        background: markerPresentation.background,
        borderColor: markerPresentation.borderColor,
        glyphColor: markerPresentation.glyphColor,
        glyphText: markerPresentation.glyphText,
        scale: markerPresentation.scale,
      });

      marker.title = markerPresentation.title;
      marker.zIndex = markerPresentation.zIndex;
      marker.replaceChildren(pin);
    });

    const selectedAttraction = mapAttractionByIdRef.current.get(
      selectedAttractionIdRef.current
    );

    if (selectedAttraction && infoWindowRef.current) {
      infoWindowRef.current.setContent(
        createInfoWindowContent(
          selectedAttraction,
          tRef.current,
          translateCategoryRef.current
        )
      );
    }
  }, [mapStatus, orderedVisibleAttractions, t, translateCategory]);

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

  if (dataStatus === ATTRACTION_DATA_STATUS.LOADING) {
    return <LoadingSkeleton mapOnly={mapOnly} t={t} />;
  }

  if (dataStatus === ATTRACTION_DATA_STATUS.ERROR) {
    return (
      <div className="space-y-8">
        <section
          className="rounded-3xl border border-[#F0C8C5] bg-white px-6 py-14 text-center shadow-sm"
          role="alert"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FBE9E8] text-2xl">
            !
          </div>
          <h2 className="mt-5 text-xl font-bold text-[#10213B]">
            {t("failedLoadAttractions")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-[#405066]">{dataError}</p>
          <button
            type="button"
            onClick={loadAttractions}
            className="mt-6 min-h-11 rounded-xl bg-[#006C56] px-5 py-3 font-semibold text-white transition hover:bg-[#005E4B]"
          >
            {t("reset")}
          </button>
        </section>

        {!mapOnly && (
          <div className="max-w-xl">
            <ExplorationProgress
              progress={{ status: VISITED_DATA_STATUS.ERROR }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      aria-labelledby={mapOnly ? undefined : "exploration-map-heading"}
    >
      {!mapOnly &&
        process.env.NODE_ENV === "development" &&
        developmentPreviewRequested && (
          <div className="mb-6 rounded-2xl border border-[#E9B949] bg-[#FFF7DD] px-4 py-3 text-sm text-[#704A00] shadow-sm">
            <div className="flex items-center gap-3 font-semibold" role="status">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#704A00] text-xs font-bold uppercase tracking-wide text-white"
                aria-hidden="true"
              >
                Dev
              </span>
              <span>Development preview — mock visited data</span>
            </div>
            {/* Dev controls unchanged (English) */}
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              {developmentVisitedPreviewMode && (
                <span className="rounded-full bg-white/80 px-2.5 py-1">
                  Visited: {developmentVisitedPreviewMode}
                </span>
              )}
              {developmentMapPreviewMode && (
                <span className="rounded-full bg-white/80 px-2.5 py-1">
                  Map: {developmentMapPreviewMode}
                </span>
              )}
            </div>
            {developmentVisitedPreviewMode === "visited" && (
              <div
                className="mt-3 flex flex-wrap gap-2 border-t border-[#E9B949]/60 pt-3"
                role="group"
                aria-label="Development visited preview controls"
              >
                <button
                  type="button"
                  onClick={() => updateDevelopmentPreview("add")}
                  disabled={
                    previewActionPending ||
                    explorationViewModel.visitedDataStatus !==
                      VISITED_DATA_STATUS.SUCCESS ||
                    visitedAttractions.length >= mapAttractions.length
                  }
                  className="min-h-11 rounded-xl bg-[#704A00] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#C5AD7B]"
                >
                  Add mock visited place
                </button>
                <button
                  type="button"
                  onClick={() => updateDevelopmentPreview("remove")}
                  disabled={
                    previewActionPending ||
                    explorationViewModel.visitedDataStatus !==
                      VISITED_DATA_STATUS.SUCCESS ||
                    visitedAttractions.length === 0
                  }
                  className="min-h-11 rounded-xl border border-[#B88924] bg-white px-4 py-2 text-sm font-semibold text-[#704A00] disabled:cursor-not-allowed"
                >
                  Remove mock visited place
                </button>
                <button
                  type="button"
                  onClick={() => updateDevelopmentPreview("reset")}
                  disabled={
                    previewActionPending ||
                    explorationViewModel.visitedDataStatus !==
                      VISITED_DATA_STATUS.SUCCESS
                  }
                  className="min-h-11 rounded-xl border border-[#B88924] bg-transparent px-4 py-2 text-sm font-semibold text-[#704A00] disabled:cursor-not-allowed"
                >
                  Reset preview
                </button>
              </div>
            )}
          </div>
        )}

      {!mapOnly && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#006C56]">
              {t("mapTitle")}
            </p>
            <h2
              id="exploration-map-heading"
              className="mt-1 text-2xl font-bold tracking-tight text-[#10213B] sm:text-3xl"
            >
              {t("attractions")}
            </h2>
            <p className="mt-2 max-w-2xl text-[#405066]">
              {t("exploreProgress")}
            </p>
            <MarkerLegend
              visitedDataStatus={explorationViewModel.visitedDataStatus}
              filter={mapVisitFilter}
              onFilterChange={(requested) =>
                setMapVisitFilter((current) =>
                  getNextExplorationMapFilter(current, requested)
                )
              }
              t={t}
            />
          </div>

          <div className="w-fit rounded-full bg-[#E6F7F0] px-4 py-2 text-sm font-semibold text-[#004638]">
            {t("attractionsCount", { count: orderedVisibleAttractions.length })}
          </div>
        </div>
      )}

      {!mapOnly && (
        <VisitVerificationFlow
          attractions={mapAttractions}
          authenticationState={
            verificationAuthenticationState.authenticationState
          }
          authenticationConfirmed={
            verificationAuthenticationState.authenticationConfirmed
          }
          authenticationRequired={
            verificationAuthenticationState.authenticationRequired
          }
          authenticationPending={
            verificationAuthenticationState.authenticationPending
          }
          authenticationUnavailable={
            verificationAuthenticationState.authenticationUnavailable
          }
          onAuthenticationRetry={loadVisitedAttractions}
          onVerified={loadVisitedAttractions}
        />
      )}

      {!mapOnly && (
        <LiveLocationControls
          status={liveLocation.status}
          errorKey={liveLocation.errorKey}
          hasPosition={
            Boolean(liveLocation.position) && mapStatus === MAP_STATUS.READY
          }
          hasLastSuccessfulPosition={Boolean(
            liveLocation.lastSuccessfulPosition
          )}
          canStart={liveLocation.canStart}
          onStart={liveLocation.start}
          onRecenter={() => liveLocationOverlayRef.current?.recenter()}
          onStop={liveLocation.stop}
        />
      )}

      <div
        className={
          mapOnly
            ? ""
            : "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"
        }
      >
        <div className="relative min-h-80 overflow-hidden rounded-3xl border border-[#D8E1E7] bg-[#F1F6F4] shadow-sm lg:min-h-136">
          <div
            ref={mapContainerRef}
            className="absolute inset-0"
            aria-label={
              explorationPageState.isMapUnavailable
                ? undefined
                : t("mapTitle")
            }
            aria-hidden={explorationPageState.isMapUnavailable}
          />

          {explorationPageState.isMapLoading && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-[#F1F6F4]"
              role="status"
              aria-live="polite"
            >
              <div className="text-center">
                <div
                  className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#CDF5E5] border-t-[#006C56]"
                  aria-hidden="true"
                />
                <p className="mt-4 font-semibold text-[#405066]">
                  {t("mapLoading")}
                </p>
              </div>
            </div>
          )}

          {explorationPageState.isMapUnavailable && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-[#F1F6F4] p-6 text-center"
              role="alert"
            >
              <div className="max-w-md rounded-2xl border border-[#D8E1E7] bg-white p-6 shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F7F0] text-xl text-[#006C56]">
                  ⌖
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#10213B]">
                  {t("mapFailed")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#405066]">
                  {t("mapFailed")}
                </p>
                {googleMapsApiKey &&
                  developmentMapPreviewMode !== MAP_STATUS.UNAVAILABLE && (
                    <button
                      type="button"
                      onClick={() => {
                        setMapStatus(MAP_STATUS.LOADING);
                        setMapRequest((request) => request + 1);
                      }}
                      className="mt-5 min-h-11 rounded-xl border border-[#BBC8D0] bg-white px-4 py-2.5 text-sm font-semibold text-[#004638] transition hover:bg-[#E6F7F0]"
                    >
                      {t("reset")}
                    </button>
                  )}
              </div>
            </div>
          )}
        </div>

        {!mapOnly && (
          <aside className="max-h-136 overflow-hidden rounded-3xl border border-[#D8E1E7] bg-white shadow-sm">
            <div className="border-b border-[#E8EDF1] p-5">
              <h3 className="text-lg font-bold text-[#10213B]">
                {t("attractions")}
              </h3>
              {attractionsPanelMapStatusMessageKey && (
                <p className="mt-1 text-sm text-[#65748A]">
                  {t(attractionsPanelMapStatusMessageKey)}
                </p>
              )}
            </div>

            {orderedVisibleAttractions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-semibold text-[#10213B]">
                  {t("noAttractionsFound")}
                </p>
              </div>
            ) : (
              <ol className="max-h-[calc(34rem-92px)] divide-y divide-[#E8EDF1] overflow-y-auto">
                {orderedVisibleAttractions.map((attraction, index) => (
                  <li key={attraction.id} className="p-4">
                    <button
                      type="button"
                      onClick={() => focusAttraction(attraction)}
                      disabled={mapStatus !== MAP_STATUS.READY}
                      className="group flex min-h-11 w-full items-start gap-3 rounded-xl text-left focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56] disabled:cursor-default"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                          attraction.isVisited
                            ? "border-[#004638] bg-[#006C56] text-white"
                            : "border-[#768780] bg-[#E3EAE7] text-[#31463F]"
                        }`}
                        aria-hidden="true"
                      >
                        {attraction.isVisited ? "\u2713" : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-[#10213B] transition group-enabled:group-hover:text-[#006C56]">
                          {attraction.name}
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-[#65748A]">
                          {attraction.address}
                        </span>
                        {Number.isFinite(attraction.distanceMeters) && (
                          <span className="mt-1 block text-sm font-semibold text-[#006C56]">
                            {formatApproximateDistance(
                              attraction.distanceMeters,
                              lang
                            )}
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pl-12 text-xs max-sm:pl-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#E6F7F0] px-2.5 py-1 font-semibold text-[#004638]">
                          {translateCategory
                            ? translateCategory(attraction.category)
                            : attraction.category}
                        </span>
                        {attraction.isVisited && (
                          <span className="rounded-full bg-[#006C56] px-2.5 py-1 font-semibold text-white">
                            {"\u2713"} {t("visited")}
                          </span>
                        )}
                      </div>
                      <Link
                        href={getAttractionDetailsHref(attraction.id)}
                        className="inline-flex min-h-11 items-center font-semibold text-[#006C56] underline-offset-4 hover:underline"
                      >
                        {t("details")}
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        )}
      </div>

      {!mapOnly && (
        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
          <ExplorationProgress progress={explorationViewModel.progress} />
          <VisitedAttractionsList
            status={explorationViewModel.visitedDataStatus}
            attractions={visitedAttractions}
            mapStatus={mapStatus}
            message={visitedData.message}
            onFocusAttraction={focusAttraction}
            onRetry={
              visitedData.status === VISITED_DATA_STATUS.ERROR
                ? loadVisitedAttractions
                : undefined
            }
          />
        </div>
      )}
    </section>
  );
}
