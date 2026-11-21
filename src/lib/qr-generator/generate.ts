import { clientLogger } from "@/lib/logger/client";

import { effects } from "./effects";
import Perspective from "./perspective";
import { computePixels, createQrInstance, pointToLineProjection, seededRandom } from "./pixels";

import type { PixelInfo } from "./pixels";
import type { GenerateQRCodeResult, QRCodeGeneratorState } from "./types";

export async function generateQRCode(
  outCanvas: HTMLCanvasElement,
  state: QRCodeGeneratorState,
): Promise<GenerateQRCodeResult | null> {
  if (!outCanvas) return null;

  const qr = createQrInstance(state);

  const { scale: cell, margin, seed, pixelStyle, markerSub, invert, renderPointsType } = state;

  const halfcell = cell / 2;
  const width: number = (qr.size + margin * 2) * cell;
  const height: number = (qr.size + margin * 2) * cell;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.imageRendering = "pixelated";
  canvas.style.imageRendering = "crisp-edges";
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;

  // Define effective light color once
  const effectiveLightColor = state.transparent ? "rgba(0,0,0,0)" : state.lightColor;

  // Set initial background
  ctx.fillStyle = invert ? state.darkColor : effectiveLightColor;
  ctx.fillRect(0, 0, width, height);

  const rand = (x: number, y: number, type: string) => seededRandom(seed, x, y, type);

  const pixels = computePixels(qr, state);

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

    const opacity = isBorder ? state.marginNoiseOpacity : 1;
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

      const { markerFrame } = marker.style;

      _pixelStyle = _markerStyle;

      if (renderPointsType === "data") continue;

      if (markerFrame === "circle") {
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
      } else if (markerFrame === "octagon") {
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
        const { markerCenter } = marker.style;
        // inner markers
        if (markerCenter === "circle") {
          if (marker.isCenter) {
            ctx.fillStyle = lightColor;
            ctx.fillRect(cX - cell * 1.5, cY - cell * 1.5, cell * 3, cell * 3);
            ctx.beginPath();
            ctx.fillStyle = darkColor;
            ctx.arc(cX, cY, cell * 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          continue;
        } else if (markerCenter === "eye") {
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
        } else if (markerCenter === "diamond") {
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
      clientLogger.warn(
        {
          err: error instanceof Error ? error.message : String(error),
          logoImagePreview: state.logoImage.substring(0, 50),
        },
        "failed to draw logo; continuing without it",
      );
    }
  }

  async function applyPerspective() {
    if (state.transformPerspectiveX === 0 && state.transformPerspectiveY === 0) return;

    const data = ctx.getImageData(0, 0, width, height);
    ctx.clearRect(0, 0, width, height);
    const perspective = new Perspective(ctx, data);

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
