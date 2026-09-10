"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIVE_LOCATION_STATUS,
  canStartLiveLocation,
  createLiveLocationController,
  stopLiveLocationForUnavailableMap,
} from "@/presentation/lib/liveLocationPresentation";

const INITIAL_STATE = Object.freeze({
  status: LIVE_LOCATION_STATUS.IDLE,
  errorKey: null,
  position: null,
  lastSuccessfulPosition: null,
});

export default function useLiveLocation({ mapStatus, onPosition, onClear }) {
  const controllerRef = useRef(null);
  const onPositionRef = useRef(onPosition);
  const onClearRef = useRef(onClear);
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    onPositionRef.current = onPosition;
    onClearRef.current = onClear;
  }, [onClear, onPosition]);

  useEffect(() => {
    const geolocation =
      typeof navigator === "undefined" ? null : navigator.geolocation;
    const controller = createLiveLocationController({
      geolocation,
      onStateChange: setState,
      onPosition(position, options) {
        onPositionRef.current?.(position, options);
      },
      onClear() {
        onClearRef.current?.();
      },
    });

    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    stopLiveLocationForUnavailableMap(controllerRef.current, mapStatus);
  }, [mapStatus]);

  const start = useCallback(() => {
    if (!canStartLiveLocation(mapStatus)) {
      setState((currentState) => ({
        ...currentState,
        status: LIVE_LOCATION_STATUS.ERROR,
        errorKey: "mapUnavailable",
        position: null,
      }));
      return false;
    }

    return controllerRef.current?.start() ?? false;
  }, [mapStatus]);

  const stop = useCallback(() => {
    return controllerRef.current?.stop() ?? false;
  }, []);

  return {
    ...state,
    isTracking: [
      LIVE_LOCATION_STATUS.REQUESTING,
      LIVE_LOCATION_STATUS.TRACKING,
    ].includes(state.status),
    canStart: canStartLiveLocation(mapStatus),
    start,
    stop,
  };
}
