export const LIVE_LOCATION_STATUS = Object.freeze({
  IDLE: "idle",
  REQUESTING: "requesting",
  TRACKING: "tracking",
  ERROR: "error",
});

export const LIVE_LOCATION_WATCH_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
});

const LIVE_LOCATION_ZOOM = 16;

const LIVE_LOCATION_COPY = Object.freeze({
  en: Object.freeze({
    show: "Show my live location",
    recenter: "Recenter",
    stop: "Stop live location",
    retry: "Retry live location",
    requesting: "Finding your live location…",
    tracking: "Live location is on",
    stoppedLastLocation: "Live location stopped. Distances are based on your last known location.",
    markerLabel: "Your live location",
    controlsLabel: "Live location controls",
    actionsLabel: "Live location actions",
    privacy: "Turn on live location to show your position while this page is open. Your position stays on this device and is not stored or uploaded. Visit verification separately checks your location once. Chatlas does not provide route navigation.",
    errors: Object.freeze({
      unsupported: "Live location is not supported by this browser.",
      permissionDenied: "Location permission was denied. Allow location access in your browser settings, then try again.",
      positionUnavailable: "Your location is currently unavailable. Check your device location settings, then try again.",
      timeout: "Finding your location took too long. Please try again.",
      invalidPosition: "The browser returned an invalid location. Please try again.",
      mapUnavailable: "The map is not ready for live location. Please wait or reload the map.",
    }),
  }),
  zh: Object.freeze({
    show: "显示我的实时位置",
    recenter: "重新居中",
    stop: "停止实时位置",
    retry: "重试实时位置",
    requesting: "正在取得你的实时位置…",
    tracking: "实时位置已开启",
    stoppedLastLocation: "实时定位已停止。距离根据你最后的位置计算。",
    markerLabel: "你的实时位置",
    controlsLabel: "实时位置控制",
    actionsLabel: "实时位置操作",
    privacy: "开启实时位置后，地图会在此页面打开期间显示你的位置。位置只保留在此设备，不会被储存或上传。到访验证会另外进行一次位置检查。Chatlas 不提供路线导航。",
    errors: Object.freeze({
      unsupported: "此浏览器不支持实时位置。",
      permissionDenied: "位置权限已被拒绝。请在浏览器设置中允许位置权限，然后重试。",
      positionUnavailable: "目前无法取得你的位置。请检查设备的位置设置，然后重试。",
      timeout: "取得位置的时间过长，请重试。",
      invalidPosition: "浏览器返回了无效的位置，请重试。",
      mapUnavailable: "地图尚未准备好显示实时位置。请稍候或重新加载地图。",
    }),
  }),
  ms: Object.freeze({
    show: "Tunjukkan lokasi langsung saya",
    recenter: "Pusatkan semula",
    stop: "Hentikan lokasi langsung",
    retry: "Cuba semula lokasi langsung",
    requesting: "Sedang mendapatkan lokasi langsung anda…",
    tracking: "Lokasi langsung dihidupkan",
    stoppedLastLocation: "Lokasi langsung telah dihentikan. Jarak adalah berdasarkan lokasi terakhir anda.",
    markerLabel: "Lokasi langsung anda",
    controlsLabel: "Kawalan lokasi langsung",
    actionsLabel: "Tindakan lokasi langsung",
    privacy: "Hidupkan lokasi langsung untuk memaparkan kedudukan anda semasa halaman ini dibuka. Lokasi kekal pada peranti ini dan tidak disimpan atau dimuat naik. Pengesahan lawatan menyemak lokasi secara berasingan sekali sahaja. Chatlas tidak menyediakan navigasi laluan.",
    errors: Object.freeze({
      unsupported: "Lokasi langsung tidak disokong oleh pelayar ini.",
      permissionDenied: "Kebenaran lokasi ditolak. Benarkan akses lokasi dalam tetapan pelayar, kemudian cuba lagi.",
      positionUnavailable: "Lokasi anda tidak tersedia buat masa ini. Semak tetapan lokasi peranti, kemudian cuba lagi.",
      timeout: "Lokasi anda mengambil masa terlalu lama untuk ditemukan. Sila cuba lagi.",
      invalidPosition: "Pelayar mengembalikan lokasi yang tidak sah. Sila cuba lagi.",
      mapUnavailable: "Peta belum bersedia untuk lokasi langsung. Sila tunggu atau muat semula peta.",
    }),
  }),
});

function rejectEmptyBrowserNumber(value) {
  if (
    value === null
    || value === undefined
    || typeof value === "boolean"
    || (typeof value === "string" && value.trim().length === 0)
  ) {
    return Number.NaN;
  }

  return Number(value);
}

export function normaliseLiveLocationPosition(position) {
  const latitude = rejectEmptyBrowserNumber(position?.coords?.latitude);
  const longitude = rejectEmptyBrowserNumber(position?.coords?.longitude);
  const accuracyMeters = rejectEmptyBrowserNumber(position?.coords?.accuracy);

  if (
    !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
    || !Number.isFinite(accuracyMeters)
    || accuracyMeters < 0
  ) {
    throw new Error("The browser returned an invalid live location.");
  }

  return { latitude, longitude, accuracyMeters };
}

export function getLiveLocationCopy(language = "en") {
  return LIVE_LOCATION_COPY[language] || LIVE_LOCATION_COPY.en;
}

export function getLiveLocationStatusPresentation({
  language = "en",
  status,
  hasLastSuccessfulPosition = false,
} = {}) {
  const copy = getLiveLocationCopy(language);
  const message =
    status === LIVE_LOCATION_STATUS.REQUESTING
      ? copy.requesting
      : status === LIVE_LOCATION_STATUS.TRACKING
        ? copy.tracking
        : hasLastSuccessfulPosition
          ? copy.stoppedLastLocation
          : copy.show;

  return {
    message,
    role: "status",
    ariaLive: "polite",
    ariaAtomic: true,
  };
}

export function canStartLiveLocation(mapStatus) {
  return mapStatus === "ready";
}

export function stopLiveLocationForUnavailableMap(controller, mapStatus) {
  if (mapStatus !== "unavailable" || typeof controller?.stop !== "function") {
    return false;
  }

  return controller.stop();
}

function getBrowserErrorKey(error) {
  if (error?.code === 1) return "permissionDenied";
  if (error?.code === 3) return "timeout";
  return "positionUnavailable";
}

export function createLiveLocationController({
  geolocation,
  onStateChange = () => {},
  onPosition = () => {},
  onClear = () => {},
} = {}) {
  let activeWatchId = null;
  let generation = 0;
  let shouldCenterNextPosition = true;
  let snapshot = {
    status: LIVE_LOCATION_STATUS.IDLE,
    errorKey: null,
    position: null,
    lastSuccessfulPosition: null,
  };

  function updateSnapshot(nextSnapshot) {
    snapshot = nextSnapshot;
    onStateChange({ ...nextSnapshot });
  }

  function clearActiveWatch() {
    if (
      activeWatchId !== null
      && typeof geolocation?.clearWatch === "function"
    ) {
      geolocation.clearWatch(activeWatchId);
    }
    activeWatchId = null;
  }

  function fail(errorKey, currentGeneration, pendingWatch) {
    if (currentGeneration !== generation) return;

    generation += 1;
    if (activeWatchId !== null) {
      clearActiveWatch();
    } else {
      pendingWatch.shouldClear = true;
    }
    shouldCenterNextPosition = true;
    onClear();
    updateSnapshot({
      status: LIVE_LOCATION_STATUS.ERROR,
      errorKey,
      position: null,
      lastSuccessfulPosition: snapshot.lastSuccessfulPosition,
    });
  }

  function start() {
    if (
      activeWatchId !== null
      || snapshot.status === LIVE_LOCATION_STATUS.REQUESTING
      || snapshot.status === LIVE_LOCATION_STATUS.TRACKING
    ) {
      return false;
    }

    if (
      typeof geolocation?.watchPosition !== "function"
      || typeof geolocation?.clearWatch !== "function"
    ) {
      updateSnapshot({
        status: LIVE_LOCATION_STATUS.ERROR,
        errorKey: "unsupported",
        position: null,
        lastSuccessfulPosition: snapshot.lastSuccessfulPosition,
      });
      return false;
    }

    generation += 1;
    const currentGeneration = generation;
    const pendingWatch = { shouldClear: false };
    shouldCenterNextPosition = true;
    updateSnapshot({
      status: LIVE_LOCATION_STATUS.REQUESTING,
      errorKey: null,
      position: null,
      lastSuccessfulPosition: snapshot.lastSuccessfulPosition,
    });

    let watchId;
    try {
      watchId = geolocation.watchPosition(
        (browserPosition) => {
          if (currentGeneration !== generation) return;

          let position;
          try {
            position = normaliseLiveLocationPosition(browserPosition);
          } catch {
            fail("invalidPosition", currentGeneration, pendingWatch);
            return;
          }

          const shouldCenter = shouldCenterNextPosition;
          shouldCenterNextPosition = false;
          updateSnapshot({
            status: LIVE_LOCATION_STATUS.TRACKING,
            errorKey: null,
            position,
            lastSuccessfulPosition: position,
          });
          onPosition(position, { shouldCenter });
        },
        (error) => {
          fail(getBrowserErrorKey(error), currentGeneration, pendingWatch);
        },
        LIVE_LOCATION_WATCH_OPTIONS
      );
    } catch {
      fail("positionUnavailable", currentGeneration, pendingWatch);
      return false;
    }

    if (pendingWatch.shouldClear || currentGeneration !== generation) {
      geolocation.clearWatch(watchId);
      return false;
    }

    activeWatchId = watchId;
    return true;
  }

  function stop({ notify = true } = {}) {
    const wasActive =
      activeWatchId !== null
      || snapshot.status === LIVE_LOCATION_STATUS.REQUESTING
      || snapshot.status === LIVE_LOCATION_STATUS.TRACKING;

    generation += 1;
    clearActiveWatch();
    shouldCenterNextPosition = true;
    onClear();

    if (notify) {
      updateSnapshot({
        status: LIVE_LOCATION_STATUS.IDLE,
        errorKey: null,
        position: null,
        lastSuccessfulPosition: snapshot.lastSuccessfulPosition,
      });
    }

    return wasActive;
  }

  return {
    start,
    stop,
    dispose() {
      stop({ notify: false });
    },
    getSnapshot() {
      return {
        ...snapshot,
        position: snapshot.position ? { ...snapshot.position } : null,
        lastSuccessfulPosition: snapshot.lastSuccessfulPosition
          ? { ...snapshot.lastSuccessfulPosition }
          : null,
      };
    },
  };
}

function normaliseOverlayPosition(position) {
  const latitude = Number(position?.latitude);
  const longitude = Number(position?.longitude);
  const accuracyMeters = Number(position?.accuracyMeters);

  if (
    !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
    || !Number.isFinite(accuracyMeters)
    || accuracyMeters < 0
  ) {
    return null;
  }

  return { latitude, longitude, accuracyMeters };
}

export function createLiveLocationMapOverlayController({
  map,
  createMarker,
  createAccuracyCircle,
  zoom = LIVE_LOCATION_ZOOM,
} = {}) {
  let marker = null;
  let accuracyCircle = null;
  let latestPosition = null;

  function centreMap(position) {
    if (
      !map
      || typeof map.setCenter !== "function"
      || typeof map.setZoom !== "function"
    ) {
      return false;
    }

    map.setCenter({ lat: position.latitude, lng: position.longitude });
    map.setZoom(zoom);
    return true;
  }

  function update(position, { shouldCenter = false } = {}) {
    const nextPosition = normaliseOverlayPosition(position);
    if (
      !nextPosition
      || !map
      || typeof createMarker !== "function"
      || typeof createAccuracyCircle !== "function"
    ) {
      return false;
    }

    const mapPosition = {
      lat: nextPosition.latitude,
      lng: nextPosition.longitude,
    };

    if (!marker) {
      marker = createMarker({ map, position: mapPosition });
    } else {
      marker.map = map;
      marker.position = mapPosition;
    }

    if (!accuracyCircle) {
      accuracyCircle = createAccuracyCircle({
        map,
        center: mapPosition,
        radius: nextPosition.accuracyMeters,
      });
    } else {
      accuracyCircle.setMap(map);
      accuracyCircle.setCenter(mapPosition);
      accuracyCircle.setRadius(nextPosition.accuracyMeters);
    }

    latestPosition = nextPosition;
    if (shouldCenter) centreMap(nextPosition);
    return true;
  }

  function clear() {
    if (marker) marker.map = null;
    accuracyCircle?.setMap(null);
    marker = null;
    accuracyCircle = null;
    latestPosition = null;
  }

  return {
    update,
    clear,
    recenter() {
      return latestPosition ? centreMap(latestPosition) : false;
    },
    setMarkerTitle(title) {
      if (marker && typeof title === "string") marker.title = title;
    },
  };
}
