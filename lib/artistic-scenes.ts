import type { VisualMode } from "./visual-modes";

export interface ArtisticSceneOptions {
  context: CanvasRenderingContext2D;
  height: number;
  mode: VisualMode;
  pixelRatio: number;
  time: number;
  width: number;
}

function color(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function ring(context: CanvasRenderingContext2D, x: number, y: number, radius: number, stroke: string, width: number): void {
  context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.strokeStyle = stroke; context.lineWidth = width; context.stroke();
}

/** Decorative art never owns protocol bits; the stable differential carrier remains underneath. */
export function drawArtisticScene({ context, height, mode, pixelRatio, time, width }: ArtisticSceneOptions): void {
  const side = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const t = time * 0.001;
  const [a, b, c] = mode.colors;
  context.save();
  context.globalCompositeOperation = "lighter";

  if (mode.kind === "curtain") {
    for (let band = 0; band < 9; band += 1) {
      context.beginPath();
      for (let step = 0; step <= 42; step += 1) {
        const x = cx - side * 0.48 + side * 0.96 * (step / 42);
        const y = cy + Math.sin(step * 0.34 + t * 0.55 + band) * side * (0.045 + band * 0.004) + (band - 4) * side * 0.035;
        step ? context.lineTo(x, y) : context.moveTo(x, y);
      }
      context.strokeStyle = color([a, b, c][band % 3], 0.17);
      context.lineWidth = side * (0.026 - band * 0.0015);
      context.stroke();
    }
  } else if (mode.kind === "rings") {
    for (let i = 0; i < 12; i += 1) ring(context, cx, cy, side * ((i + ((t * 0.28) % 1)) / 13) * 0.52, color([a, b, c][i % 3], 0.24), pixelRatio * (1.2 + (i % 3)));
  } else if (mode.kind === "petals") {
    context.translate(cx, cy); context.rotate(t * 0.045);
    for (let layer = 0; layer < 3; layer += 1) for (let i = 0; i < 12; i += 1) {
      context.save(); context.rotate((i / 12) * Math.PI * 2 + layer * 0.13);
      context.beginPath(); context.ellipse(0, -side * (0.13 + layer * 0.07), side * (0.045 + layer * 0.012), side * 0.14, 0, 0, Math.PI * 2);
      context.fillStyle = color([a, b, c][(i + layer) % 3], 0.13); context.fill(); context.restore();
    }
  } else if (mode.kind === "orbits") {
    for (let i = 1; i <= 6; i += 1) {
      const radius = side * (0.07 + i * 0.06); ring(context, cx, cy, radius, color([a, b, c][i % 3], 0.18), pixelRatio);
      const angle = t * (0.13 + i * 0.027) + i * 1.7; context.beginPath(); context.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, side * (0.007 + i * 0.0016), 0, Math.PI * 2); context.fillStyle = color([a, b, c][i % 3], 0.76); context.fill();
    }
  } else if (mode.kind === "nodes") {
    const points = Array.from({ length: 36 }, (_, i) => ({ x: cx + Math.cos(i * 2.4 + t * 0.025) * side * (0.08 + (i % 7) * 0.052), y: cy + Math.sin(i * 3.7 + t * 0.02) * side * (0.08 + (i % 6) * 0.055) }));
    context.strokeStyle = color(b, 0.09); context.lineWidth = pixelRatio;
    points.forEach((point, i) => { const next = points[(i * 7 + 5) % points.length]; context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(next.x, next.y); context.stroke(); context.beginPath(); context.arc(point.x, point.y, (2 + i % 3) * pixelRatio, 0, Math.PI * 2); context.fillStyle = color([a, b, c][i % 3], 0.65); context.fill(); });
  } else if (mode.kind === "tendrils") {
    context.beginPath(); context.ellipse(cx, cy - side * 0.12, side * 0.19, side * 0.13, 0, 0, Math.PI * 2); context.fillStyle = color(a, 0.12); context.fill();
    for (let i = 0; i < 14; i += 1) { context.beginPath(); const x = cx + (i - 6.5) * side * 0.026; context.moveTo(x, cy - side * 0.02); context.bezierCurveTo(x + Math.sin(t + i) * side * 0.06, cy + side * 0.12, x + Math.cos(t * 0.7 + i) * side * 0.08, cy + side * 0.27, x + Math.sin(t * 0.4 + i) * side * 0.05, cy + side * 0.42); context.strokeStyle = color([a, b, c][i % 3], 0.3); context.lineWidth = pixelRatio * 2; context.stroke(); }
  } else if (mode.kind === "clouds") {
    for (let i = 0; i < 42; i += 1) { const angle = i * 2.39 + t * 0.035; const radius = side * (0.04 + (i % 9) * 0.045); const x = cx + Math.cos(angle) * radius; const y = cy + Math.sin(angle * 0.8) * radius; const gradient = context.createRadialGradient(x, y, 0, x, y, side * (0.035 + i % 5 * 0.012)); gradient.addColorStop(0, color([a, b, c][i % 3], 0.18)); gradient.addColorStop(1, color(c, 0)); context.fillStyle = gradient; context.fillRect(x - side * 0.09, y - side * 0.09, side * 0.18, side * 0.18); }
  } else if (mode.kind === "weave") {
    for (let i = 0; i < 11; i += 1) { context.beginPath(); for (let s = 0; s <= 50; s += 1) { const x = cx - side * 0.46 + side * 0.92 * s / 50; const y = cy + (i - 5) * side * 0.052 + Math.sin(s * 0.28 + i + t * 0.18) * side * 0.052; s ? context.lineTo(x, y) : context.moveTo(x, y); } context.strokeStyle = color([a, b, c][i % 3], 0.24); context.lineWidth = pixelRatio * 2.4; context.stroke(); }
  } else if (mode.kind === "facets") {
    context.translate(cx, cy); context.rotate(t * 0.025);
    for (let ringIndex = 1; ringIndex <= 5; ringIndex += 1) for (let i = 0; i < 12; i += 1) { const r0 = side * ringIndex * 0.075; const r1 = r0 + side * 0.07; const p0 = i * Math.PI / 6; const p1 = p0 + Math.PI / 6; context.beginPath(); context.moveTo(Math.cos(p0) * r0, Math.sin(p0) * r0); context.lineTo(Math.cos(p0) * r1, Math.sin(p0) * r1); context.lineTo(Math.cos(p1) * r1, Math.sin(p1) * r1); context.closePath(); context.fillStyle = color([a, b, c][(i + ringIndex) % 3], 0.08 + ((i + ringIndex) % 3) * 0.035); context.fill(); }
  } else if (mode.kind === "glyph") {
    for (let i = 1; i <= 7; i += 1) { ring(context, cx, cy, side * i * 0.055, color([a, b, c][i % 3], 0.22), pixelRatio * (i % 2 ? 1 : 2)); for (let j = 0; j < i * 3; j += 1) { const angle = j * Math.PI * 2 / (i * 3) + t * (i % 2 ? 0.025 : -0.02); context.fillStyle = color([a, b, c][j % 3], 0.46); context.fillRect(cx + Math.cos(angle) * side * i * 0.055 - pixelRatio, cy + Math.sin(angle) * side * i * 0.055 - pixelRatio, pixelRatio * 2, pixelRatio * 2); } }
  } else if (mode.kind === "city") {
    for (let i = 0; i < 18; i += 1) { const bw = side * 0.045; const bh = side * (0.12 + ((i * 7) % 9) * 0.025); const x = cx - side * 0.45 + i * side * 0.05; const y = cy + side * 0.43 - bh; context.fillStyle = color(i % 2 ? a : b, 0.16); context.fillRect(x, y, bw, bh); for (let row = 0; row < 6; row += 1) for (let col = 0; col < 2; col += 1) { context.fillStyle = color(c, 0.18 + 0.28 * ((i + row + col + Math.floor(t)) % 2)); context.fillRect(x + bw * (0.2 + col * 0.42), y + side * (0.018 + row * 0.025), bw * 0.16, side * 0.009); } }
  } else if (mode.kind === "embers") {
    const flame = context.createRadialGradient(cx, cy + side * 0.22, 0, cx, cy + side * 0.2, side * 0.31); flame.addColorStop(0, color(c, 0.32)); flame.addColorStop(0.5, color(b, 0.12)); flame.addColorStop(1, color(a, 0)); context.fillStyle = flame; context.fillRect(cx - side * 0.35, cy - side * 0.2, side * 0.7, side * 0.7);
    for (let i = 0; i < 80; i += 1) { const life = (t * (0.08 + i % 5 * 0.012) + i * 0.071) % 1; const x = cx + Math.sin(i * 8.31 + life * 7) * side * (0.06 + life * 0.24); const y = cy + side * 0.31 - life * side * 0.72; context.beginPath(); context.arc(x, y, pixelRatio * (1 + i % 3), 0, Math.PI * 2); context.fillStyle = color([a, b, c][i % 3], (1 - life) * 0.72); context.fill(); }
  }
  context.restore();
}
