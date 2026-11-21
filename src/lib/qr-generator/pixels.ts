import seedrandom from "seedrandom";
import { encode, QrCodeDataType } from "uqr";

import type { QrCodeGeneratorMarkerState, QRCodeGeneratorState } from "./types";
import type { QrCodeGenerateResult } from "uqr";

// Shared by the canvas (PNG) and SVG renderers so both draw exactly the same modules.

export interface MarkerInfo {
  x: number;
  y: number;
  position: "top-left" | "top-right" | "bottom-left" | "sub";
  isCenter: boolean;
  isBorder: boolean;
  isInner: boolean;
  style: QrCodeGeneratorMarkerState;
}

export interface PixelInfo {
  x: number;
  y: number;
  isDark: boolean;
  isBorder: boolean;
  isIgnored: boolean;
  marker?: MarkerInfo;
}

export function createQrInstance(state: QRCodeGeneratorState) {
  // When a logo is embedded, force highest error correction level ('H', ~30%
  // recovery) so the QR code remains scannable despite covered modules.
  const ecc = state.logoImage ? "H" : state.ecc;

  const qr = encode(state.text || "ishortn.ink", {
    minVersion: state.minVersion,
    maxVersion: state.maxVersion,
    ecc,
    maskPattern: state.maskPattern,
    boostEcc: state.boostECC,
    border: 0,
  });
  return qr;
}

export function pointToLineProjection(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = dx * dx + dy * dy;
  const u = ((px - x1) * dx + (py - y1) * dy) / d;
  const x = x1 + u * dx;
  const y = y1 + u * dy;
  return [x, y] as const;
}

export function seededRandom(seed: number, x: number, y: number, type: string) {
  return seedrandom([seed, type, x, y].join("|"))();
}

/** Every cell of the code plus its margin, row by row, in output (margin-offset) coordinates. */
export function computePixels(qr: QrCodeGenerateResult, state: QRCodeGeneratorState): PixelInfo[] {
  const {
    rotate,
    margin,
    marginNoise,
    seed,
    marginNoiseRate,
    marginNoiseSpace,
    markerSub,
    renderPointsType,
  } = state;

  const rand = (x: number, y: number, type: string) => seededRandom(seed, x, y, type);

  function resolveMarkerStyle(index: number): QrCodeGeneratorMarkerState {
    const s = (index === 0 ? state : state.markers[index - 1]) ?? state;

    const { markerStyle, markerFrame } = s;

    let markerCenter = s.markerCenter;
    if (markerCenter === "auto") {
      if (markerFrame === "circle") markerCenter = "circle";
      else if (markerFrame === "tiny-plus") markerCenter = "plus";
      else if (markerFrame === "octagon") markerCenter = "diamond";
      else markerCenter = "square";
    }

    return {
      markerStyle,
      markerFrame,
      markerCenter,
    };
  }

  function getModule(x: number, y: number) {
    if (x < 0 || y < 0 || x >= qr.size || y >= qr.size) return false;
    return qr.data[y]?.[x];
  }

  function getType(x: number, y: number) {
    if (x < 0 || y < 0 || x >= qr.size || y >= qr.size) return QrCodeDataType.Border;
    return qr.types[y]?.[x] ?? QrCodeDataType.Border;
  }

  function getInfo(x: number, y: number): PixelInfo {
    let isBorder =
      marginNoiseSpace === "full"
        ? x < -1 || y < -1 || x > qr.size || y > qr.size
        : x < 0 || y < 0 || x >= qr.size || y >= qr.size;
    let isIgnored = false;

    let isDark = false;
    if (isBorder && marginNoise) {
      isDark = rand(x, y, "border-noise") < marginNoiseRate;
    } else {
      isDark = getModule(x, y)!;
      if (renderPointsType === "data" && getType(x, y) !== QrCodeDataType.Data) {
        isDark = false;
        isIgnored = true;
      } else if (
        (renderPointsType === "function" ||
          renderPointsType === "guide" ||
          renderPointsType === "marker") &&
        getType(x, y) < QrCodeDataType.Function
      ) {
        isDark = false;
        isIgnored = true;
      }
    }

    if (renderPointsType !== "data" && renderPointsType !== "guide") {
      if (marginNoiseSpace === "marker") {
        if (
          (x >= -1 && x <= 7 && y >= -1 && y <= 7) ||
          (x >= -1 && x <= 7 && y >= qr.size - 8 && y <= qr.size) ||
          (x >= qr.size - 8 && x <= qr.size && y >= -1 && y <= 7)
        ) {
          isBorder = false;
          isIgnored = false;
        }
      } else if (marginNoiseSpace === "minimal" || marginNoiseSpace === "extreme") {
        if (
          (y >= 2 && y <= 4 && (x === -1 || x === qr.size)) ||
          (x >= 2 && x <= 4 && (y === -1 || y === qr.size)) ||
          (y >= qr.size - 5 && y <= qr.size - 3 && (x === -1 || x === 7)) ||
          (x >= qr.size - 5 && x <= qr.size - 3 && (y === -1 || y === 7))
        ) {
          isBorder = false;
          isIgnored = false;
        }
      }
    }

    let marker: MarkerInfo | undefined;

    function createMarker(
      x: number,
      y: number,
      position: MarkerInfo["position"],
      isSubMarker = false,
    ) {
      const isInner =
        position === "sub" ? x === 2 && y === 2 : x >= 2 && x <= 4 && y >= 2 && y <= 4;
      const isBorder = !isInner;
      const isCenter = position === "sub" ? x === 2 && y === 2 : x === 3 && y === 3;

      return {
        x,
        y,
        position,
        isInner,
        isBorder,
        isCenter,
        isIgnored,
        isSubMarker,
        style: resolveMarkerStyle(
          position === "top-left"
            ? 0
            : position === "top-right"
              ? 1
              : position === "bottom-left"
                ? 2
                : 3,
        ),
      };
    }

    if (x >= 0 && x < 7 && y >= 0 && y < 7) {
      marker = createMarker(x, y, "top-left");
    } else if (x >= 0 && x < 7 && y >= qr.size - 7 && y < qr.size) {
      marker = createMarker(x, y - qr.size + 7, "bottom-left");
    } else if (x >= qr.size - 7 && x < qr.size && y >= 0 && y < 7) {
      marker = createMarker(x - qr.size + 7, y, "top-right");
    } else if (getType(x, y) === QrCodeDataType.Alignment) {
      let dx = x;
      let dy = y;
      while (getType(dx, dy) === QrCodeDataType.Alignment) dx -= 1;
      dx += 1;
      while (getType(dx, dy) === QrCodeDataType.Alignment) dy -= 1;
      dy += 1;
      marker = createMarker(x - dx, y - dy, "sub");
    }

    if (marker) {
      if (marker.position !== "sub") {
        if (marker.isBorder) {
          const { markerFrame } = marker.style;
          if (markerFrame === "circle" || markerFrame === "octagon") isDark = false;

          if (markerFrame === "plus") {
            if (!((marker.x >= 2 && marker.x <= 4) || (marker.y >= 2 && marker.y <= 4)))
              isDark = false;
          } else if (markerFrame === "box") {
            if (!((marker.x >= 1 && marker.x <= 5) || (marker.y >= 1 && marker.y <= 5)))
              isDark = false;
          } else if (markerFrame === "random") {
            if (marker.x !== 3 && marker.y !== 3) {
              if (isDark) isDark = rand(x, y, "marker") < 0.5;
            }
          } else if (markerFrame === "tiny-plus") {
            if (marker.x !== 3 && marker.y !== 3) isDark = false;
          }
        }

        if (marker?.isInner && marker.style.markerCenter === "plus") {
          if (marker.x !== 3 && marker.y !== 3) isDark = false;
        }
      } else if (marker?.position === "sub") {
        if (marker.isBorder) {
          if (markerSub === "circle" || markerSub === "octagon") isDark = false;
        }

        if (markerSub === "plus" || markerSub === "tiny-plus") {
          if (marker.x !== 2 && marker.y !== 2) isDark = false;
        } else if (markerSub === "box") {
          if (!((marker.x >= 1 && marker.x <= 3) || (marker.y >= 1 && marker.y <= 3)))
            isDark = false;
        } else if (markerSub === "random") {
          if (marker.x !== 2 && marker.y !== 2) {
            if (isDark) isDark = rand(x, y, "marker") < 0.5;
          }
        }
      }
    }

    function cutOut(ix: number, iy: number, w: number, h: number) {
      if (x >= ix && x < ix + w && y >= iy && y < iy + h) {
        isDark = false;
        isBorder = true;
        isIgnored = true;
      }
    }

    if (marginNoiseSpace === "extreme") {
      cutOut(-1, -1, 3, 3);
      cutOut(-1, 5, 3, 3);
      cutOut(-1, qr.size - 2, 3, 3);
      cutOut(-1, qr.size - 8, 3, 3);
      cutOut(5, -1, 3, 3);
      cutOut(5, 5, 3, 3);
      cutOut(5, qr.size - 2, 3, 3);
      cutOut(5, qr.size - 8, 3, 3);
      cutOut(qr.size - 2, -1, 3, 3);
      cutOut(qr.size - 2, 5, 3, 3);
      cutOut(qr.size - 8, -1, 3, 3);
      cutOut(qr.size - 8, 5, 3, 3);
    }

    let targetX = x;
    let targetY = y;

    // Rotate the QR code
    if (x >= -1 && y >= -1 && x < qr.size + 1 && y < qr.size + 1) {
      targetX = x;
      targetY = y;
      if (rotate === 90) {
        targetX = qr.size - targetX - 1;
        [targetX, targetY] = [targetY, targetX];
      } else if (rotate === 180) {
        targetX = qr.size - targetX - 1;
        targetY = qr.size - targetY - 1;
      } else if (rotate === 270) {
        targetY = qr.size - targetY - 1;
        [targetX, targetY] = [targetY, targetX];
      }
    }

    targetX += margin;
    targetY += margin;

    if (renderPointsType === "guide" && marker) {
      isDark = false;
      isIgnored = true;
    }

    if (renderPointsType === "marker" && !marker) {
      isDark = false;
      isIgnored = true;
    }

    return {
      isDark,
      isBorder,
      marker,
      isIgnored,
      x: targetX,
      y: targetY,
    };
  }

  const pixels: PixelInfo[] = [];

  for (let y = -margin; y < qr.size + margin; y++) {
    for (let x = -margin; x < qr.size + margin; x++) pixels.push(getInfo(x, y));
  }

  return pixels;
}
