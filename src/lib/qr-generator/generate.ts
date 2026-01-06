import seedrandom from "seedrandom";
import { encode, QrCodeDataType } from "uqr";

import { effects } from "./effects";
import Perspective from "./perspective";
import { resolveMargin } from "./utils";

import type {
  GenerateQRCodeResult,
  QrCodeGeneratorMarkerState,
  QRCodeGeneratorState,
} from "./types";

interface MarkerInfo {
  x: number;
  y: number;
  position: "top-left" | "top-right" | "bottom-left" | "sub";
  isCenter: boolean;
  isBorder: boolean;
  isInner: boolean;
  style: QrCodeGeneratorMarkerState;
}

interface PixelInfo {
  x: number;
  y: number;
  isDark: boolean;
  isBorder: boolean;
  isIgnored: boolean;
  marker?: MarkerInfo;
}

export async function generateQRCode(
  outCanvas: HTMLCanvasElement,
  state: QRCodeGeneratorState,
): Promise<GenerateQRCodeResult | null> {
  if (!outCanvas) return null;

  const qr = createQrInstance(state);

  const {
    scale: cell,
    rotate,
    margin,
    marginNoise,
    seed,
    marginNoiseRate,
    marginNoiseSpace,
    pixelStyle,
    markerSub,
    invert,
    renderPointsType,
  } = state;

  const {
    top: marginTop,
    right: marginRight,
    bottom: marginBottom,
    left: marginLeft,
  } = resolveMargin(margin);

  const halfcell = cell / 2;
  const width: number = (qr.size + marginLeft + marginRight) * cell;
  const height: number = (qr.size + marginTop + marginBottom) * cell;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.imageRendering = "pixelated";
  canvas.style.imageRendering = "crisp-edges";
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;

  // Define effective light color once
  const effectiveLightColor = state.transparent ? 'rgba(0,0,0,0)' : state.lightColor;

  // Set initial background
  ctx.fillStyle = invert ? state.darkColor : effectiveLightColor;
  ctx.fillRect(0, 0, width, height);

  function rand(x: number, y: number, type: string) {
    return seedrandom([seed, type, x, y].join("|"))();
  }

  function getBorderOpacity(x: number, y: number) {
    if (typeof state.marginNoiseOpacity === "number") return state.marginNoiseOpacity;
    const [min, max] = state.marginNoiseOpacity;
    return rand(x, y, "border-op") * (max - min) + min;
  }

  function resolveMarkerStyle(index: number): QrCodeGeneratorMarkerState {
    const s = (index === 0 ? state : state.markers[index - 1]) ?? state;

    const { markerStyle, markerShape } = s;

    let markerInnerShape = s.markerInnerShape;
    if (markerInnerShape === "auto") {
      if (markerShape === "circle") markerInnerShape = "circle";
      else if (markerShape === "tiny-plus") markerInnerShape = "plus";
      else if (markerShape === "octagon") markerInnerShape = "diamond";
      else markerInnerShape = "square";
    }

    return {
      markerStyle,
      markerShape,
      markerInnerShape,
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
          const { markerShape } = marker.style;
          if (markerShape === "circle" || markerShape === "octagon") isDark = false;

          if (markerShape === "plus") {
            if (!((marker.x >= 2 && marker.x <= 4) || (marker.y >= 2 && marker.y <= 4)))
              isDark = false;
          } else if (markerShape === "box") {
            if (!((marker.x >= 1 && marker.x <= 5) || (marker.y >= 1 && marker.y <= 5)))
              isDark = false;
          } else if (markerShape === "random") {
            if (marker.x !== 3 && marker.y !== 3) {
              if (isDark) isDark = rand(x, y, "marker") < 0.5;
            }
          } else if (markerShape === "tiny-plus") {
            if (marker.x !== 3 && marker.y !== 3) isDark = false;
          }
        }

        if (marker?.isInner && marker.style.markerInnerShape === "plus") {
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

    targetX += marginLeft;
    targetY += marginTop;

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

  for (let y = -marginTop; y < qr.size + marginBottom; y++) {
    for (let x = -marginLeft; x < qr.size + marginRight; x++) pixels.push(getInfo(x, y));
  }

  // Sort pixels so the markers are drawn in the correct order
  pixels.sort((a, b) => {
    const getOrder = (p: PixelInfo) => {
      if (p.marker?.isBorder) return 0;
      if (p.marker?.isCenter) return 1;
      if (p.marker?.isInner) return 2;
      return 4;
    };
    return getOrder(a) - getOrder(b);
  });

  const darkHex = invert ? effectiveLightColor : state.darkColor;

  for (const { isDark, marker, x, y, isBorder, isIgnored } of pixels) {
    if (isIgnored) continue;

    let _pixelStyle = pixelStyle;

    const opacity = isBorder ? getBorderOpacity(x, y) : 1;
    const _darkColor =
      opacity === 1
        ? state.darkColor
        : darkHex +
          Math.round(opacity * 255)
            .toString(16)
            .padStart(2, "0");

    const lightColor = invert ? _darkColor : effectiveLightColor;
    const darkColor = invert ? effectiveLightColor : _darkColor;
    ctx.fillStyle = darkColor;

    const cX = x * cell + halfcell;
    const cY = y * cell + halfcell;

    if (marker && marker.position !== "sub") {
      const _markerStyle =
        marker.style.markerStyle === "auto" ? pixelStyle : marker.style.markerStyle;

      const { markerShape } = marker.style;

      _pixelStyle = _markerStyle;

      if (renderPointsType === "data") continue;

      if (markerShape === "circle") {
        if (marker.isBorder) continue;

        if (marker.isCenter) {
          ctx.fillStyle = lightColor;
          ctx.fillRect(cX - cell * 3.5, cY - cell * 3.5, cell * 7, cell * 7);

          ctx.beginPath();
          ctx.fillStyle = darkColor;
          ctx.arc(cX, cY, cell * 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.fillStyle = lightColor;
          ctx.arc(cX, cY, cell * 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = darkColor;
        }
      } else if (markerShape === "octagon") {
        if (marker.isBorder) continue;

        if (marker.isCenter) {
          ctx.fillStyle = lightColor;
          ctx.fillRect(cX - cell * 3.5, cY - cell * 3.5, cell * 7, cell * 7);

          const octagonFor = (dx: number, dy: number) => {
            return [
              [dx, dy],
              [-dx, dy],
              [-dy, dx],
              [-dy, -dx],
              [-dx, -dy],
              [dx, -dy],
              [dy, -dx],
              [dy, dx],
            ] as const;
          };

          function drawOctagon(size: number) {
            ctx.beginPath();
            const points = octagonFor((1.5 / 3.5) * size, size);

            if (_pixelStyle === "rounded") {
              const innerPoints = octagonFor((1.5 / 3.5) * (size - 1), size - 1);
              const startPoint = [
                (points[0][0] + points[1][0]) / 2,
                (points[0][1] + points[1][1]) / 2,
              ];
              ctx.moveTo(cX + startPoint[0]! * cell, cY + startPoint[1]! * cell);
              [...points, points[0]].forEach(([x, y], i) => {
                const previous = i > 0 ? points[i - 1] : points[points.length - 1];
                const next = points[(i + 1) % points.length];
                const inner = innerPoints[i % innerPoints.length];
                if (!previous || !next || !inner) return;
                const p1 = pointToLineProjection(...inner, ...previous, x, y);
                const p2 = pointToLineProjection(...inner, ...next, x, y);
                ctx.lineTo(cX + p1[0] * cell, cY + p1[1] * cell);
                ctx.arcTo(cX + x * cell, cY + y * cell, cX + p2[0] * cell, cY + p2[1] * cell, cell);
                ctx.lineTo(cX + p2[0] * cell, cY + p2[1] * cell);
              });
            } else {
              points.forEach(([x, y], i) => {
                ctx[i === 0 ? "moveTo" : "lineTo"](cX + x * cell, cY + y * cell);
              });
            }
            ctx.closePath();
            ctx.fill();
          }

          ctx.fillStyle = darkColor;
          drawOctagon(3.5);

          ctx.fillStyle = lightColor;
          drawOctagon(2.5);

          ctx.fillStyle = darkColor;
        }
      }

      if (marker.isInner) {
        const { markerInnerShape } = marker.style;
        // inner markers
        if (markerInnerShape === "circle") {
          if (marker.isCenter) {
            ctx.fillStyle = lightColor;
            ctx.fillRect(cX - cell * 1.5, cY - cell * 1.5, cell * 3, cell * 3);
            ctx.beginPath();
            ctx.fillStyle = darkColor;
            ctx.arc(cX, cY, cell * 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          continue;
        } else if (markerInnerShape === "eye") {
          if (marker.isCenter) {
            ctx.fillStyle = lightColor;
            ctx.fillRect(cX - cell * 1.5, cY - cell * 1.5, cell * 3, cell * 3);
            ctx.beginPath();
            ctx.fillStyle = darkColor;
            ctx.moveTo(cX, cY - cell * 1.5);
            ctx.arcTo(cX + cell * 1.5, cY, cX, cY + cell * 1.5, cell);
            ctx.lineTo(cX, cY + cell * 1.5);
            ctx.arcTo(cX - cell * 1.5, cY, cX, cY - cell * 1.5, cell);
            ctx.fill();
          }
          continue;
        } else if (markerInnerShape === "diamond") {
          if (marker.isCenter) {
            ctx.fillStyle = lightColor;
            ctx.fillRect(cX - cell * 1.5, cY - cell * 1.5, cell * 3, cell * 3);
            ctx.beginPath();
            ctx.fillStyle = darkColor;
            ctx.moveTo(cX, cY - cell * 1.5);
            ctx.lineTo(cX + cell * 1.5, cY);
            ctx.lineTo(cX, cY + cell * 1.5);
            ctx.lineTo(cX - cell * 1.5, cY);
            ctx.fill();
          }
          continue;
        }
      }
    }

    if (marker?.position === "sub") {
      if (renderPointsType === "data") continue;

      if (markerSub === "circle") {
        if (marker.isBorder) continue;

        if (marker.isCenter) {
          ctx.fillStyle = lightColor;
          ctx.fillRect(cX - cell * 2.5, cY - cell * 2.5, cell * 5, cell * 5);

          ctx.beginPath();
          ctx.fillStyle = darkColor;
          ctx.arc(cX, cY, cell * 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.fillStyle = lightColor;
          ctx.arc(cX, cY, cell * 1.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = darkColor;
        }
      }
    }

    function square(color = isDark ? darkColor : lightColor) {
      ctx.fillStyle = color;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }

    function dot(color = isDark ? darkColor : lightColor) {
      ctx.strokeStyle = "none";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x * cell + halfcell, y * cell + halfcell, halfcell, 0, Math.PI * 2);
      ctx.fill();
    }

    function corner(index: number, color?: string) {
      const pos = [
        [0, 0, 0, 1, 1, 0], // top left
        [0, 2, 0, 1, 1, 2], // bottom left
        [2, 0, 2, 1, 1, 0], // top right
        [2, 2, 2, 1, 1, 2], // bottom right
      ][index];

      const points: [number, number][] = [
        [x * cell + halfcell * (pos?.[0] ?? 0), y * cell + halfcell * (pos?.[1] ?? 0)],
        [x * cell + halfcell * (pos?.[2] ?? 0), y * cell + halfcell * (pos?.[3] ?? 0)],
        [x * cell + halfcell * (pos?.[4] ?? 0), y * cell + halfcell * (pos?.[5] ?? 0)],
      ];

      ctx.strokeStyle = "none";
      if (color) ctx.fillStyle = color;
      ctx.beginPath();
      if (!points[0]) return;
      ctx.moveTo(...points[0]);
      if (!points[1]) return;
      ctx.lineTo(...points[1]);
      if (!points[2]) return;
      ctx.arcTo(...points[0], ...points[2], halfcell + 2);
      ctx.lineTo(...points[0]);
      ctx.fill();
    }

    // Skip white pixels when its not rounded
    if (!isDark && state.backgroundImage && isBorder) continue;

    if (_pixelStyle === "dot") {
      dot();
    } else if (_pixelStyle === "squircle") {
      dot();
      for (let i = 0; i < 4; i++) {
        if (rand(x, y, `squircle-${i}`) < 0.5) corner(i);
      }
    } else if (_pixelStyle === "rounded" || _pixelStyle === "row" || _pixelStyle === "column") {
      function shouldConnect(dx: number, dy: number) {
        const pixel = pixels.find((p) => p.x === x + dx && p.y === y + dy);
        if (!pixel) return true;
        if (pixel.isIgnored || (pixel.isBorder && !pixel.isDark)) return null;
        return pixel.isDark;
      }

      const top = shouldConnect(0, -1);
      const bottom = shouldConnect(0, 1);
      const left = shouldConnect(-1, 0);
      const right = shouldConnect(1, 0);
      const topLeft = shouldConnect(-1, -1);
      const topRight = shouldConnect(1, -1);
      const bottomLeft = shouldConnect(-1, 1);
      const bottomRight = shouldConnect(1, 1);

      if (isDark) {
        const colors: (null | boolean)[] = [null, null, null, null];
        if (_pixelStyle !== "row") {
          colors[0] ||= top;
          colors[2] ||= top;
        }
        if (_pixelStyle !== "row") {
          colors[1] ||= bottom;
          colors[3] ||= bottom;
        }
        if (_pixelStyle !== "column") {
          colors[0] ||= left;
          colors[1] ||= left;
        }
        if (_pixelStyle !== "column") {
          colors[2] ||= right;
          colors[3] ||= right;
        }

        if (_pixelStyle === "rounded") {
          if ((top == null && left != null) || (left == null && top != null)) colors[0] ||= true;
          if ((top == null && right != null) || (right == null && top != null)) colors[2] ||= true;
          if ((bottom == null && left != null) || (left == null && bottom != null))
            colors[1] ||= true;
          if ((bottom == null && right != null) || (right == null && bottom != null))
            colors[3] ||= true;
        }

        colors.forEach((i, idx) => {
          if (i != null) corner(idx, i ? darkColor : lightColor);
        });
      } else {
        if (_pixelStyle === "rounded") {
          if (top != null || left != null)
            corner(0, top && left && topLeft && !isBorder ? darkColor : lightColor);
          if (top != null || right != null)
            corner(2, top && right && topRight && !isBorder ? darkColor : lightColor);
          if (bottom != null || left != null)
            corner(1, bottom && left && bottomLeft && !isBorder ? darkColor : lightColor);
          if (bottom != null || right != null)
            corner(3, bottom && right && bottomRight && !isBorder ? darkColor : lightColor);
        } else if (_pixelStyle === "row") {
          if (left != null) {
            corner(0, lightColor);
            corner(1, lightColor);
          }
          if (right != null) {
            corner(2, lightColor);
            corner(3, lightColor);
          }
        } else if (_pixelStyle === "column") {
          if (top != null) {
            corner(0, lightColor);
            corner(2, lightColor);
          }
          if (bottom != null) {
            corner(1, lightColor);
            corner(3, lightColor);
          }
        }
      }
      dot();
    } else {
      square();
    }
  }

  await applyPerspective();

  if (state.effectTiming === "after") await applyBackground();

  if (state.effect === "crystalize") {
    const data = ctx.getImageData(0, 0, width, height);
    const newData = effects.crystalize(data, state.effectCrystalizeRadius, state.seed);
    ctx.putImageData(newData, 0, 0);
  } else if (state.effect === "liquidify") {
    const data = ctx.getImageData(0, 0, width, height);
    const newData1 = state.effectLiquidifyDistortRadius
      ? effects.crystalize(data, state.effectLiquidifyDistortRadius, state.seed)
      : data;
    const newData2 = effects.liquidify(
      newData1,
      state.effectLiquidifyRadius,
      state.effectLiquidifyThreshold,
      state.lightColor,
      state.darkColor,
    );
    ctx.putImageData(newData2, 0, 0);
  }

  if (state.effectTiming === "before") await applyBackground();

  // final, copy offscreen canvas to the real one
  outCanvas.width = width;
  outCanvas.height = height;
  const realCtx = outCanvas.getContext("2d")!;
  realCtx.save();

  // Set background
  realCtx.fillStyle = invert ? state.darkColor : effectiveLightColor;
  realCtx.fillRect(0, 0, width, height);

  realCtx.setTransform(
    state.transformScale,
    0,
    0,
    state.transformScale,
    (-(state.transformScale - 1) * width) / 2,
    (-(state.transformScale - 1) * height) / 2,
  );
  realCtx.drawImage(canvas, 0, 0, width, height);
  realCtx.restore();

  // Draw logo in center if provided
  if (state.logoImage) {
    try {
      await drawLogo(realCtx, width, height, state);
    } catch (error) {
      console.warn(
        `Failed to draw logo (${state.logoImage.substring(0, 50)}...):`,
        error instanceof Error ? error.message : error
      );
      // Continue without the logo - QR code is still valid
    }
  }

  async function applyPerspective() {
    if (state.transformPerspectiveX === 0 && state.transformPerspectiveY === 0) return;

    const data = ctx.getImageData(0, 0, width, height);
    ctx.clearRect(0, 0, width, height);
    const perspective = new Perspective(ctx as unknown as CanvasRenderingContext2D, data);

    const perspectiveX = state.transformPerspectiveX;
    const perspectiveY = state.transformPerspectiveY;

    const pos = {
      topLeftX: 0,
      topLeftY: 0,
      bottomLeftX: 0,
      bottomLeftY: height,
      topRightX: width,
      topRightY: 0,
      bottomRightX: width,
      bottomRightY: height,
    };

    if (perspectiveX !== 0) {
      const offsetX = Math.abs((width * perspectiveX) / 2);
      const offsetY = Math.abs((height * perspectiveX) / 3);

      // perspectiveX
      pos.topLeftX += offsetX;
      pos.topRightX -= offsetX;
      pos.bottomLeftX += offsetX;
      pos.bottomRightX -= offsetX;
      if (perspectiveX > 0) {
        pos.topRightY += offsetY;
        pos.bottomRightY -= offsetY;
      } else {
        pos.topLeftY += offsetY;
        pos.bottomLeftY -= offsetY;
      }
    }

    // perspectiveY
    if (perspectiveY !== 0) {
      const offsetX = Math.abs((width * perspectiveY) / 3);
      const offsetY = Math.abs((height * perspectiveY) / 2);

      pos.topLeftY += offsetY;
      pos.topRightY += offsetY;
      pos.bottomLeftY -= offsetY;
      pos.bottomRightY -= offsetY;
      if (perspectiveY > 0) {
        pos.bottomLeftX += offsetX;
        pos.bottomRightX -= offsetX;
      } else {
        pos.topLeftX += offsetX;
        pos.topRightX -= offsetX;
      }
    }

    perspective.draw(pos);
  }

  async function applyBackground() {
    const clone = document.createElement("canvas");
    clone.width = width;
    clone.height = height;
    clone.getContext("2d")!.putImageData(ctx.getImageData(0, 0, width, height), 0, 0);

    // Set background
    ctx.fillStyle = invert ? state.darkColor : effectiveLightColor;
    ctx.fillRect(0, 0, width, height);

    // Only apply background image if not transparent
    if (state.backgroundImage && !state.transparent) {
      if (state.backgroundImage.startsWith("#")) {
        ctx.fillStyle = state.backgroundImage;
        ctx.fillRect(0, 0, width, height);
      } else {
        const img = new Image();
        img.src = state.backgroundImage;
        await new Promise((resolve) => (img.onload = resolve)).then();
        // draw the image full cover the canvas with aspect ratio
        const imgRatio = img.width / img.height;
        const canvasRatio = width / height;
        if (imgRatio < canvasRatio)
          ctx.drawImage(img, 0, (height - width / imgRatio) / 2, width, width / imgRatio);
        else ctx.drawImage(img, (width - height * imgRatio) / 2, 0, height * imgRatio, height);
      }
    }

    ctx.drawImage(clone, 0, 0);
  }

  return {
    qrcode: qr,
    info: { width, height },
  };
}

function createQrInstance(state: QRCodeGeneratorState) {
  const qr = encode(state.text || "ishortn.ink", {
    minVersion: state.minVersion,
    maxVersion: state.maxVersion,
    ecc: state.ecc,
    maskPattern: state.maskPattern,
    boostEcc: state.boostECC,
    border: 0,
  });
  return qr;
}

function pointToLineProjection(
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

async function drawLogo(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  state: QRCodeGeneratorState,
) {
  if (!state.logoImage) return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = state.logoImage;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load logo image"));
  });

  // Calculate logo size based on percentage of QR code size
  const qrSize = Math.min(canvasWidth, canvasHeight);
  const logoSize = (qrSize * state.logoSize) / 100;
  const logoMargin = state.logoMargin;
  const totalSize = logoSize + logoMargin * 2;

  // Calculate center position
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // Draw white background with border radius for the logo area
  ctx.save();

  // Create rounded rectangle path for the background
  const bgX = centerX - totalSize / 2;
  const bgY = centerY - totalSize / 2;
  const borderRadius = (totalSize * state.logoBorderRadius) / 100;

  ctx.beginPath();
  ctx.roundRect(bgX, bgY, totalSize, totalSize, borderRadius);
  ctx.fillStyle = state.lightColor;
  ctx.fill();

  // Clip to rounded rectangle for the logo
  const logoX = centerX - logoSize / 2;
  const logoY = centerY - logoSize / 2;
  const logoBorderRadius = (logoSize * state.logoBorderRadius) / 100;

  ctx.beginPath();
  ctx.roundRect(logoX, logoY, logoSize, logoSize, logoBorderRadius);
  ctx.clip();

  // Draw the logo image, maintaining aspect ratio
  const imgRatio = img.width / img.height;
  let drawWidth: number;
  let drawHeight: number;
  let drawX: number;
  let drawY: number;

  if (imgRatio > 1) {
    // Wider than tall
    drawHeight = logoSize;
    drawWidth = logoSize * imgRatio;
    drawX = logoX - (drawWidth - logoSize) / 2;
    drawY = logoY;
  } else {
    // Taller than wide or square
    drawWidth = logoSize;
    drawHeight = logoSize / imgRatio;
    drawX = logoX;
    drawY = logoY - (drawHeight - logoSize) / 2;
  }

  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}
