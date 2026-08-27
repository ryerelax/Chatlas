"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  canSubmitVerifiedVisitPhoto,
  completeVerifiedVisitCanvasCapture,
  createVerifiedVisitSubmissionKeyStore,
  createVisitVerificationOperationController,
  createVerifiedVisitFormData,
  buildVerifiedVisitCapacityUrl,
  getCameraErrorMessage,
  getCandidateSelectionMode,
  getGeolocationErrorMessage,
  getNearbyCandidatePresentations,
  getNoNearbyAttractionMessage,
  getVisitVerificationAuthenticationTransition,
  getVisitVerificationResponseDecision,
  getVerifiedVisitLimitReachedMessage,
  getVerifiedVisitUploadLabel,
  normaliseVerifiedVisitCapacity,
  normaliseBrowserPosition,
  refreshVerifiedVisitConsumers,
  requestCurrentBrowserPosition,
} from "@/presentation/lib/visitVerificationPresentation";
import { publishVerifiedVisitorPhotosInvalidation } from "@/presentation/lib/verifiedVisitorPhotosPresentation";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

const FLOW_STATE = Object.freeze({
  IDLE: "idle",
  LOCATING: "locating",
  CHOOSING: "choosing",
  CAPACITY: "capacity",
  LIMIT_REACHED: "limit-reached",
  CAMERA: "camera",
  PREVIEW: "preview",
  SUBMITTING: "submitting",
  UPLOAD_ERROR: "upload-error",
  SUCCESS: "success",
  ERROR: "error",
});

const CAMERA_CONSTRAINTS = Object.freeze({
  video: { facingMode: { ideal: "environment" } },
  audio: false,
});

const VERIFY_ERROR_MESSAGE =
  "We could not verify this visit. Please try again.";
const AUTHENTICATION_ERROR_MESSAGE =
  "Your session has expired. Sign in and try again.";
const CAPACITY_ERROR_MESSAGE =
  "We could not check today's photo limit. Please try again.";
const BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56] disabled:cursor-not-allowed disabled:opacity-60";

export default function VisitVerificationFlow({
  attractions,
  authenticationConfirmed = false,
  authenticationRequired = false,
  authenticationPending = false,
  authenticationUnavailable = false,
  authenticationState = "unavailable",
  onAuthenticationRetry,
  onVerified,
}) {
  const { t } = useLanguage();
  const videoRef = useRef(null);
  const captureButtonRef = useRef(null);
  const uploadButtonRef = useRef(null);
  const operationTokenRef = useRef(null);
  const flowStateRef = useRef(FLOW_STATE.IDLE);
  const [operationController] = useState(() =>
    createVisitVerificationOperationController({
      authenticationConfirmed,
    })
  );
  const [submissionKeyStore] = useState(() =>
    createVerifiedVisitSubmissionKeyStore()
  );
  const [flowState, setFlowState] = useState(FLOW_STATE.IDLE);
  const [position, setPosition] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedAttractionId, setSelectedAttractionId] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturePending, setCapturePending] = useState(false);
  const [capacity, setCapacity] = useState(null);
  const [currentCapture, setCurrentCapture] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [authenticationPromptVisible, setAuthenticationPromptVisible] =
    useState(false);
  const [authenticationUnavailableVisible, setAuthenticationUnavailableVisible] =
    useState(false);
  const [sessionAuthenticationRequired, setSessionAuthenticationRequired] =
    useState(false);

  const transitionToFlowState = useCallback((nextFlowState) => {
    flowStateRef.current = nextFlowState;
    setFlowState(nextFlowState);
  }, []);

  const supportedAttractions = useMemo(
    () => (Array.isArray(attractions) ? attractions : []),
    [attractions]
  );
  const effectiveAuthenticationRequired =
    authenticationRequired || sessionAuthenticationRequired;
  const selectedCandidate = useMemo(
    () =>
      candidates.find(
        ({ attraction }) => attraction.id === selectedAttractionId
      ) || null,
    [candidates, selectedAttractionId]
  );

  const failFlow = useCallback(
    (operationId, message, { requireSignIn = false } = {}) => {
      if (!operationController.isCurrent(operationId)) {
        return;
      }

      if (requireSignIn) {
        operationController.updateAuthentication(false);
      } else {
        operationController.invalidate("error");
      }
      operationTokenRef.current = null;
      submissionKeyStore.reset();
      setCameraStream(null);
      setCameraReady(false);
      setCapacity(null);
      setCurrentCapture(null);
      setCapturePending(false);
      setErrorMessage(message);
      setSessionAuthenticationRequired(requireSignIn);
      setAuthenticationPromptVisible(requireSignIn);
      setAuthenticationUnavailableVisible(false);
      transitionToFlowState(FLOW_STATE.ERROR);
    },
    [operationController, submissionKeyStore, transitionToFlowState]
  );

  const openCamera = useCallback(
    async (operationId, attractionId) => {
      if (!operationController.claimCamera(operationId)) {
        return;
      }

      if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
        failFlow(
          operationId,
          "Live camera capture is unavailable in this browser."
        );
        return;
      }

      setSelectedAttractionId(attractionId);
      setCameraReady(false);
      setCapturePending(false);
      transitionToFlowState(FLOW_STATE.CAMERA);

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      } catch (error) {
        failFlow(operationId, getCameraErrorMessage(error));
        return;
      }

      if (!operationController.resolveCamera(operationId, stream)) {
        return;
      }

      setCameraStream(stream);
    },
    [failFlow, operationController, transitionToFlowState]
  );

  const checkCapacity = useCallback(
    async (operationId, attractionId) => {
      const requestController = new AbortController();
      if (!operationController.claimCapacity(operationId, requestController)) {
        return;
      }

      setSelectedAttractionId(attractionId);
      setCapacity(null);
      transitionToFlowState(FLOW_STATE.CAPACITY);

      let response;
      try {
        response = await fetch(buildVerifiedVisitCapacityUrl(attractionId), {
          cache: "no-store",
          signal: requestController.signal,
        });
      } catch (error) {
        if (
          error?.name === "AbortError" ||
          !operationController.isCurrent(operationId)
        ) {
          return;
        }

        failFlow(operationId, CAPACITY_ERROR_MESSAGE);
        return;
      }

      const result = await response.json().catch(() => null);
      if (!operationController.isCurrent(operationId)) return;

      const responseDecision = getVisitVerificationResponseDecision(
        response,
        result,
        {
          authentication: AUTHENTICATION_ERROR_MESSAGE,
          verification: CAPACITY_ERROR_MESSAGE,
        }
      );
      if (responseDecision.type !== "success") {
        failFlow(operationId, responseDecision.message, {
          requireSignIn: responseDecision.authenticationRequired,
        });
        return;
      }

      let nextCapacity;
      try {
        nextCapacity = normaliseVerifiedVisitCapacity(result, attractionId);
      } catch {
        failFlow(operationId, CAPACITY_ERROR_MESSAGE);
        return;
      }

      if (
        !operationController.completeCapacity(
          operationId,
          requestController,
          nextCapacity.remainingSlots
        )
      ) {
        return;
      }

      setCapacity(nextCapacity);
      if (nextCapacity.remainingSlots === 0) {
        transitionToFlowState(FLOW_STATE.LIMIT_REACHED);
        return;
      }

      void openCamera(operationId, attractionId);
    },
    [failFlow, openCamera, operationController, transitionToFlowState]
  );

  const handleLocatedPosition = useCallback(
    (operationId, browserPosition) => {
      if (!operationController.completeLocation(operationId)) {
        return;
      }

      let currentPosition;
      let nearbyCandidates;

      try {
        currentPosition = normaliseBrowserPosition(browserPosition);
        nearbyCandidates = getNearbyCandidatePresentations(
          supportedAttractions,
          currentPosition
        );
      } catch (error) {
        failFlow(
          operationId,
          error instanceof Error
            ? error.message
            : "We could not validate your current location."
        );
        return;
      }

      const selectionMode = getCandidateSelectionMode(nearbyCandidates);
      setPosition(currentPosition);
      setCandidates(nearbyCandidates);

      if (selectionMode === "none") {
        failFlow(
          operationId,
          getNoNearbyAttractionMessage(supportedAttractions, currentPosition)
        );
        return;
      }

      if (selectionMode === "automatic") {
        const attractionId = nearbyCandidates[0].attraction.id;
        setSelectedAttractionId(attractionId);
        void checkCapacity(operationId, attractionId);
        return;
      }

      setSelectedAttractionId("");
      transitionToFlowState(FLOW_STATE.CHOOSING);
    },
    [
      failFlow,
      checkCapacity,
      operationController,
      supportedAttractions,
      transitionToFlowState,
    ]
  );

  const startVerification = useCallback(() => {
    setAuthenticationPromptVisible(false);
    setAuthenticationUnavailableVisible(false);

    if (authenticationPending) {
      return;
    }

    if (authenticationRequired || sessionAuthenticationRequired) {
      setAuthenticationPromptVisible(true);
      return;
    }

    if (!authenticationConfirmed || authenticationUnavailable) {
      setAuthenticationUnavailableVisible(true);
      return;
    }

    const operationId = operationController.claimLocation();

    if (operationId === null) {
      setAuthenticationUnavailableVisible(true);
      return;
    }

    operationTokenRef.current = operationId;
    submissionKeyStore.reset();
    setCameraStream(null);
    setCameraReady(false);
    setCapacity(null);
    setCurrentCapture(null);
    setPosition(null);
    setCandidates([]);
    setSelectedAttractionId("");
    setErrorMessage("");
    setSessionAuthenticationRequired(false);
    setCapturePending(false);
    transitionToFlowState(FLOW_STATE.LOCATING);

    if (typeof navigator.geolocation?.getCurrentPosition !== "function") {
      failFlow(
        operationId,
        "Current location is unavailable in this browser."
      );
      return;
    }

    requestCurrentBrowserPosition(
      navigator.geolocation,
      (browserPosition) => handleLocatedPosition(operationId, browserPosition),
      (error) => failFlow(operationId, getGeolocationErrorMessage(error))
    );
  }, [
    authenticationConfirmed,
    authenticationPending,
    authenticationRequired,
    authenticationUnavailable,
    failFlow,
    handleLocatedPosition,
    operationController,
    sessionAuthenticationRequired,
    submissionKeyStore,
    transitionToFlowState,
  ]);

  const closeFlow = useCallback(() => {
    operationController.invalidate("close");
    operationTokenRef.current = null;
    submissionKeyStore.reset();
    setCameraStream(null);
    setCameraReady(false);
    setCapacity(null);
    setCurrentCapture(null);
    setPosition(null);
    setCandidates([]);
    setSelectedAttractionId("");
    setErrorMessage("");
    setAuthenticationPromptVisible(false);
    setAuthenticationUnavailableVisible(false);
    setSessionAuthenticationRequired(false);
    setCapturePending(false);
    transitionToFlowState(FLOW_STATE.IDLE);
  }, [operationController, submissionKeyStore, transitionToFlowState]);

  const continueWithSelectedAttraction = useCallback(() => {
    if (!selectedAttractionId) {
      return;
    }

    void checkCapacity(operationTokenRef.current, selectedAttractionId);
  }, [checkCapacity, selectedAttractionId]);

  const capturePhoto = useCallback(() => {
    if (
      flowState !== FLOW_STATE.CAMERA ||
      capturePending ||
      !cameraReady ||
      !capacity
    ) {
      return;
    }

    const operationId = operationTokenRef.current;
    const video = videoRef.current;

    if (!operationController.isCurrent(operationId)) {
      return;
    }

    setCapturePending(true);

    try {
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error("The camera image is not ready yet.");
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("The camera image could not be captured.");
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!operationController.isCurrent(operationId)) {
            return;
          }

          completeVerifiedVisitCanvasCapture({
            operationController,
            operationToken: operationId,
            blob,
            createObjectUrl: (capturedBlob) =>
              URL.createObjectURL(capturedBlob),
            onAccepted: (capture) => {
              setCurrentCapture(capture);
              setCapturePending(false);
              transitionToFlowState(FLOW_STATE.PREVIEW);
            },
            onFailure: (message) => failFlow(operationId, message),
            onSettled: () => {
              if (flowStateRef.current === FLOW_STATE.CAMERA) {
                setCapturePending(false);
              }
            },
          });
        },
        "image/jpeg",
        0.85
      );
    } catch (error) {
      failFlow(
        operationId,
        error instanceof Error
          ? error.message
          : "The camera image could not be captured. Please try again."
      );
    }
  }, [
    cameraReady,
    capacity,
    capturePending,
    failFlow,
    flowState,
    operationController,
    transitionToFlowState,
  ]);

  const retakePhoto = useCallback(() => {
    const operationId = operationTokenRef.current;
    if (!operationController.retakeCurrentCapture(operationId)) return;
    setCurrentCapture(null);
    setCapturePending(false);
    transitionToFlowState(FLOW_STATE.CAMERA);
  }, [operationController, transitionToFlowState]);

  const submitPhoto = useCallback(async () => {
    if (
      !canSubmitVerifiedVisitPhoto({
        flowState,
        currentCapture,
        capturePending,
        position,
        attractionId: selectedAttractionId,
      })
    ) {
      return;
    }

    const operationId = operationTokenRef.current;
    const requestController = new AbortController();

    if (
      !operationController.claimSubmission(operationId, requestController, {
        capturePending,
      })
    ) {
      return;
    }

    let submissionKey;
    try {
      submissionKey = submissionKeyStore.getOrCreate();
    } catch {
      operationController.completeSubmission(operationId, requestController);
      failFlow(
        operationId,
        "A secure upload could not be prepared in this browser. Please try again."
      );
      return;
    }

    setCameraStream(null);
    setCameraReady(false);
    setErrorMessage("");
    transitionToFlowState(FLOW_STATE.SUBMITTING);

    let response;
    try {
      response = await fetch("/api/exploration-map/verified-visits", {
        method: "POST",
        body: createVerifiedVisitFormData({
          photoBlob: currentCapture.blob,
          attractionId: selectedAttractionId,
          position,
          submissionKey,
        }),
        signal: requestController.signal,
      });
    } catch (error) {
      if (
        error?.name === "AbortError" ||
        !operationController.isCurrent(operationId)
      ) {
        return;
      }

      operationController.completeSubmission(operationId, requestController);
      setErrorMessage(VERIFY_ERROR_MESSAGE);
      transitionToFlowState(FLOW_STATE.UPLOAD_ERROR);
      return;
    }

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (
      !operationController.completeSubmission(operationId, requestController)
    ) {
      return;
    }

    const responseDecision = getVisitVerificationResponseDecision(
      response,
      result,
      {
        authentication: AUTHENTICATION_ERROR_MESSAGE,
        verification: VERIFY_ERROR_MESSAGE,
      }
    );

    if (responseDecision.type !== "success") {
      if (responseDecision.authenticationRequired) {
        failFlow(operationId, responseDecision.message, {
          requireSignIn: true,
        });
      } else if (responseDecision.retryable) {
        setErrorMessage(responseDecision.message);
        transitionToFlowState(FLOW_STATE.UPLOAD_ERROR);
      } else {
        failFlow(operationId, responseDecision.message);
      }
      return;
    }

    operationController.invalidate("success");
    operationTokenRef.current = null;
    submissionKeyStore.reset();
    setCameraStream(null);
    setCameraReady(false);
    setCapacity(null);
    setCurrentCapture(null);
    setCapturePending(false);
    setErrorMessage("");
    transitionToFlowState(FLOW_STATE.SUCCESS);

    try {
      await refreshVerifiedVisitConsumers({
        attractionId: selectedAttractionId,
        refreshVisitedAttractions: onVerified,
        publishPublicPhotoInvalidation:
          publishVerifiedVisitorPhotosInvalidation,
      });
    } catch {
      // Canonical consumers own and present refresh failures.
    }
  }, [
    capturePending,
    failFlow,
    flowState,
    onVerified,
    operationController,
    currentCapture,
    position,
    selectedAttractionId,
    submissionKeyStore,
    transitionToFlowState,
  ]);

  useLayoutEffect(() => {
    const transition = getVisitVerificationAuthenticationTransition(
      flowStateRef.current,
      authenticationState
    );
    operationController.updateAuthentication(authenticationConfirmed);

    setAuthenticationPromptVisible(transition.authenticationPromptVisible);
    setAuthenticationUnavailableVisible(
      transition.authenticationUnavailableVisible
    );

    if (authenticationConfirmed) {
      setSessionAuthenticationRequired(false);
      return;
    }

    operationTokenRef.current = null;
    submissionKeyStore.reset();

    if (transition.resetFlowData) {
      setCameraStream(null);
      setCameraReady(false);
      setCapacity(null);
      setCurrentCapture(null);
      setPosition(null);
      setCandidates([]);
      setSelectedAttractionId("");
      setErrorMessage("");
      setCapturePending(false);
      setSessionAuthenticationRequired(false);
    }

    transitionToFlowState(transition.nextFlowState);
  }, [
    authenticationConfirmed,
    authenticationState,
    operationController,
    submissionKeyStore,
    transitionToFlowState,
  ]);

  useEffect(() => {
    return () => {
      operationController.invalidate("unmount");
      operationTokenRef.current = null;
      submissionKeyStore.reset();
    };
  }, [operationController, submissionKeyStore]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !cameraStream) {
      return undefined;
    }

    video.srcObject = cameraStream;
    const operationId = operationTokenRef.current;
    const playback = video.play();

    playback?.catch((error) => {
      if (
        operationController.isActiveStream(cameraStream) &&
        operationController.isCurrent(operationId)
      ) {
        failFlow(operationId, getCameraErrorMessage(error));
      }
    });

    return () => {
      if (video.srcObject === cameraStream) {
        video.srcObject = null;
      }
    };
  }, [cameraStream, failFlow, operationController]);

  useEffect(() => {
    if (flowState === FLOW_STATE.PREVIEW) {
      uploadButtonRef.current?.focus();
      return;
    }

    if (flowState === FLOW_STATE.UPLOAD_ERROR) {
      uploadButtonRef.current?.focus();
      return;
    }

    if (flowState === FLOW_STATE.CAMERA && cameraReady) {
      captureButtonRef.current?.focus();
    }
  }, [cameraReady, flowState]);

  const uploadLabel = getVerifiedVisitUploadLabel();
  const uploadEnabled = canSubmitVerifiedVisitPhoto({
    flowState,
    currentCapture,
    capturePending,
    position,
    attractionId: selectedAttractionId,
  });

  return (
    <section
      className="mb-6 overflow-hidden rounded-3xl border border-[#B7E5D2] bg-[linear-gradient(135deg,#FFFFFF_0%,#F1F8F5_100%)] shadow-sm"
      aria-labelledby="visit-verification-heading"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006C56]">
            {t("verifiedVisitBadge")}
          </p>
          <h3
            id="visit-verification-heading"
            className="mt-1 text-xl font-bold text-[#10213B]"
          >
            {t("verifyNearbyPlace")}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#405066]">
            {t("verifyNearbyHint")}
          </p>
        </div>

        {flowState === FLOW_STATE.IDLE && (
          <button
            type="button"
            onClick={startVerification}
            disabled={authenticationPending}
            className={`${BUTTON_CLASS} w-full shrink-0 bg-[#006C56] text-white hover:bg-[#005E4B] sm:w-auto`}
          >
            {authenticationPending
              ? t("checkingSignIn")
              : t("verifyNearbyVisit")}
          </button>
        )}
      </div>

      {authenticationPromptVisible && effectiveAuthenticationRequired && (
        <div
          className="border-t border-[#B7E5D2] bg-white px-5 py-4 sm:px-6"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold text-[#10213B]">
            {t("signInBeforeVerify")}
          </p>
          <p className="mt-1 text-sm leading-6 text-[#405066]">
            {t("signInBeforeVerifyHint")}
          </p>
          <Link
            href="/login"
            className={`${BUTTON_CLASS} mt-3 w-full bg-[#006C56] text-white hover:bg-[#005E4B] sm:w-auto`}
          >
            {t("signIn")}
          </Link>
        </div>
      )}

      {authenticationUnavailableVisible &&
        authenticationUnavailable &&
        !effectiveAuthenticationRequired && (
          <div
            className="border-t border-[#E9B949] bg-[#FFF7DD] px-5 py-4 sm:px-6"
            role="status"
            aria-live="polite"
          >
            <p className="font-semibold text-[#704A00]">
              {t("signInStatusUnavailable")}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#704A00]">
              {t("signInStatusUnavailableHint")}
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              {typeof onAuthenticationRetry === "function" && (
                <button
                  type="button"
                  onClick={onAuthenticationRetry}
                  className={`${BUTTON_CLASS} w-full border border-[#B88924] bg-white text-[#704A00] hover:bg-[#FFF1C2] sm:w-auto`}
                >
                  {t("checkSignInAgain")}
                </button>
              )}
              <Link
                href="/login"
                className={`${BUTTON_CLASS} w-full bg-[#006C56] text-white hover:bg-[#005E4B] sm:w-auto`}
              >
                {t("signIn")}
              </Link>
            </div>
          </div>
        )}

      {flowState === FLOW_STATE.LOCATING && (
        <div
          className="border-t border-[#B7E5D2] bg-white px-5 py-5 sm:px-6"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold text-[#10213B]">
            {t("checkingLocation")}
          </p>
          <p className="mt-1 text-sm text-[#65748A]">
            {t("checkingLocationHint")}
          </p>
          <button
            type="button"
            onClick={closeFlow}
            className={`${BUTTON_CLASS} mt-4 w-full border border-[#BBC8D0] bg-white text-[#405066] hover:bg-[#F1F4F6] sm:w-auto`}
          >
            {t("cancel")}
          </button>
        </div>
      )}

      {flowState === FLOW_STATE.CHOOSING && (
        <div className="border-t border-[#B7E5D2] bg-white px-5 py-5 sm:px-6">
          <fieldset>
            <legend className="font-bold text-[#10213B]">
              {t("choosePlaceVisiting")}
            </legend>
            <p className="mt-1 text-sm leading-6 text-[#65748A]">
              {t("choosePlaceHint")}
            </p>
            <div className="mt-4 grid gap-3">
              {candidates.map((candidate) => {
                const { attraction, distanceLabel } = candidate;

                return (
                  <label
                    key={attraction.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-[#D8E1E7] px-4 py-3 text-left transition-colors motion-reduce:transition-none hover:border-[#72BFA5] hover:bg-[#F1F8F5] focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[#006C56]"
                  >
                    <input
                      type="radio"
                      name="nearby-attraction"
                      value={attraction.id}
                      checked={selectedAttractionId === attraction.id}
                      onChange={(event) =>
                        setSelectedAttractionId(event.target.value)
                      }
                      className="h-5 w-5 shrink-0 accent-[#006C56]"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-[#10213B]">
                        {attraction.name}
                      </span>
                      <span className="mt-0.5 block text-sm text-[#65748A]">
                        {distanceLabel}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeFlow}
              className={`${BUTTON_CLASS} border border-[#BBC8D0] bg-white text-[#405066] hover:bg-[#F1F4F6]`}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={continueWithSelectedAttraction}
              disabled={!selectedAttractionId}
              className={`${BUTTON_CLASS} bg-[#006C56] text-white hover:bg-[#005E4B]`}
            >
              {t("continueToCamera")}
            </button>
          </div>
        </div>
      )}

      {flowState === FLOW_STATE.CAPACITY && (
        <div
          className="border-t border-[#B7E5D2] bg-white px-5 py-5 sm:px-6"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold text-[#10213B]">
            {t("checkingPhotoLimit")}
          </p>
          <p className="mt-1 text-sm leading-6 text-[#65748A]">
            {t("checkingPhotoLimitHint")}
          </p>
          <button
            type="button"
            onClick={closeFlow}
            className={`${BUTTON_CLASS} mt-4 w-full border border-[#BBC8D0] bg-white text-[#405066] hover:bg-[#F1F4F6] sm:w-auto`}
          >
            {t("cancel")}
          </button>
        </div>
      )}

      {flowState === FLOW_STATE.LIMIT_REACHED && capacity && (
        <div
          className="border-t border-[#E9B949] bg-[#FFF7DD] px-5 py-5 sm:px-6"
          role="status"
          aria-live="polite"
        >
          <p className="font-bold text-[#704A00]">{t("limitFull")}</p>
          <p className="mt-1 text-sm leading-6 text-[#704A00]">
            {getVerifiedVisitLimitReachedMessage()}
          </p>
          <button
            type="button"
            onClick={closeFlow}
            className={`${BUTTON_CLASS} mt-4 w-full border border-[#B88924] bg-white text-[#704A00] hover:bg-[#FFF1C2] sm:w-auto`}
          >
            {t("close")}
          </button>
        </div>
      )}

      {[FLOW_STATE.CAMERA, FLOW_STATE.PREVIEW].includes(flowState) && (
        <div className="border-t border-[#B7E5D2] bg-[#10213B] p-4 sm:p-5">
          {selectedCandidate && (
            <p className="mb-3 text-sm font-semibold text-[#E6F7F0]">
              {candidates.length === 1
                ? t("autoSelected")
                : t("selectedLabel")}
              {selectedCandidate.attraction.name} ·{" "}
              {selectedCandidate.distanceLabel}
            </p>
          )}
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              aria-label={`Live camera preview${
                selectedCandidate
                  ? ` for ${selectedCandidate.attraction.name}`
                  : ""
              }`}
              onCanPlay={() => {
                if (operationController.isActiveStream(cameraStream)) {
                  setCameraReady(true);
                }
              }}
              className="h-full w-full object-cover"
            >
              Your browser does not support live camera preview.
            </video>
            {currentCapture && (
              <Image
                src={currentCapture.url}
                alt={`Current photo preview for ${
                  selectedCandidate?.attraction.name ||
                  "the selected attraction"
                }`}
                fill
                sizes="(max-width: 1280px) 100vw, 1100px"
                unoptimized
                className="object-contain"
              />
            )}
            {flowState === FLOW_STATE.CAMERA && !cameraReady && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-[#10213B] px-4 text-center text-sm font-semibold text-white"
                role="status"
                aria-live="polite"
              >
                {t("openingCamera")}
              </div>
            )}
          </div>
          {flowState === FLOW_STATE.PREVIEW && (
            <p className="mt-4 rounded-2xl border border-[#E9B949] bg-[#FFF7DD] px-4 py-3 text-sm font-semibold leading-6 text-[#704A00]">
              {t("photoPublicWarning")}
            </p>
          )}
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {flowState === FLOW_STATE.PREVIEW ? (
              <>
                <button
                  type="button"
                  onClick={retakePhoto}
                  className={`${BUTTON_CLASS} border border-[#8390A2] bg-transparent text-white hover:bg-white/10 focus-visible:outline-white`}
                >
                  {t("retake")}
                </button>
                <button
                  ref={uploadButtonRef}
                  type="button"
                  onClick={submitPhoto}
                  disabled={!uploadEnabled}
                  className={`${BUTTON_CLASS} bg-[#50D6A1] text-[#10213B] hover:bg-[#72E0B5] focus-visible:outline-white`}
                >
                  {uploadLabel}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={closeFlow}
                  className={`${BUTTON_CLASS} border border-[#8390A2] bg-transparent text-white hover:bg-white/10 focus-visible:outline-white`}
                >
                  {t("cancel")}
                </button>
                <button
                  ref={captureButtonRef}
                  type="button"
                  onClick={capturePhoto}
                  disabled={!cameraReady || capturePending}
                  className={`${BUTTON_CLASS} bg-white text-[#004638] hover:bg-[#E6F7F0] focus-visible:outline-white`}
                >
                  {capturePending ? t("capturing") : t("capturePhoto")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {flowState === FLOW_STATE.SUBMITTING && (
        <div
          className="border-t border-[#B7E5D2] bg-white p-5 sm:p-6"
          role="status"
          aria-live="polite"
        >
          <p className="font-bold text-[#10213B]">{t("uploadingPhoto")}</p>
          <p className="mt-1 text-sm leading-6 text-[#65748A]">
            {t("uploadingPhotoHint")}
          </p>
        </div>
      )}

      {flowState === FLOW_STATE.UPLOAD_ERROR && (
        <div
          className="border-t border-[#F0C8C5] bg-[#FFF8F7] p-5 sm:p-6"
          role="alert"
          aria-live="assertive"
        >
          <p className="font-bold text-[#8A2520]">{t("uploadPaused")}</p>
          <p className="mt-1 break-words text-sm leading-6 text-[#63312E]">
            {errorMessage} {t("photoStillReady")}
          </p>
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={closeFlow}
              className={`${BUTTON_CLASS} border border-[#D8B3AF] bg-white text-[#63312E] hover:bg-[#FBE9E8]`}
            >
              {t("cancel")}
            </button>
            {currentCapture && (
              <button
                ref={uploadButtonRef}
                type="button"
                onClick={submitPhoto}
                disabled={!uploadEnabled}
                className={`${BUTTON_CLASS} bg-[#006C56] text-white hover:bg-[#005E4B]`}
              >
                {uploadLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {flowState === FLOW_STATE.SUCCESS && (
        <div
          className="border-t border-[#B7E5D2] bg-[#E6F7F0] px-5 py-5 sm:px-6"
          role="status"
          aria-live="polite"
        >
          <p className="font-bold text-[#004638]">{t("visitVerified")}</p>
          <p className="mt-1 text-sm leading-6 text-[#31463F]">
            {t("visitVerifiedHint")}
          </p>
          <button
            type="button"
            onClick={closeFlow}
            className={`${BUTTON_CLASS} mt-3 w-full bg-[#006C56] text-white hover:bg-[#005E4B] sm:w-auto`}
          >
            {t("done")}
          </button>
        </div>
      )}

      {flowState === FLOW_STATE.ERROR && (
        <div
          className="border-t border-[#F0C8C5] bg-[#FFF8F7] px-5 py-5 sm:px-6"
          role="alert"
          aria-live="assertive"
        >
          <p className="font-bold text-[#8A2520]">{t("verificationPaused")}</p>
          <p className="mt-1 break-words text-sm leading-6 text-[#63312E]">
            {errorMessage}
          </p>
          {!effectiveAuthenticationRequired && (
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={closeFlow}
                className={`${BUTTON_CLASS} border border-[#D8B3AF] bg-white text-[#63312E] hover:bg-[#FBE9E8]`}
              >
                {t("close")}
              </button>
              <button
                type="button"
                onClick={startVerification}
                className={`${BUTTON_CLASS} bg-[#006C56] text-white hover:bg-[#005E4B]`}
              >
                {t("tryAgain")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}