"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { lookupMolecule } from "../lib/pubchem";
import {
  ArrowRight,
  Atom,
  CirclePause,
  CirclePlay,
  Gauge,
  Hand as HandIcon,
  Info,
  Layers3,
  LoaderCircle,
  MousePointer2,
  Orbit,
  Palette,
  RotateCcw,
  Search,
  Sparkles,
  Waves,
  X,
} from "lucide-react";

type AtomDatum = { element: string; position: [number, number, number] };
type Molecule = {
  id: string;
  name: string;
  subtitle: string;
  formula: string;
  mass: string;
  geometry: string;
  note: string;
  accent: string;
  atoms: AtomDatum[];
  bonds: [number, number, number?][];
};
type RenderStyle = "velvet" | "aurora" | "xray";
type ModelStyle = "ball" | "space" | "wire";
type Quality = "auto" | "eco" | "high";
type ColorMode = "chrome" | "spectrum";
type HandStatus = "off" | "loading" | "ready" | "grabbing" | "lost" | "error";
type HandControlState = { x: number; y: number; velocityX: number; velocityY: number; grabbing: boolean; enabled: boolean };

type HandLandmark = { x: number; y: number; z: number };
type HandLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => { landmarks?: HandLandmark[][] };
  close: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const distance2D = (a: HandLandmark, b: HandLandmark) => Math.hypot(a.x - b.x, a.y - b.y);
const handConnections: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const chromePalette: Record<string, string> = {
  C: "#777b81",
  H: "#ffffff",
  N: "#d9dce0",
  O: "#f7f7f7",
  S: "#a7aaae",
  P: "#c3c5c8",
};

const spectrumPalette: Record<string, string> = {
  H: "#f7f9fc", C: "#364354", N: "#4e7dff", O: "#ff5e70",
  S: "#f4bd43", P: "#a678ff", F: "#52d69a", Cl: "#42c89a",
  Br: "#a15bdd", I: "#e553a0", B: "#dc82ff", Si: "#ed754a",
  Fe: "#de7045", Mg: "#46cbd0", Na: "#689fff", K: "#c66cff",
};

const caffeine: Molecule = {
  id: "caffeine",
  name: "Caffeine",
  subtitle: "A familiar alkaloid",
  formula: "C₈H₁₀N₄O₂",
  mass: "194.19 g·mol⁻¹",
  geometry: "Fused heterocycle",
  note: "A compact purine alkaloid built around a conjugated xanthine core. The three methyl groups give the structure its unmistakable silhouette.",
  accent: "#f4f4f2",
  atoms: [
    { element: "C", position: [3.8881, -0.6501, 3.8162] },
    { element: "N", position: [3.0297, -1.3036, 2.8875] },
    { element: "C", position: [3.3035, -2.5669, 2.3707] },
    { element: "N", position: [2.4063, -2.9983, 1.5654] },
    { element: "C", position: [1.4263, -2.0498, 1.4876] },
    { element: "C", position: [1.8251, -1.0150, 2.3278] },
    { element: "C", position: [0.8916, 0.1381, 2.4792] },
    { element: "O", position: [1.2294, 1.0627, 3.1874] },
    { element: "N", position: [-0.3428, 0.0935, 1.8173] },
    { element: "C", position: [-1.2306, 1.2026, 1.9454] },
    { element: "C", position: [-0.6430, -0.9830, 0.9712] },
    { element: "O", position: [-1.7086, -0.9833, 0.3507] },
    { element: "N", position: [0.2212, -2.0628, 0.7822] },
    { element: "C", position: [-0.1295, -3.1508, -0.0660] },
  ],
  bonds: [
    [0, 1], [1, 2], [2, 3, 2], [3, 4], [4, 5, 2], [1, 5], [5, 6],
    [6, 7, 2], [6, 8], [8, 9], [8, 10], [10, 11, 2], [10, 12], [4, 12], [12, 13],
  ],
};

const aspirin: Molecule = {
  id: "aspirin",
  name: "Aspirin",
  subtitle: "The century-old classic",
  formula: "C₉H₈O₄",
  mass: "180.16 g·mol⁻¹",
  geometry: "Aromatic ester",
  note: "Acetylsalicylic acid pairs a planar aromatic ring with carboxylic acid and ester groups—simple architecture with an enormous medical legacy.",
  accent: "#a9acb0",
  atoms: [
    { element: "C", position: [-1.25, 0.7, 0] }, { element: "C", position: [0, 1.4, 0.08] },
    { element: "C", position: [1.25, 0.7, 0] }, { element: "C", position: [1.25, -0.7, -0.06] },
    { element: "C", position: [0, -1.4, 0] }, { element: "C", position: [-1.25, -0.7, 0.05] },
    { element: "C", position: [2.55, 1.42, 0.02] }, { element: "O", position: [3.65, 0.8, -0.05] },
    { element: "O", position: [2.6, 2.7, 0.12] }, { element: "O", position: [2.42, -1.4, -0.12] },
    { element: "C", position: [3.54, -2.03, 0.05] }, { element: "O", position: [4.65, -1.48, 0.12] },
    { element: "C", position: [3.44, -3.52, -0.22] },
  ],
  bonds: [[0,1,2],[1,2],[2,3,2],[3,4],[4,5,2],[5,0],[2,6],[6,7],[6,8,2],[3,9],[9,10],[10,11,2],[10,12]],
};

const serotonin: Molecule = {
  id: "serotonin",
  name: "Serotonin",
  subtitle: "A molecular messenger",
  formula: "C₁₀H₁₂N₂O",
  mass: "176.22 g·mol⁻¹",
  geometry: "Indole ethylamine",
  note: "A flexible ethylamine tail extends from a rigid indole system. Its shape and hydrogen-bonding groups help it communicate with diverse receptors.",
  accent: "#d5d5d2",
  atoms: [
    { element: "C", position: [-2.2, .8, 0] }, { element: "C", position: [-1.05, 1.5, .05] },
    { element: "C", position: [.15, .82, 0] }, { element: "C", position: [.15, -.55, -.05] },
    { element: "C", position: [-1.05, -1.25, 0] }, { element: "C", position: [-2.2, -.58, .06] },
    { element: "C", position: [1.45, 1.28, 0] }, { element: "N", position: [2.18, .18, .05] },
    { element: "C", position: [1.4, -.88, -.02] }, { element: "O", position: [-3.38, 1.48, .15] },
    { element: "C", position: [1.72, -2.35, .4] }, { element: "C", position: [3.08, -2.72, -.15] },
    { element: "N", position: [3.42, -4.05, .35] },
  ],
  bonds: [[0,1,2],[1,2],[2,3],[3,4,2],[4,5],[5,0,2],[2,6],[6,7],[7,8],[8,3,2],[0,9],[8,10],[10,11],[11,12]],
};

const carbonDioxide: Molecule = {
  id: "carbon-dioxide",
  name: "Carbon dioxide",
  subtitle: "Linear, quiet, consequential",
  formula: "CO₂",
  mass: "44.01 g·mol⁻¹",
  geometry: "Linear / 180°",
  note: "Three atoms, two double bonds, one perfectly linear molecule. A minimal structure at the center of climate, biology, and carbon-cycle chemistry.",
  accent: "#ffffff",
  atoms: [
    { element: "O", position: [-2.15, 0, 0] }, { element: "C", position: [0, 0, 0] },
    { element: "O", position: [2.15, 0, 0] },
  ],
  bonds: [[0,1,2],[1,2,2]],
};

const molecules = [caffeine, aspirin, serotonin, carbonDioxide];

const atomRadius: Record<string, number> = { H: .26, C: .47, N: .5, O: .5, S: .58, P: .56 };

function HandControl({
  enabled,
  handControlRef,
  onGrabChange,
  onStatus,
}: {
  enabled: boolean;
  handControlRef: { current: HandControlState };
  onGrabChange: (grabbing: boolean) => void;
  onStatus: (status: HandStatus) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarkerLike | null>(null);
  const onGrabChangeRef = useRef(onGrabChange);
  const onStatusRef = useRef(onStatus);
  const [minimized, setMinimized] = useState(false);
  const [status, setStatus] = useState<HandStatus>("off");

  const drawOverlay = (landmarks: HandLandmark[] | undefined, grabbing = false) => {
    const video = videoRef.current;
    const canvas = overlayRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth || 320;
    const height = video.videoHeight || 240;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (!landmarks || landmarks.length < 21) return;
    const point = (landmark: HandLandmark) => ({ x: landmark.x * width, y: landmark.y * height });
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#49efff");
    gradient.addColorStop(.52, grabbing ? "#fff2a8" : "#a9b9ff");
    gradient.addColorStop(1, "#ff4ccf");
    context.save();
    context.lineWidth = Math.max(2, width / 150);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = gradient;
    context.shadowColor = grabbing ? "rgba(255, 212, 98, .8)" : "rgba(73, 239, 255, .7)";
    context.shadowBlur = Math.max(4, width / 80);
    handConnections.forEach(([start, end]) => {
      const a = point(landmarks[start]);
      const b = point(landmarks[end]);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    });
    if (grabbing) {
      const thumb = point(landmarks[4]);
      const index = point(landmarks[8]);
      context.lineWidth = Math.max(3, width / 105);
      context.strokeStyle = "#fff0a6";
      context.shadowColor = "rgba(255, 214, 92, .95)";
      context.beginPath();
      context.moveTo(thumb.x, thumb.y);
      context.lineTo(index.x, index.y);
      context.stroke();
    }
    context.shadowBlur = Math.max(3, width / 100);
    landmarks.forEach((landmark, index) => {
      const current = point(landmark);
      const isPinchPoint = index === 4 || index === 8;
      context.beginPath();
      context.fillStyle = isPinchPoint && grabbing ? "#fff0a6" : index === 0 ? "#ff5bcf" : "#eafcff";
      context.arc(current.x, current.y, isPinchPoint ? Math.max(4, width / 115) : Math.max(2.4, width / 185), 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
  };

  useEffect(() => {
    onGrabChangeRef.current = onGrabChange;
    onStatusRef.current = onStatus;
  }, [onGrabChange, onStatus]);

  useEffect(() => {
    const handState = handControlRef.current;
    let disposed = false;
    let timer = 0;
    let lastVideoTime = -1;
    let lastDetectionTime = performance.now();
    let lastSeenTime = 0;
    let lastCenter: { x: number; y: number } | null = null;
    let smoothedDelta = { x: 0, y: 0 };
    let wasGrabbing = false;
    let lastStatus: HandStatus | null = null;

    const reportStatus = (status: HandStatus) => {
      if (lastStatus !== status) {
        lastStatus = status;
        setStatus(status);
        onStatusRef.current(status);
      }
    };

    const stopCamera = () => {
      if (timer) window.clearTimeout(timer);
      timer = 0;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    if (!enabled) {
      handState.enabled = false;
      handState.grabbing = false;
      handState.x = 0;
      handState.y = 0;
      handState.velocityX = 0;
      handState.velocityY = 0;
      reportStatus("off");
      return () => stopCamera();
    }

    handState.enabled = true;
    reportStatus("loading");

    const processFrame = () => {
      if (disposed) return;
      timer = window.setTimeout(processFrame, 1000 / 28);
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (video.currentTime === lastVideoTime) return;

      lastVideoTime = video.currentTime;
      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      const landmarks = result.landmarks?.[0];
      const elapsed = clamp((now - lastDetectionTime) / 1000, .016, .12);
      lastDetectionTime = now;

      if (!landmarks || landmarks.length < 21) {
        if (wasGrabbing && now - lastSeenTime < 240) return;
        if (wasGrabbing) {
          wasGrabbing = false;
          handState.grabbing = false;
          onGrabChangeRef.current(false);
        }
        reportStatus(lastSeenTime && now - lastSeenTime < 700 ? "lost" : "loading");
        drawOverlay(undefined);
        lastCenter = null;
        smoothedDelta = { x: 0, y: 0 };
        return;
      }

      lastSeenTime = now;
      const thumb = landmarks[4];
      const index = landmarks[8];
      const center = { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 };
      const pinchDistance = distance2D(thumb, index);
      const pinch = wasGrabbing ? pinchDistance < .085 : pinchDistance < .058;
      const wrist = landmarks[0];
      const extendedFingers = [[8, 6, 5], [12, 10, 9], [16, 14, 13], [20, 18, 17]].filter(([tip, pip, mcp]) => {
        const tipPoint = landmarks[tip];
        const pipPoint = landmarks[pip];
        const mcpPoint = landmarks[mcp];
        return tipPoint.y < pipPoint.y - .012 && distance2D(tipPoint, wrist) > distance2D(mcpPoint, wrist) * 1.03;
      }).length;
      const openHand = extendedFingers >= 3;

      if (pinch && !wasGrabbing) {
        wasGrabbing = true;
        lastCenter = center;
        smoothedDelta = { x: 0, y: 0 };
        handState.velocityX = 0;
        handState.velocityY = 0;
        handState.grabbing = true;
        onGrabChangeRef.current(true);
      } else if (!pinch && wasGrabbing) {
        wasGrabbing = false;
        lastCenter = null;
        smoothedDelta = { x: 0, y: 0 };
        handState.grabbing = false;
        onGrabChangeRef.current(false);
      }

      if (wasGrabbing && lastCenter) {
        const dx = center.x - lastCenter.x;
        const dy = center.y - lastCenter.y;
        lastCenter = center;
        const targetX = Math.abs(dy) < .004 ? 0 : clamp(-dy * 4.8, -.14, .14);
        const targetY = Math.abs(dx) < .004 ? 0 : clamp(dx * 5.4, -.16, .16);
        const smoothing = 1 - Math.exp(-elapsed / .085);
        smoothedDelta.x += (targetX - smoothedDelta.x) * smoothing;
        smoothedDelta.y += (targetY - smoothedDelta.y) * smoothing;
        handState.x = clamp(handState.x + smoothedDelta.x, -Math.PI * 4, Math.PI * 4);
        handState.y = clamp(handState.y + smoothedDelta.y, -Math.PI * 4, Math.PI * 4);
        handState.velocityX = clamp(smoothedDelta.x / elapsed, -.95, .95);
        handState.velocityY = clamp(smoothedDelta.y / elapsed, -1.1, 1.1);
      }

      reportStatus(wasGrabbing ? "grabbing" : openHand ? "ready" : "lost");
      drawOverlay(landmarks, wasGrabbing);
    };

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API unavailable");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 320, max: 480 }, height: { ideal: 240, max: 360 }, frameRate: { ideal: 28, max: 30 } },
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("Video preview unavailable");
        video.srcObject = stream;
        await video.play();

        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm");
        const options = {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU" as const,
          },
          runningMode: "VIDEO" as const,
          numHands: 1,
          minHandDetectionConfidence: .62,
          minHandPresenceConfidence: .58,
          minTrackingConfidence: .56,
        };
        let detector: HandLandmarkerLike;
        try {
          detector = await HandLandmarker.createFromOptions(vision, options) as unknown as HandLandmarkerLike;
        } catch {
          detector = await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" as const } }) as unknown as HandLandmarkerLike;
        }
        if (disposed) {
          detector.close();
          return;
        }
        landmarkerRef.current = detector;
        reportStatus("loading");
        processFrame();
      } catch (error) {
        if (!disposed) {
          drawOverlay(undefined);
          reportStatus("error");
        }
        console.warn("MediaPipe hand control could not start", error);
      }
    };

    void start();
    return () => {
      disposed = true;
      if (wasGrabbing) onGrabChangeRef.current(false);
      handState.enabled = false;
      handState.grabbing = false;
      handState.velocityX = 0;
      handState.velocityY = 0;
      drawOverlay(undefined);
      stopCamera();
    };
  }, [enabled, handControlRef]);

  if (!enabled) return null;
  const statusLabel: Record<HandStatus, string> = {
    off: "OFF", loading: "SEARCHING", ready: "READY", grabbing: "GRABBING", lost: "TRACKING LOST", error: "CAMERA ERROR",
  };
  return (
    <div className={`hand-panel${minimized ? " minimized" : ""}`} data-hand-status={status}>
      <div className="hand-video-wrap">
        <video ref={videoRef} className="hand-video" muted playsInline autoPlay aria-label="Mirrored hand tracking camera preview" />
        <canvas ref={overlayRef} className="hand-overlay" aria-hidden="true" />
      </div>
      <div className="hand-panel-bar"><span><i /> HAND / {statusLabel[status]}</span><button onClick={() => setMinimized((value) => !value)} aria-label={minimized ? "Show hand camera preview" : "Minimize hand camera preview"}>{minimized ? "+" : "–"}</button></div>
      <p>{minimized ? status === "error" ? "CAMERA UNAVAILABLE" : "CAMERA ACTIVE" : "PINCH TO GRAB · MOVE TO ORBIT"}</p>
    </div>
  );
}

function MolecularScene({ molecule, autoRotate, showOrbitRings, trippyMode, colorMode, renderStyle, modelStyle, quality, resetSignal, handControlRef }: {
  molecule: Molecule;
  autoRotate: boolean;
  showOrbitRings: boolean;
  trippyMode: boolean;
  colorMode: ColorMode;
  renderStyle: RenderStyle;
  modelStyle: ModelStyle;
  quality: Quality;
  resetSignal: number;
  handControlRef: { current: HandControlState };
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const autoRotateRef = useRef(autoRotate);
  const showOrbitRingsRef = useRef(showOrbitRings);
  const [hover, setHover] = useState<{ element: string; x: number; y: number } | null>(null);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    showOrbitRingsRef.current = showOrbitRings;
  }, [showOrbitRings]);

  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const lowPowerDevice = window.matchMedia("(max-width: 760px)").matches ||
      navigator.hardwareConcurrency <= 4 || deviceMemory <= 4;
    const effectiveQuality = quality === "auto" ? (lowPowerDevice ? "eco" : "auto") : quality;
    const isEco = effectiveQuality === "eco";
    const isHigh = effectiveQuality === "high";
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(colorMode === "spectrum" ? 0x111925 : 0x030303, trippyMode ? .046 : .034);
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
    camera.position.set(0, 1.2, 12);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !isEco, alpha: true, powerPreference: "high-performance" });
      delete host.dataset.webglUnavailable;
    } catch {
      host.dataset.webglUnavailable = "true";
      return;
    }
    const targetPixelRatio = isEco ? 1 : isHigh ? Math.min(window.devicePixelRatio, 1.75) : Math.min(window.devicePixelRatio, 1.35);
    renderer.setPixelRatio(targetPixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = trippyMode ? 1.72 : colorMode === "spectrum" ? (renderStyle === "aurora" ? 1.72 : 1.42) : renderStyle === "aurora" ? 1.55 : 1.2;
    host.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, renderStyle === "xray" ? 2.2 : colorMode === "spectrum" ? 1.02 : .75);
    scene.add(ambient);
    const key = new THREE.PointLight(0xffffff, 24, 28);
    key.position.set(4, 5, 7);
    scene.add(key);
    const rim = new THREE.PointLight(colorMode === "spectrum" ? 0x7f9fff : 0xbcc2ca, 24, 25);
    rim.position.set(-6, -3, -4);
    scene.add(rim);
    const warm = new THREE.PointLight(colorMode === "spectrum" ? 0xff8494 : 0x73777d, colorMode === "spectrum" ? 20 : 16, 20);
    warm.position.set(6, -4, 1);
    scene.add(warm);
    const cyanLaser = trippyMode ? new THREE.PointLight(0x45efff, isEco ? 8 : 17, 22, 1.7) : null;
    const magentaLaser = trippyMode ? new THREE.PointLight(0xff3bc8, isEco ? 7 : 15, 22, 1.7) : null;
    if (cyanLaser && magentaLaser) {
      cyanLaser.position.set(-5, 1, 4);
      magentaLaser.position.set(5, -2, 3);
      scene.add(cyanLaser, magentaLaser);
    }

    const root = new THREE.Group();
    const atomGroup = new THREE.Group();
    root.add(atomGroup);
    scene.add(root);

    const baseSphereDetail = modelStyle === "wire" ? (isHigh ? 2 : 1) : isEco ? 2 : isHigh ? 4 : 3;
    const complexityPenalty = molecule.atoms.length > 120 ? 2 : molecule.atoms.length > 60 ? 1 : 0;
    const sphereDetail = Math.max(1, baseSphereDetail - complexityPenalty);
    const atomGeometry = new THREE.IcosahedronGeometry(1, sphereDetail);
    molecule.atoms.forEach((atom, index) => {
      const activePalette = colorMode === "spectrum" ? spectrumPalette : chromePalette;
      const baseColor = new THREE.Color(activePalette[atom.element] ?? (colorMode === "spectrum" ? "#a9b4c4" : "#ddd"));
      let material: THREE.Material;
      if (renderStyle === "xray") {
        material = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: .22, wireframe: true });
      } else if (trippyMode && !isEco) {
        const laserColor = new THREE.Color([0x45efff, 0xa06cff, 0xff3bc8][index % 3]);
        material = new THREE.MeshPhysicalMaterial({
          color: baseColor.clone().lerp(new THREE.Color(index % 2 ? 0xffffff : 0x25282c), .32).lerp(laserColor, .085),
          roughness: .018,
          metalness: 1,
          clearcoat: 1,
          clearcoatRoughness: .012,
          iridescence: 1,
          iridescenceIOR: 1.72,
          iridescenceThicknessRange: [120, 780],
          emissive: baseColor.clone().multiplyScalar(.11),
          emissiveIntensity: .16,
        });
      } else if (isEco) {
        material = new THREE.MeshStandardMaterial({
          color: baseColor.clone().lerp(new THREE.Color(0xffffff), colorMode === "spectrum" ? .08 : .18),
          roughness: .16,
          metalness: .9,
          emissive: baseColor.clone().multiplyScalar(.035),
          emissiveIntensity: .05,
        });
      } else {
        material = new THREE.MeshPhysicalMaterial({
          color: renderStyle === "aurora" ? baseColor.clone().lerp(new THREE.Color(0xffffff), colorMode === "spectrum" ? .12 : .22) : baseColor,
          roughness: renderStyle === "velvet" ? .24 : .055,
          metalness: renderStyle === "aurora" ? .96 : .5,
          clearcoat: 1,
          clearcoatRoughness: .04,
          iridescence: renderStyle === "aurora" ? .75 : .12,
          iridescenceIOR: 1.5,
          iridescenceThicknessRange: [180, 520],
          emissive: renderStyle === "aurora" ? baseColor.clone().multiplyScalar(colorMode === "spectrum" ? .12 : .08) : new THREE.Color(0x000000),
          emissiveIntensity: renderStyle === "aurora" ? (colorMode === "spectrum" ? .11 : .08) : 0,
        });
      }
      const mesh = new THREE.Mesh(atomGeometry, material);
      const scaleBase = modelStyle === "space" ? 1.42 : modelStyle === "wire" ? .72 : 1;
      const scale = (atomRadius[atom.element] ?? .45) * scaleBase;
      mesh.scale.setScalar(scale);
      mesh.position.set(...atom.position);
      mesh.userData = { element: atom.element, atomIndex: index, baseScale: scale };
      atomGroup.add(mesh);
    });

    const bondMaterial = new THREE.MeshStandardMaterial({
      color: trippyMode ? (colorMode === "spectrum" ? "#dbe4f4" : "#f2f2ef") : renderStyle === "aurora" ? (colorMode === "spectrum" ? "#b9c8df" : "#d7d9dc") : "#777b80",
      roughness: .16,
      metalness: .82,
      transparent: renderStyle === "xray",
      opacity: renderStyle === "xray" ? .26 : .82,
      emissive: trippyMode ? "#4a4a4a" : renderStyle === "aurora" ? "#282828" : "#000000",
      emissiveIntensity: trippyMode ? .28 : renderStyle === "aurora" ? .12 : 0,
    });
    const bondRadius = modelStyle === "wire" ? .035 : .095;
    const makeBond = (a: THREE.Vector3, b: THREE.Vector3, offset = 0) => {
      const direction = new THREE.Vector3().subVectors(b, a);
      const midpoint = new THREE.Vector3().addVectors(a, b).multiplyScalar(.5);
      if (offset) {
        const perp = new THREE.Vector3(-direction.y, direction.x, .4).normalize().multiplyScalar(offset);
        a = a.clone().add(perp); b = b.clone().add(perp); midpoint.add(perp);
      }
      const geometry = new THREE.CylinderGeometry(bondRadius, bondRadius, direction.length(), isEco ? 7 : isHigh ? 14 : 10);
      const bond = new THREE.Mesh(geometry, bondMaterial);
      bond.position.copy(midpoint);
      bond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      root.add(bond);
    };
    if (modelStyle !== "space") molecule.bonds.forEach(([a, b, order]) => {
      const p1 = new THREE.Vector3(...molecule.atoms[a].position);
      const p2 = new THREE.Vector3(...molecule.atoms[b].position);
      if (order === 2) { makeBond(p1, p2, -.075); makeBond(p1, p2, .075); }
      else makeBond(p1, p2);
    });

    const bounds = new THREE.Box3().setFromObject(root);
    const center = bounds.getCenter(new THREE.Vector3());
    root.position.sub(center);
    const size = bounds.getSize(new THREE.Vector3()).length();
    const fit = Math.min(1.35, 6.8 / Math.max(size, 1));
    root.scale.setScalar(fit);
    root.position.copy(center).multiplyScalar(-fit);
    root.rotation.set(-.28, -.55, .08);
    const basePosition = root.position.clone();
    const baseRotation = root.rotation.clone();

    const ghostField = new THREE.Group();
    if (trippyMode && !isEco) {
      const makeGhost = (color: number, opacity: number, scale: number) => {
        const ghost = root.clone(true);
        const ghostMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
        ghost.traverse((object) => { if (object instanceof THREE.Mesh) object.material = ghostMaterial; });
        ghost.scale.multiplyScalar(scale);
        ghost.userData.basePosition = ghost.position.clone();
        ghost.userData.baseRotation = ghost.rotation.clone();
        ghostField.add(ghost);
        return ghost;
      };
      makeGhost(0x45efff, .041, 1.018).userData.phase = 0;
      makeGhost(0xff3bc8, .034, .984).userData.phase = Math.PI;
      scene.add(ghostField);
    }

    const halo = new THREE.Group();
    [3.4, 4.25, 5.1].forEach((radius, index) => {
      const haloGeo = new THREE.TorusGeometry(radius, .012 + index * .006, isEco ? 4 : 6, isEco ? 56 : isHigh ? 160 : 96);
      const haloColor = trippyMode ? [0x45efff, 0xa06cff, 0xff3bc8][index] : (index === 1 ? 0xffffff : 0x8f949b);
      const haloMat = new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: (trippyMode ? .115 : .1) - index * .018, depthWrite: false });
      const ring = new THREE.Mesh(haloGeo, haloMat);
      ring.rotation.set(.4 + index * .36, .18 - index * .3, index * .7);
      halo.add(ring);
    });
    halo.scale.set(1.05, .68, 1);
    scene.add(halo);

    const tripGeometry = trippyMode && !isEco ? new THREE.TorusKnotGeometry(4.35, .022, isHigh ? 220 : 150, 4, 2, 5) : null;
    const tripMaterial = tripGeometry ? new THREE.MeshBasicMaterial({ color: 0xa06cff, transparent: true, opacity: .07, wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending }) : null;
    const tripKnot = tripGeometry && tripMaterial ? new THREE.Mesh(tripGeometry, tripMaterial) : null;
    if (tripKnot) { tripKnot.scale.set(1.05, .72, 1); tripKnot.rotation.set(.5, -.2, .3); scene.add(tripKnot); }

    const dustGeo = new THREE.BufferGeometry();
    const dustCount = isEco ? 60 : isHigh ? 220 : 130;
    const dust = new Float32Array(dustCount * 3);
    for (let i = 0; i < dust.length; i += 3) {
      dust[i] = (Math.random() - .5) * 24;
      dust[i + 1] = (Math.random() - .5) * 15;
      dust[i + 2] = (Math.random() - .5) * 15 - 2;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dust, 3));
    const dustMat = new THREE.PointsMaterial({ color: trippyMode ? (colorMode === "spectrum" ? 0x9ab8ff : 0x95dfff) : 0xd7d9dc, size: .022, transparent: true, opacity: trippyMode ? .28 : .24 });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .055;
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 19;
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = .7;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(4, 4);
    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(atomGroup.children);
      if (hits[0]) {
        renderer.domElement.style.cursor = "crosshair";
        setHover({ element: hits[0].object.userData.element, x: event.clientX - rect.left, y: event.clientY - rect.top });
      } else {
        renderer.domElement.style.cursor = "grab";
        setHover(null);
      }
    };
    const clearHover = () => setHover(null);
    const supportsHover = window.matchMedia("(hover: hover)").matches;
    if (supportsHover) {
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerleave", clearHover);
    }

    let frame = 0;
    let isPageVisible = !document.hidden;
    const onVisibilityChange = () => { isPageVisible = !document.hidden; };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const clock = new THREE.Clock();
    let sceneTime = 0;
    let wasHandGrabbing = false;
    let inertiaX = 0;
    let inertiaY = 0;
    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!isPageVisible) return;
      const handState = handControlRef.current;
      const delta = Math.min(clock.getDelta(), .05);
      if (handState.grabbing) {
        inertiaX = handState.velocityX;
        inertiaY = handState.velocityY;
        wasHandGrabbing = true;
      } else {
        if (wasHandGrabbing) {
          inertiaX = handState.velocityX * 1.18;
          inertiaY = handState.velocityY * 1.18;
          wasHandGrabbing = false;
        }
        if (Math.abs(inertiaX) > .001 || Math.abs(inertiaY) > .001) {
          handState.x = clamp(handState.x + inertiaX * delta, -Math.PI * 4, Math.PI * 4);
          handState.y = clamp(handState.y + inertiaY * delta, -Math.PI * 4, Math.PI * 4);
          const decay = Math.exp(-delta / .62);
          inertiaX *= decay;
          inertiaY *= decay;
        } else {
          inertiaX = 0;
          inertiaY = 0;
        }
      }
      const sceneAutoRotate = autoRotateRef.current && !handState.grabbing;
      controls.autoRotate = sceneAutoRotate;
      controls.update(delta);
      halo.visible = showOrbitRingsRef.current;
      if (tripKnot) tripKnot.visible = showOrbitRingsRef.current;
      root.rotation.x = baseRotation.x + handState.x;
      root.rotation.y = baseRotation.y + handState.y;
      root.rotation.z = baseRotation.z;
      if (sceneAutoRotate) {
        sceneTime += delta;
        root.position.y = basePosition.y + Math.sin(sceneTime * (trippyMode ? .92 : .58)) * (trippyMode ? .22 : .12);
        root.position.x = basePosition.x + (trippyMode ? Math.sin(sceneTime * .41) * .12 : 0);
        if (trippyMode) {
          root.rotation.y = baseRotation.y + handState.y + Math.sin(sceneTime * .34) * .18;
          root.rotation.z = baseRotation.z + Math.cos(sceneTime * .48) * .08;
          const breath = 1 + Math.sin(sceneTime * 1.08) * .026;
          root.scale.setScalar(fit * breath);
          atomGroup.children.forEach((child, index) => {
            const baseScale = child.userData.baseScale as number;
            child.scale.setScalar(baseScale * (1 + Math.sin(sceneTime * 1.55 + index * .72) * .075));
          });
          ghostField.children.forEach((ghost, index) => {
            const phase = ghost.userData.phase as number;
            const ghostBasePosition = ghost.userData.basePosition as THREE.Vector3;
            const ghostBaseRotation = ghost.userData.baseRotation as THREE.Euler;
            ghost.position.x = ghostBasePosition.x + Math.sin(sceneTime * .83 + phase) * (.12 + index * .04);
            ghost.position.y = ghostBasePosition.y + Math.cos(sceneTime * .67 + phase) * (.1 + index * .03);
            ghost.rotation.z = ghostBaseRotation.z + Math.sin(sceneTime * .52 + phase) * .065;
          });
          if (tripKnot) {
            tripKnot.rotation.x = .5 + Math.sin(sceneTime * .27) * .18;
            tripKnot.rotation.y = sceneTime * .045;
            tripKnot.rotation.z = .3 - sceneTime * .032;
          }
        }
        dustPoints.rotation.y = sceneTime * .012;
        halo.rotation.z = sceneTime * (trippyMode ? .068 : .025);
        halo.rotation.y = Math.sin(sceneTime * (trippyMode ? .38 : .14)) * (trippyMode ? .32 : .12);
        key.position.x = Math.cos(sceneTime * .35) * 5;
        if (cyanLaser && magentaLaser) {
          cyanLaser.position.set(Math.cos(sceneTime * .63) * 6, Math.sin(sceneTime * .47) * 3.6, 3 + Math.sin(sceneTime * .31) * 2);
          magentaLaser.position.set(Math.cos(sceneTime * .51 + Math.PI) * 6, Math.sin(sceneTime * .59 + 1.4) * 3.6, 3 + Math.cos(sceneTime * .37) * 2);
          cyanLaser.intensity = (isEco ? 7 : 15) + Math.sin(sceneTime * 1.1) * 3;
          magentaLaser.intensity = (isEco ? 6 : 13) + Math.cos(sceneTime * .92) * 3;
        }
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      controls.dispose();
      if (supportsHover) {
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerleave", clearHover);
      }
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat) => mat?.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [molecule, trippyMode, colorMode, renderStyle, modelStyle, quality, resetSignal, handControlRef]);

  return (
    <div className="scene" ref={hostRef} aria-label={`Interactive three-dimensional model of ${molecule.name}`}>
      {hover && (
        <div className="atom-tooltip" style={{ left: hover.x + 16, top: hover.y + 16 }}>
          <b>{hover.element}</b><span>{({ C: "Carbon", N: "Nitrogen", O: "Oxygen", H: "Hydrogen" } as Record<string,string>)[hover.element] ?? hover.element}</span>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [activeId, setActiveId] = useState("caffeine");
  const [customMolecule, setCustomMolecule] = useState<Molecule | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [searchMessage, setSearchMessage] = useState("");
  const [autoRotate, setAutoRotate] = useState(true);
  const [showOrbitRings, setShowOrbitRings] = useState(true);
  const [trippyMode, setTrippyMode] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>("chrome");
  const [renderStyle, setRenderStyle] = useState<RenderStyle>("aurora");
  const [modelStyle, setModelStyle] = useState<ModelStyle>("ball");
  const [quality, setQuality] = useState<Quality>("auto");
  const [autoEconomy, setAutoEconomy] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [handMode, setHandMode] = useState(false);
  const [handStatus, setHandStatus] = useState<HandStatus>("off");
  const handControlRef = useRef<HandControlState>({ x: 0, y: 0, velocityX: 0, velocityY: 0, grabbing: false, enabled: false });
  const handPreviousAutoRotateRef = useRef(true);
  const handRestoreTimeoutRef = useRef<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const molecule = useMemo(() => customMolecule ?? molecules.find((m) => m.id === activeId) ?? molecules[0], [activeId, customMolecule]);

  /* Device-local preferences are intentionally restored after hydration. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const savedQuality = window.localStorage.getItem("molecular-drift-quality");
    if (savedQuality === "auto" || savedQuality === "eco" || savedQuality === "high") setQuality(savedQuality);
    if (window.localStorage.getItem("molecular-drift-rings") === "hidden") setShowOrbitRings(false);
    if (window.localStorage.getItem("molecular-drift-trippy") === "on") setTrippyMode(true);
    if (window.localStorage.getItem("molecular-drift-colors") === "spectrum") setColorMode("spectrum");
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    setAutoEconomy(window.matchMedia("(max-width: 760px)").matches || navigator.hardwareConcurrency <= 4 || deviceMemory <= 4);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.code === "Space") { event.preventDefault(); setAutoRotate((v) => !v); }
      if (event.key.toLowerCase() === "r") {
        handControlRef.current.x = 0;
        handControlRef.current.y = 0;
        handControlRef.current.velocityX = 0;
        handControlRef.current.velocityY = 0;
        setResetSignal((v) => v + 1);
      }
      if (event.key.toLowerCase() === "h") setHandMode((enabled) => !enabled);
      if (event.key.toLowerCase() === "t") setTrippyMode((enabled) => {
        window.localStorage.setItem("molecular-drift-trippy", enabled ? "off" : "on");
        return !enabled;
      });
      if (event.key.toLowerCase() === "o") setShowOrbitRings((visible) => {
        window.localStorage.setItem("molecular-drift-rings", visible ? "hidden" : "visible");
        return !visible;
      });
      if (event.key.toLowerCase() === "m") setColorMode((current) => {
        const next = current === "chrome" ? "spectrum" : "chrome";
        window.localStorage.setItem("molecular-drift-colors", next);
        return next;
      });
      const num = Number(event.key);
      if (num >= 1 && num <= molecules.length) { setCustomMolecule(null); setActiveId(molecules[num - 1].id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => {
    if (handRestoreTimeoutRef.current) window.clearTimeout(handRestoreTimeoutRef.current);
  }, []);

  const handleHandGrabChange = (grabbing: boolean) => {
    if (handRestoreTimeoutRef.current) {
      window.clearTimeout(handRestoreTimeoutRef.current);
      handRestoreTimeoutRef.current = null;
    }
    if (grabbing) {
      handPreviousAutoRotateRef.current = autoRotate;
      setAutoRotate(false);
    } else if (handPreviousAutoRotateRef.current) {
      handRestoreTimeoutRef.current = window.setTimeout(() => {
        setAutoRotate(true);
        handRestoreTimeoutRef.current = null;
      }, 650);
    }
  };

  const resetView = () => {
    handControlRef.current.x = 0;
    handControlRef.current.y = 0;
    handControlRef.current.velocityX = 0;
    handControlRef.current.velocityY = 0;
    setResetSignal((v) => v + 1);
  };

  const cycleQuality = () => {
    setQuality((current) => {
      const next = current === "auto" ? "eco" : current === "eco" ? "high" : "auto";
      window.localStorage.setItem("molecular-drift-quality", next);
      return next;
    });
  };

  const toggleOrbitRings = () => {
    setShowOrbitRings((visible) => {
      window.localStorage.setItem("molecular-drift-rings", visible ? "hidden" : "visible");
      return !visible;
    });
  };

  const toggleTrippyMode = () => {
    setTrippyMode((enabled) => {
      window.localStorage.setItem("molecular-drift-trippy", enabled ? "off" : "on");
      return !enabled;
    });
  };

  const toggleColorMode = () => {
    setColorMode((current) => {
      const next = current === "chrome" ? "spectrum" : "chrome";
      window.localStorage.setItem("molecular-drift-colors", next);
      return next;
    });
  };

  const selectCuratedMolecule = (id: string) => {
    setCustomMolecule(null);
    setActiveId(id);
    setSearchState("idle");
    setSearchMessage("");
  };

  const searchMolecule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchState("error");
      setSearchMessage("TYPE A NAME, CAS OR SMILES");
      return;
    }
    setSearchState("loading");
    setSearchMessage("BUILDING 3D CONFORMER…");
    try {
      const foundMolecule = await lookupMolecule(query) as Molecule;
      setCustomMolecule(foundMolecule);
      setResetSignal((value) => value + 1);
      setSearchState("success");
      setSearchMessage(`${foundMolecule.formula} · ${foundMolecule.atoms.length} ATOMS LOADED`);
    } catch (error) {
      setSearchState("error");
      setSearchMessage(error instanceof Error ? error.message.toUpperCase() : "SEARCH FAILED");
    }
  };

  return (
    <main className="app-shell" data-quality={quality === "auto" && autoEconomy ? "eco" : quality} data-motion={autoRotate ? "playing" : "paused"} data-rings={showOrbitRings ? "visible" : "hidden"} data-visual={trippyMode ? "trippy" : "classic"} data-color={colorMode} style={{ "--accent": molecule.accent } as React.CSSProperties}>
      <div className="liquid-field"><i /><i /><i /></div>
      <div className="chrome-disc disc-one" /><div className="chrome-disc disc-two" />
      <div className="trip-field" aria-hidden="true"><i /><i /><i /><i /><span>TRIPPY / ACTIVE</span></div>
      <div className="laser-field" aria-hidden="true"><i /><i /><i /></div>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="noise" />
      <header className="topbar">
        <div className="brand"><span className="brand-orbit"><Atom size={20} /></span><span>MOLECULAR<em>°DRIFT</em></span></div>
        <form className={`molecule-search ${searchState}`} onSubmit={searchMolecule}>
          <Search size={15} aria-hidden="true" />
          <input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); if (searchState === "error") setSearchState("idle"); }} placeholder="NAME / CAS / SMILES" aria-label="Search by molecule name, CAS number, or SMILES" autoComplete="off" spellCheck={false} />
          <button type="submit" disabled={searchState === "loading"} aria-label="Load three-dimensional molecule">
            {searchState === "loading" ? <LoaderCircle className="search-spinner" size={16} /> : <ArrowRight size={16} />}
          </button>
          {searchMessage && <span className="search-feedback" role={searchState === "error" ? "alert" : "status"}>{searchMessage}</span>}
        </form>
        <button className="about-button" onClick={() => setInfoOpen(true)} aria-label="About Molecular Drift"><Info size={18} /><span>ABOUT</span></button>
      </header>

      <aside className="molecule-rail" aria-label="Molecule collection">
        <p>COLLECTION / 01</p>
        <div className="rail-list">
          {molecules.map((item, index) => (
            <button key={item.id} className={!customMolecule && activeId === item.id ? "rail-item active" : "rail-item"} onClick={() => selectCuratedMolecule(item.id)} aria-label={`View ${item.name}`}>
              <span className="rail-number">0{index + 1}</span>
              <span className="mini-molecule"><i /><i /><i /></span>
              <span className="rail-name">{item.name}</span>
            </button>
          ))}
          {customMolecule && (
            <button className="rail-item active search-result-item" onClick={() => setCustomMolecule(customMolecule)} aria-label={`View search result ${customMolecule.name}`}>
              <span className="rail-number">∞</span><span className="mini-molecule"><i /><i /><i /></span><span className="rail-name">Search result</span>
            </button>
          )}
        </div>
      </aside>

      <section className="viewer-wrap">
        <div className="warp-type" aria-hidden="true"><span>MOLECULAR</span><span>DRIFT</span></div>
        <div className="coordinate cross-one">+</div><div className="coordinate cross-two">+</div>
        <div className="molecule-ghost" aria-hidden="true">{molecule.formula}</div>
        <div className="index-marker">{customMolecule ? "∞" : `0${molecules.indexOf(molecule) + 1}`}<span>{customMolecule ? "/ LIVE" : "/ 04"}</span></div>
        <MolecularScene molecule={molecule} autoRotate={autoRotate} showOrbitRings={showOrbitRings} trippyMode={trippyMode} colorMode={colorMode} renderStyle={renderStyle} modelStyle={modelStyle} quality={quality} resetSignal={resetSignal} handControlRef={handControlRef} />
        <HandControl enabled={handMode} handControlRef={handControlRef} onGrabChange={handleHandGrabChange} onStatus={setHandStatus} />
        <div className="drag-hint"><MousePointer2 size={15} /><span>DRAG TO ORBIT</span><i /></div>
      </section>

      <section className="molecule-copy" key={molecule.id}>
        <p className="eyebrow"><Sparkles size={13} /> OBJECT IN FOCUS</p>
        <h1>{molecule.name}</h1>
        <p className="subtitle">{molecule.subtitle}</p>
        <div className="metrics">
          <div><span>FORMULA</span><strong>{molecule.formula}</strong></div>
          <div><span>MOLAR MASS</span><strong>{molecule.mass}</strong></div>
          <div><span>GEOMETRY</span><strong>{molecule.geometry}</strong></div>
        </div>
        <p className="description">{molecule.note}</p>
      </section>

      <nav className="control-dock" aria-label="Viewer controls">
        <button className={autoRotate ? "control active" : "control"} onClick={() => setAutoRotate((v) => !v)} title="Toggle rotation (Space)">
          {autoRotate ? <CirclePause size={18} /> : <CirclePlay size={18} />}<span>{autoRotate ? "PAUSE" : "PLAY"}</span>
        </button>
        <button className={showOrbitRings ? "control orbit-control active" : "control orbit-control"} onClick={toggleOrbitRings} title={`${showOrbitRings ? "Hide" : "Show"} orbit rings (O)`} aria-label={`${showOrbitRings ? "Hide" : "Show"} decorative orbit rings`} aria-pressed={showOrbitRings}>
          <Orbit size={18} /><span>RINGS</span>
        </button>
        <button className={trippyMode ? "control trip-control active" : "control trip-control"} onClick={toggleTrippyMode} title="Toggle trippy visual mode (T)" aria-label="Toggle trippy visual mode" aria-pressed={trippyMode}>
          <Waves size={18} /><span>TRIP</span>
        </button>
        <button className={handMode ? "control hand-control active" : "control hand-control"} onClick={() => setHandMode((enabled) => !enabled)} title={`Toggle hand control (H)${handMode ? ` · ${handStatus.toUpperCase()}` : ""}`} aria-label="Toggle MediaPipe hand control" aria-pressed={handMode}>
          <HandIcon size={18} /><span>HAND</span>
        </button>
        <button className={colorMode === "spectrum" ? "control color-control active" : "control color-control"} onClick={toggleColorMode} title="Toggle atom colors (M)" aria-label="Toggle element colors" aria-pressed={colorMode === "spectrum"}>
          <Palette size={18} /><span>{colorMode === "spectrum" ? "COLOR" : "CHROME"}</span>
        </button>
        <span className="divider" />
        <div className="segmented" aria-label="Model representation">
          {(["ball", "space", "wire"] as ModelStyle[]).map((style) => (
            <button key={style} className={modelStyle === style ? "active" : ""} onClick={() => setModelStyle(style)}>
              {style === "ball" ? "BALL + STICK" : style === "space" ? "SPACE FILL" : "SKELETON"}
            </button>
          ))}
        </div>
        <span className="divider" />
        <button className="control" onClick={() => setRenderStyle((current) => current === "velvet" ? "aurora" : current === "aurora" ? "xray" : "velvet")} title="Change material">
          <Layers3 size={18} /><span>{renderStyle === "aurora" ? "CHROME" : renderStyle === "velvet" ? "PEARL" : "XRAY"}</span>
        </button>
        <button className={quality === "eco" ? "control quality-control active" : "control quality-control"} onClick={cycleQuality} title={`Performance quality: ${quality}. Click to change.`} aria-label={`Performance quality ${quality}. Click to change.`}>
          <Gauge size={18} /><span>{quality.toUpperCase()}</span>
        </button>
        <button className="icon-control" onClick={resetView} title="Reset view (R)" aria-label="Reset view"><RotateCcw size={17} /></button>
      </nav>

      <div className="mobile-picker" aria-label="Select molecule">
        {molecules.map((item, index) => <button key={item.id} onClick={() => selectCuratedMolecule(item.id)} className={!customMolecule && item.id === activeId ? "active" : ""}>0{index + 1}</button>)}
        {customMolecule && <button className="active" onClick={() => setCustomMolecule(customMolecule)}>∞</button>}
      </div>

      <footer><span>ATOMS / {molecule.atoms.length.toString().padStart(2, "0")}</span><span>BONDS / {molecule.bonds.length.toString().padStart(2, "0")}</span><span>VISUAL / {trippyMode ? "TRIPPY" : colorMode === "spectrum" ? "SPECTRUM" : "CHROME"}</span><span>QUALITY / {quality.toUpperCase()}</span></footer>

      {infoOpen && (
        <div className="modal-backdrop" onMouseDown={() => setInfoOpen(false)}>
          <section className="info-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => setInfoOpen(false)} aria-label="Close"><X size={20} /></button>
            <span className="modal-index">MD / 2026</span><h2>Chemistry as<br /><em>an art object.</em></h2>
            <p>Molecular Drift is an interactive study in scientific form. Search a name, CAS number, or SMILES to load a computed 3D conformer, then orbit, zoom, inspect atoms, and switch material treatments. Trippy mode changes only the visual presentation—not the molecular coordinates. Eco uses a lighter version on slower devices.</p>
            <div className="key-grid"><span><kbd>SPACE</kbd> pause</span><span><kbd>T</kbd> trippy</span><span><kbd>M</kbd> colors</span><span><kbd>O</kbd> rings</span><span><kbd>R</kbd> reset</span></div>
          </section>
        </div>
      )}
    </main>
  );
}
