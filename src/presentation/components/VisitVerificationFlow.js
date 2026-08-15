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
import { MAX_VISIT_DISTANCE_METRES } from "@/business/services/visitVerificationRules";
import {
  createVisitVerificationOperationController,
  createVerifiedVisitFormData,
  getCameraErrorMessage,
  getCandidateSelectionMode,
  getGeolocationErrorMessage,
  getNearbyCandidatePresentations,
  getVisitVerificationAuthenticationTransition,
  getVisitVerificationResponseDecision,
  normaliseBrowserPosition,
} from "@/presentation/lib/visitVerificationPresentation";

const FLOW_STATE = Object.freeze({
  IDLE: "idle",
  LOCATING: "locating",
  CHOOSING: "choosing",
  CAMERA: "camera",
  PREVIEW: "preview",
  SUBMITTING: "submitting",
  SUCCESS: "success",
  ERROR: "error",
});

const GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
});

const CAMERA_CONSTRAINTS = Object.freeze({
  video: { facingMode: { ideal: "environment" } },
  audio: false,
});

const VERIFY_ERROR_MESSAGE =
  "We could not verify this visit. Please try again.";
const AUTHENTICATION_ERROR_MESSAGE =
  "Your session has expired. Sign in and try again.";
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
  const videoRef = useRef(null);
  const operationTokenRef = useRef(null);
  const flowStateRef = useRef(FLOW_STATE.IDLE);
  const [operationController] = useState(() =>
    createVisitVerificationOperationController({
      authenticationConfirmed,
    })
  );
  const [flowState, setFlowState] = useState(FLOW_STATE.IDLE);
  const [position, setPosition] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedAttractionId, setSelectedAttractionId] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturePending, setCapturePending] = useState(false);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
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

  const releaseActiveStream = useCallback(() => {
    operationController.releaseStream();
    setCameraStream(null);
    setCameraReady(false);
  }, [operationController]);

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
      setCameraStream(null);
      setCameraReady(false);
      setPreviewUrl("");
      setPhotoBlob(null);
      setCapturePending(false);
      setErrorMessage(message);
      setSessionAuthenticationRequired(requireSignIn);
      setAuthenticationPromptVisible(requireSignIn);
      setAuthenticationUnavailableVisible(false);
      transitionToFlowState(FLOW_STATE.ERROR);
    },
    [operationController, transitionToFlowState]
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
          `No supported attraction is within ${MAX_VISIT_DISTANCE_METRES} metres of your current location.`
        );
        return;
      }

      if (selectionMode === "automatic") {
        const attractionId = nearbyCandidates[0].attraction.id;
        setSelectedAttractionId(attractionId);
        void openCamera(operationId, attractionId);
        return;
      }

      setSelectedAttractionId("");
      transitionToFlowState(FLOW_STATE.CHOOSING);
    },
    [
      failFlow,
      openCamera,
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
    setCameraStream(null);
    setCameraReady(false);
    setPreviewUrl("");
    setPosition(null);
    setCandidates([]);
    setSelectedAttractionId("");
    setPhotoBlob(null);
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

    navigator.geolocation.getCurrentPosition(
      (browserPosition) =>
        handleLocatedPosition(operationId, browserPosition),
      (error) => failFlow(operationId, getGeolocationErrorMessage(error)),
      GEOLOCATION_OPTIONS
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
    transitionToFlowState,
  ]);

  const closeFlow = useCallback(() => {
    operationController.invalidate("close");
    operationTokenRef.current = null;
    setCameraStream(null);
    setCameraReady(false);
    setPreviewUrl("");
    setPosition(null);
    setCandidates([]);
    setSelectedAttractionId("");
    setPhotoBlob(null);
    setErrorMessage("");
    setAuthenticationPromptVisible(false);
    setAuthenticationUnavailableVisible(false);
    setSessionAuthenticationRequired(false);
    setCapturePending(false);
    transitionToFlowState(FLOW_STATE.IDLE);
  }, [operationController, transitionToFlowState]);

  const continueWithSelectedAttraction = useCallback(() => {
    if (!selectedAttractionId) {
      return;
    }

    void openCamera(operationTokenRef.current, selectedAttractionId);
  }, [openCamera, selectedAttractionId]);

  const capturePhoto = useCallback(() => {
    if (
      flowState !== FLOW_STATE.CAMERA ||
      capturePending ||
      !cameraReady
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

          if (!blob) {
            failFlow(
              operationId,
              "The camera image could not be captured. Please try again."
            );
            return;
          }

          let objectUrl;
          try {
            objectUrl = URL.createObjectURL(blob);
          } catch {
            failFlow(
              operationId,
              "The photo preview could not be created. Please try again."
            );
            return;
          }

          if (!operationController.setPreview(operationId, objectUrl)) {
            return;
          }

          setPreviewUrl(objectUrl);
          setPhotoBlob(blob);
          setCapturePending(false);
          transitionToFlowState(FLOW_STATE.PREVIEW);
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
    } finally {
      releaseActiveStream();
    }
  }, [
    cameraReady,
    capturePending,
    failFlow,
    flowState,
    operationController,
    releaseActiveStream,
    transitionToFlowState,
  ]);

  const retakePhoto = useCallback(() => {
    const operationId = operationController.restartOperation("retake");

    if (operationId === null) {
      setAuthenticationUnavailableVisible(true);
      return;
    }

    operationTokenRef.current = operationId;
    setCameraStream(null);
    setCameraReady(false);
    setPreviewUrl("");
    setPhotoBlob(null);
    void openCamera(operationId, selectedAttractionId);
  }, [openCamera, operationController, selectedAttractionId]);

  const submitPhoto = useCallback(async () => {
    if (
      flowState !== FLOW_STATE.PREVIEW ||
      !photoBlob ||
      !position ||
      !selectedAttractionId
    ) {
      return;
    }

    const operationId = operationTokenRef.current;
    const requestController = new AbortController();

    if (
      !operationController.claimSubmission(
        operationId,
        requestController
      )
    ) {
      return;
    }

    transitionToFlowState(FLOW_STATE.SUBMITTING);

    let response;
    try {
      response = await fetch("/api/exploration-map/verified-visits", {
        method: "POST",
        body: createVerifiedVisitFormData({
          photoBlob,
          attractionId: selectedAttractionId,
          position,
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

      failFlow(operationId, VERIFY_ERROR_MESSAGE);
      return;
    }

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (
      !operationController.completeSubmission(
        operationId,
        requestController
      )
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
      failFlow(
        operationId,
        responseDecision.message,
        { requireSignIn: responseDecision.authenticationRequired }
      );
      return;
    }

    operationController.invalidate("success");
    operationTokenRef.current = null;
    setCameraStream(null);
    setCameraReady(false);
    setPreviewUrl("");
    setPhotoBlob(null);
    setCapturePending(false);
    setErrorMessage("");
    transitionToFlowState(FLOW_STATE.SUCCESS);

    try {
      await onVerified?.();
    } catch {
      // The canonical visited adapter owns and presents refresh failures.
    }
  }, [
    failFlow,
    flowState,
    onVerified,
    operationController,
    photoBlob,
    position,
    selectedAttractionId,
    transitionToFlowState,
  ]);

  useLayoutEffect(() => {
    const transition = getVisitVerificationAuthenticationTransition(
      flowStateRef.current,
      authenticationState
    );
    operationController.updateAuthentication(authenticationConfirmed);

    setAuthenticationPromptVisible(
      transition.authenticationPromptVisible
    );
    setAuthenticationUnavailableVisible(
      transition.authenticationUnavailableVisible
    );

    if (authenticationConfirmed) {
      setSessionAuthenticationRequired(false);
      return;
    }

    operationTokenRef.current = null;

    if (transition.resetFlowData) {
      setCameraStream(null);
      setCameraReady(false);
      setPreviewUrl("");
      setPosition(null);
      setCandidates([]);
      setSelectedAttractionId("");
      setPhotoBlob(null);
      setErrorMessage("");
      setCapturePending(false);
      setSessionAuthenticationRequired(false);
    }

    transitionToFlowState(transition.nextFlowState);
  }, [
    authenticationConfirmed,
    authenticationState,
    operationController,
    transitionToFlowState,
  ]);

  useEffect(() => {
    return () => {
      operationController.invalidate("unmount");
      operationTokenRef.current = null;
    };
  }, [operationController]);

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

  return (
    <section
      className="mb-6 overflow-hidden rounded-3xl border border-[#B7E5D2] bg-[linear-gradient(135deg,#FFFFFF_0%,#F1F8F5_100%)] shadow-sm"
      aria-labelledby="visit-verification-heading"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006C56]">
            Verified visit
          </p>
          <h3
            id="visit-verification-heading"
            className="mt-1 text-xl font-bold text-[#10213B]"
          >
            Verify a nearby place
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#405066]">
            When you start, Chatlas checks your current location once and then
            opens your live camera. It does not track your movement.
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
              ? "Checking sign-in..."
              : "Verify Nearby Visit"}
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
            Sign in before verifying a visit
          </p>
          <p className="mt-1 text-sm leading-6 text-[#405066]">
            Sign-in is required before Chatlas asks for location or camera
            permission.
          </p>
          <Link
            href="/login"
            className={`${BUTTON_CLASS} mt-3 w-full bg-[#006C56] text-white hover:bg-[#005E4B] sm:w-auto`}
          >
            Sign in
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
              Sign-in status unavailable
            </p>
            <p className="mt-1 text-sm leading-6 text-[#704A00]">
              Chatlas must confirm your sign-in before requesting location or
              camera permission. Try the check again or sign in.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              {typeof onAuthenticationRetry === "function" && (
                <button
                  type="button"
                  onClick={onAuthenticationRetry}
                  className={`${BUTTON_CLASS} w-full border border-[#B88924] bg-white text-[#704A00] hover:bg-[#FFF1C2] sm:w-auto`}
                >
                  Check sign-in again
                </button>
              )}
              <Link
                href="/login"
                className={`${BUTTON_CLASS} w-full bg-[#006C56] text-white hover:bg-[#005E4B] sm:w-auto`}
              >
                Sign in
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
            Checking your current location...
          </p>
          <p className="mt-1 text-sm text-[#65748A]">
            Keep this page open while your device finds a fresh GPS position.
          </p>
          <button
            type="button"
            onClick={closeFlow}
            className={`${BUTTON_CLASS} mt-4 w-full border border-[#BBC8D0] bg-white text-[#405066] hover:bg-[#F1F4F6] sm:w-auto`}
          >
            Cancel
          </button>
        </div>
      )}

      {flowState === FLOW_STATE.CHOOSING && (
        <div className="border-t border-[#B7E5D2] bg-white px-5 py-5 sm:px-6">
          <fieldset>
            <legend className="font-bold text-[#10213B]">
              Choose the place you are visiting
            </legend>
            <p className="mt-1 text-sm leading-6 text-[#65748A]">
              Several supported attractions are nearby. Select one to continue.
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
              Cancel
            </button>
            <button
              type="button"
              onClick={continueWithSelectedAttraction}
              disabled={!selectedAttractionId}
              className={`${BUTTON_CLASS} bg-[#006C56] text-white hover:bg-[#005E4B]`}
            >
              Continue to camera
            </button>
          </div>
        </div>
      )}

      {flowState === FLOW_STATE.CAMERA && (
        <div className="border-t border-[#B7E5D2] bg-[#10213B] p-4 sm:p-5">
          {selectedCandidate && (
            <p className="mb-3 text-sm font-semibold text-[#E6F7F0]">
              {candidates.length === 1 ? "Automatically selected: " : "Selected: "}
              {selectedCandidate.attraction.name} · {selectedCandidate.distanceLabel}
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
            {!cameraReady && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-[#10213B] px-4 text-center text-sm font-semibold text-white"
                role="status"
                aria-live="polite"
              >
                Opening live camera...
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeFlow}
              className={`${BUTTON_CLASS} border border-[#8390A2] bg-transparent text-white hover:bg-white/10 focus-visible:outline-white`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              disabled={!cameraReady || capturePending}
              className={`${BUTTON_CLASS} bg-white text-[#004638] hover:bg-[#E6F7F0] focus-visible:outline-white`}
            >
              {capturePending ? "Capturing..." : "Capture photo"}
            </button>
          </div>
        </div>
      )}

      {[FLOW_STATE.PREVIEW, FLOW_STATE.SUBMITTING].includes(flowState) &&
        previewUrl && (
          <div className="border-t border-[#B7E5D2] bg-white p-4 sm:p-5">
            <p className="mb-3 text-sm font-semibold text-[#10213B]">
              Photo preview for {selectedCandidate?.attraction.name || "your visit"}
            </p>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-[#10213B]">
              <Image
                src={previewUrl}
                alt={`Preview of live photo for ${
                  selectedCandidate?.attraction.name || "the selected attraction"
                }`}
                fill
                sizes="(max-width: 1280px) 100vw, 1100px"
                unoptimized
                className="object-contain"
              />
            </div>
            <p className="mt-4 rounded-2xl border border-[#E9B949] bg-[#FFF7DD] px-4 py-3 text-sm font-semibold leading-6 text-[#704A00]">
              This photo will be publicly visible. Avoid capturing faces or private information.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeFlow}
                className={`${BUTTON_CLASS} border border-[#BBC8D0] bg-white text-[#405066] hover:bg-[#F1F4F6]`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={retakePhoto}
                disabled={flowState === FLOW_STATE.SUBMITTING}
                className={`${BUTTON_CLASS} border border-[#BBC8D0] bg-white text-[#405066] hover:bg-[#F1F4F6]`}
              >
                Retake
              </button>
              <button
                type="button"
                onClick={submitPhoto}
                disabled={flowState === FLOW_STATE.SUBMITTING}
                className={`${BUTTON_CLASS} bg-[#006C56] text-white hover:bg-[#005E4B]`}
              >
                {flowState === FLOW_STATE.SUBMITTING
                  ? "Verifying visit..."
                  : "Use Photo"}
              </button>
            </div>
          </div>
        )}

      {flowState === FLOW_STATE.SUCCESS && (
        <div
          className="border-t border-[#B7E5D2] bg-[#E6F7F0] px-5 py-5 sm:px-6"
          role="status"
          aria-live="polite"
        >
          <p className="font-bold text-[#004638]">Visit verified</p>
          <p className="mt-1 text-sm leading-6 text-[#31463F]">
            Your public photo was saved. Your exploration progress is refreshing.
          </p>
          <button
            type="button"
            onClick={closeFlow}
            className={`${BUTTON_CLASS} mt-3 w-full bg-[#006C56] text-white hover:bg-[#005E4B] sm:w-auto`}
          >
            Done
          </button>
        </div>
      )}

      {flowState === FLOW_STATE.ERROR && (
        <div
          className="border-t border-[#F0C8C5] bg-[#FFF8F7] px-5 py-5 sm:px-6"
          role="alert"
          aria-live="assertive"
        >
          <p className="font-bold text-[#8A2520]">Verification paused</p>
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
                Close
              </button>
              <button
                type="button"
                onClick={startVerification}
                className={`${BUTTON_CLASS} bg-[#006C56] text-white hover:bg-[#005E4B]`}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
