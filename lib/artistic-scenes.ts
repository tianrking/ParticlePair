import { visualModeVariant, type VisualMode } from "./visual-modes";

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
  const variant = visualModeVariant(mode.id);
  const phase = variant * Math.PI * 2;
  const t = time * 0.001 * (0.88 + variant * 0.28) + phase;
  const [a, b, c] = mode.colors;
  context.save();
  context.globalCompositeOperation = "lighter";

  if (mode.kind !== "galaxy") {
    const spectralLobes: readonly [number, number, string][] = [[-0.23 + Math.sin(phase) * 0.045, -0.18, a], [0.25, -0.04 + Math.cos(phase) * 0.04, b], [0.02 - Math.cos(phase) * 0.04, 0.25, c]];
    spectralLobes.forEach(([dx, dy, spectral], index) => {
      const x = cx + dx * side; const y = cy + dy * side;
      const glow = context.createRadialGradient(x, y, 0, x, y, side * (0.25 + index * 0.025));
      glow.addColorStop(0, color(spectral, 0.2)); glow.addColorStop(0.42, color(spectral, 0.085)); glow.addColorStop(1, color(spectral, 0));
      context.fillStyle = glow; context.fillRect(x - side * 0.32, y - side * 0.32, side * 0.64, side * 0.64);
    });
  }

  if (["nodes", "clouds", "city", "facets", "orbits"].includes(mode.kind)) {
    for (let index = 0; index < 24; index += 1) {
      const angle = index * (2.15 + variant * 0.52) + t * (0.18 + (index % 5) * 0.025);
      const radius = side * (0.1 + (index % 8) * 0.045);
      const x = cx + Math.cos(angle) * radius; const y = cy + Math.sin(angle * 1.13) * radius * 0.82;
      const mote = context.createRadialGradient(x, y, 0, x, y, side * 0.018);
      mote.addColorStop(0, color([a, b, c][index % 3], 0.58)); mote.addColorStop(1, color([a, b, c][index % 3], 0));
      context.fillStyle = mote; context.fillRect(x - side * 0.022, y - side * 0.022, side * 0.044, side * 0.044);
    }
  }

  if (mode.kind === "curtain") {
    for (let band = 0; band < 9; band += 1) {
      context.beginPath();
      for (let step = 0; step <= 42; step += 1) {
        const x = cx - side * 0.48 + side * 0.96 * (step / 42);
        const y = cy + Math.sin(step * (0.25 + variant * 0.2) + t * 0.55 + band) * side * (0.045 + band * 0.004) + (band - 4) * side * 0.035 + (step / 42 - 0.5) * (variant - 0.5) * side * 0.18;
        if (step) context.lineTo(x, y); else context.moveTo(x, y);
      }
      context.strokeStyle = color([a, b, c][band % 3], 0.17);
      context.lineWidth = side * (0.026 - band * 0.0015);
      context.stroke();
    }
  } else if (mode.kind === "rings") {
    const ringCount = 9 + Math.floor(variant * 7);
    for (let i = 0; i < ringCount; i += 1) ring(context, cx + Math.cos(phase + i) * side * 0.008 * variant, cy + Math.sin(phase + i) * side * 0.008 * variant, side * ((i + ((t * 0.28) % 1)) / (ringCount + 1)) * 0.52, color([a, b, c][i % 3], 0.24), pixelRatio * (1.2 + (i % 3)));
  } else if (mode.kind === "petals") {
    context.translate(cx, cy); context.rotate(t * 0.045);
    const petalCount = 8 + Math.floor(variant * 8);
    for (let layer = 0; layer < 3; layer += 1) for (let i = 0; i < petalCount; i += 1) {
      context.save(); context.rotate((i / petalCount) * Math.PI * 2 + layer * (0.09 + variant * 0.1));
      context.beginPath(); context.ellipse(0, -side * (0.13 + layer * 0.07), side * (0.036 + variant * 0.025 + layer * 0.008), side * (0.12 + variant * 0.05), 0, 0, Math.PI * 2);
      context.fillStyle = color([a, b, c][(i + layer) % 3], mode.id === "circuit" ? 0.13 : 0.18 + variant * 0.035); context.fill(); context.restore();
    }
  } else if (mode.kind === "orbits") {
    for (let i = 1; i <= 6; i += 1) {
      const radius = side * (0.07 + i * 0.06); ring(context, cx + Math.cos(phase + i) * side * 0.006, cy, radius, color([a, b, c][i % 3], 0.28), pixelRatio * 1.2);
      const angle = t * (0.1 + variant * 0.08 + i * 0.027) + i * (1.35 + variant * 0.7); context.beginPath(); context.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * (0.72 + variant * 0.42), side * (0.007 + i * 0.0016), 0, Math.PI * 2); context.fillStyle = color([a, b, c][i % 3], 0.92); context.fill();
    }
  } else if (mode.kind === "nodes") {
    const points = Array.from({ length: 36 }, (_, i) => ({ x: cx + Math.cos(i * 2.4 + t * 0.025) * side * (0.08 + (i % 7) * 0.052), y: cy + Math.sin(i * 3.7 + t * 0.02) * side * (0.08 + (i % 6) * 0.055) }));
    context.strokeStyle = color(b, 0.24); context.lineWidth = pixelRatio * 1.35;
    const stride = 3 + Math.floor(variant * 9);
    points.forEach((point, i) => { const next = points[(i * stride + 5) % points.length]; context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(next.x, next.y); context.stroke(); context.beginPath(); context.arc(point.x, point.y, (2.1 + variant + i % 3) * pixelRatio, 0, Math.PI * 2); context.fillStyle = color([a, b, c][i % 3], 0.9); context.fill(); });
  } else if (mode.kind === "tendrils") {
    const legacyAnemone = mode.id === "anemone";
    const reliableJellyfish = mode.id === "jellyfish";
    context.beginPath(); context.ellipse(cx, cy - side * 0.12, side * (reliableJellyfish ? 0.21 : 0.19), side * 0.13, 0, 0, Math.PI * 2); context.fillStyle = color(a, legacyAnemone ? 0.12 : reliableJellyfish ? 0.1 : 0.19); context.fill();
    if (reliableJellyfish) { context.beginPath(); context.ellipse(cx, cy - side * 0.12, side * 0.25, side * 0.17, 0, Math.PI * 1.08, Math.PI * 1.92); context.strokeStyle = color(c, 0.48); context.lineWidth = pixelRatio * 3; context.stroke(); for (const sideSign of [-1, 1]) { context.beginPath(); context.ellipse(cx + sideSign * side * 0.22, cy - side * 0.1, side * 0.055, side * 0.12, sideSign * 0.32, 0, Math.PI * 2); context.fillStyle = color(b, 0.14); context.fill(); } }
    if (legacyAnemone) for (let bead = 0; bead < 10; bead += 1) { const beadAngle = bead * Math.PI / 5; context.beginPath(); context.arc(cx + Math.cos(beadAngle) * side * 0.225, cy - side * 0.1 + Math.sin(beadAngle) * side * 0.19, pixelRatio * (2.3 + bead % 2), 0, Math.PI * 2); context.fillStyle = color(c, 0.58); context.fill(); }
    const tendrilCount = legacyAnemone ? 14 : reliableJellyfish ? 11 : 10 + Math.floor(variant * 9); const flowTime = legacyAnemone ? time * 0.00065 : reliableJellyfish ? time * 0.0008 : t;
    for (let i = 0; i < tendrilCount; i += 1) { context.beginPath(); const x = cx + (legacyAnemone ? (i - 6.5) * side * 0.026 : (i - (tendrilCount - 1) / 2) * side * (reliableJellyfish ? 0.027 : 0.32 / tendrilCount)); context.moveTo(x, cy - side * 0.02); context.bezierCurveTo(x + Math.sin(flowTime + i) * side * (legacyAnemone ? 0.052 : reliableJellyfish ? 0.045 : 0.04 + variant * 0.04), cy + side * 0.12, x + Math.cos(flowTime * 0.7 + i) * side * (legacyAnemone ? 0.065 : reliableJellyfish ? 0.06 : 0.08), cy + side * 0.27, x + Math.sin(flowTime * 0.4 + i) * side * (legacyAnemone ? 0.043 : reliableJellyfish ? 0.04 : 0.035 + variant * 0.04), cy + side * 0.42); context.strokeStyle = color([a, b, c][i % 3], legacyAnemone ? 0.36 : reliableJellyfish ? 0.38 : 0.56); context.lineWidth = pixelRatio * (legacyAnemone ? 2.2 : reliableJellyfish ? 2 : 1.8 + variant * 1.4); context.stroke(); }
  } else if (mode.kind === "clouds") {
    for (let i = 0; i < 42; i += 1) { const angle = i * (2.05 + variant * 0.72) + t * (0.045 + variant * 0.04); const radius = side * (0.04 + (i % 9) * 0.045); const x = cx + Math.cos(angle) * radius; const y = cy + Math.sin(angle * (0.62 + variant * 0.5)) * radius; const gradient = context.createRadialGradient(x, y, 0, x, y, side * (0.03 + variant * 0.015 + i % 5 * 0.012)); gradient.addColorStop(0, color([a, b, c][i % 3], 0.4)); gradient.addColorStop(1, color(c, 0)); context.fillStyle = gradient; context.fillRect(x - side * 0.09, y - side * 0.09, side * 0.18, side * 0.18); }
  } else if (mode.kind === "weave") {
    const legacyLaser = mode.id === "laser-weave";
    context.translate(cx, cy); context.rotate(legacyLaser ? 0 : (variant - 0.5) * 0.36); context.translate(-cx, -cy);
    const strandCount = legacyLaser ? 11 : 8 + Math.floor(variant * 7);
    for (let i = 0; i < strandCount; i += 1) { context.beginPath(); for (let s = 0; s <= 50; s += 1) { const x = cx - side * 0.46 + side * 0.92 * s / 50; const y = cy + (legacyLaser ? (i - 5) * side * 0.052 : (i - (strandCount - 1) / 2) * side * (0.58 / strandCount)) + Math.sin(s * (legacyLaser ? 0.28 : 0.2 + variant * 0.18) + i + t * (legacyLaser ? 0.18 : 0.22)) * side * (legacyLaser ? 0.052 : 0.035 + variant * 0.04); if (s) context.lineTo(x, y); else context.moveTo(x, y); } context.strokeStyle = color([a, b, c][i % 3], legacyLaser ? 0.24 : 0.4); context.lineWidth = pixelRatio * (legacyLaser ? 2.4 : 1.7 + variant * 1.4); context.stroke(); }
    if (legacyLaser) for (let pin = 0; pin < 7; pin += 1) { const x = cx + (pin - 3) * side * 0.105; context.beginPath(); context.moveTo(x, cy - side * 0.31); context.lineTo(x, cy + side * 0.31); context.strokeStyle = color([a, b, c][pin % 3], 0.28); context.lineWidth = pixelRatio * 1.2; context.stroke(); }
  } else if (mode.kind === "facets") {
    context.translate(cx, cy); context.rotate(t * 0.025);
    const facetCount = 6 + Math.floor(variant * 8);
    for (let ringIndex = 1; ringIndex <= 5; ringIndex += 1) for (let i = 0; i < facetCount; i += 1) { const r0 = side * ringIndex * 0.075; const r1 = r0 + side * (0.055 + variant * 0.03); const p0 = i * Math.PI * 2 / facetCount; const p1 = p0 + Math.PI * 2 / facetCount; context.beginPath(); context.moveTo(Math.cos(p0) * r0, Math.sin(p0) * r0); context.lineTo(Math.cos(p0) * r1, Math.sin(p0) * r1); context.lineTo(Math.cos(p1) * r1, Math.sin(p1) * r1); context.closePath(); context.fillStyle = color([a, b, c][(i + ringIndex) % 3], 0.18 + ((i + ringIndex) % 3) * 0.07); context.fill(); }
  } else if (mode.kind === "glyph") {
    const glyphRings = 5 + Math.floor(variant * 4);
    for (let i = 1; i <= glyphRings; i += 1) { ring(context, cx, cy, side * i * (0.38 / glyphRings), color([a, b, c][i % 3], 0.48), pixelRatio * (i % 2 ? 1.4 : 2.8)); const ticks = i * (2 + Math.floor(variant * 3)); for (let j = 0; j < ticks; j += 1) { const angle = j * Math.PI * 2 / ticks + t * (i % 2 ? 0.085 : -0.065); context.fillStyle = color([a, b, c][j % 3], 0.84); context.fillRect(cx + Math.cos(angle) * side * i * (0.38 / glyphRings) - pixelRatio, cy + Math.sin(angle) * side * i * (0.38 / glyphRings) - pixelRatio, pixelRatio * 2.8, pixelRatio * 2.8); } }
    const seal = context.createRadialGradient(cx, cy, 0, cx, cy, side * 0.12); seal.addColorStop(0, color(c, 0.34)); seal.addColorStop(0.45, color(a, 0.12)); seal.addColorStop(1, color(b, 0)); context.fillStyle = seal; context.fillRect(cx - side * 0.13, cy - side * 0.13, side * 0.26, side * 0.26);
    if (variant < 0.25) {
      for (let spoke = 0; spoke < 7; spoke += 1) { const angle = spoke * Math.PI * 2 / 7 + t * 0.035; context.beginPath(); context.moveTo(cx + Math.cos(angle) * side * 0.08, cy + Math.sin(angle) * side * 0.08); context.lineTo(cx + Math.cos(angle) * side * 0.36, cy + Math.sin(angle) * side * 0.36); context.strokeStyle = color([a, b, c][spoke % 3], 0.42); context.lineWidth = pixelRatio * 1.8; context.stroke(); }
    } else if (variant < 0.5) {
      context.save(); context.translate(cx, cy); context.rotate(t * 0.04); for (let petal = 0; petal < 10; petal += 1) { context.save(); context.rotate(petal * Math.PI / 5); context.beginPath(); context.ellipse(0, -side * 0.23, side * 0.035, side * 0.14, 0, 0, Math.PI * 2); context.fillStyle = color([a, b, c][petal % 3], 0.22); context.fill(); context.restore(); } context.restore();
    } else if (variant < 0.75) {
      context.beginPath(); context.ellipse(cx, cy, side * 0.13, side * 0.34, 0, 0, Math.PI * 2); context.fillStyle = color(b, 0.22); context.fill();
      for (let portal = -1; portal <= 1; portal += 2) { context.save(); context.translate(cx + portal * side * 0.11, cy); context.scale(0.58, 1.08); ring(context, 0, 0, side * 0.29, color(portal < 0 ? a : c, 0.62), pixelRatio * 3.4); context.restore(); } context.strokeStyle = color(b, 0.72); context.lineWidth = pixelRatio * 2.4; context.strokeRect(cx - side * 0.085, cy - side * 0.19, side * 0.17, side * 0.38);
    } else {
      context.save(); context.translate(cx, cy); context.rotate(t * -0.045); for (let layer = 1; layer <= 4; layer += 1) { context.beginPath(); for (let vertex = 0; vertex < 3; vertex += 1) { const angle = -Math.PI / 2 + vertex * Math.PI * 2 / 3; const radius = side * layer * 0.085; if (vertex) context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); else context.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius); } context.closePath(); context.strokeStyle = color([a, b, c][layer % 3], 0.5); context.lineWidth = pixelRatio * (1 + layer * 0.45); context.stroke(); } context.restore(); for (let scan = -3; scan <= 3; scan += 1) { context.fillStyle = color(scan % 2 ? a : c, 0.16); context.fillRect(cx - side * 0.3, cy + scan * side * 0.055, side * 0.6, pixelRatio); }
    }
  } else if (mode.kind === "city") {
    const buildingCount = 14 + Math.floor(variant * 9); const spacing = side * 0.9 / buildingCount;
    for (let i = 0; i < buildingCount; i += 1) { const bw = spacing * (0.72 + (i % 3) * 0.08); const bh = side * (0.1 + ((i * (5 + Math.floor(variant * 6))) % 11) * 0.022); const x = cx - side * 0.45 + i * spacing; const y = cy + side * 0.43 - bh; context.fillStyle = color(i % 2 ? a : b, 0.3); context.fillRect(x, y, bw, bh); for (let row = 0; row < 6; row += 1) for (let col = 0; col < 2; col += 1) { context.fillStyle = color(c, 0.26 + 0.4 * (0.5 + Math.sin(t * 2.2 + i + row * 0.8 + col) * 0.5)); context.fillRect(x + bw * (0.2 + col * 0.42), y + side * (0.018 + row * 0.025), bw * 0.16, side * 0.009); } }
  } else if (mode.kind === "embers") {
    const legacyStardust = mode.id === "stardust"; const emberTime = legacyStardust ? time * 0.001 : t;
    const flame = context.createRadialGradient(cx, cy + side * 0.22, 0, cx, cy + side * 0.2, side * 0.31); flame.addColorStop(0, color(c, legacyStardust ? 0.32 : 0.4)); flame.addColorStop(0.5, color(b, legacyStardust ? 0.12 : 0.16)); flame.addColorStop(1, color(a, 0)); context.fillStyle = flame; context.fillRect(cx - side * 0.35, cy - side * 0.2, side * 0.7, side * 0.7);
    const emberCount = legacyStardust ? 80 : 128;
    for (let i = 0; i < emberCount; i += 1) { const life = (emberTime * (legacyStardust ? 0.08 + i % 5 * 0.012 : 0.095 + variant * 0.055 + i % 5 * 0.012) + i * 0.071) % 1; const x = legacyStardust ? cx + Math.sin(i * 8.31 + life * 7) * side * (0.06 + life * 0.24) : cx + Math.sin(i * (6.8 + variant * 3) + life * (5 + variant * 5)) * side * (0.04 + variant * 0.04 + life * (0.16 + variant * 0.13)); const y = cy + side * 0.31 - life * side * (legacyStardust ? 0.72 : 0.64 + variant * 0.16); context.beginPath(); context.arc(x, y, pixelRatio * (legacyStardust ? 1 + i % 3 : 1.25 + variant + (i % 3) * 1.1), 0, Math.PI * 2); context.fillStyle = color([a, b, c][i % 3], (1 - life) * (legacyStardust ? 0.72 : 0.94)); context.fill(); }
    if (legacyStardust) for (let mote = 0; mote < 110; mote += 1) { const x = cx + Math.sin(mote * 91.73) * side * 0.43; const y = cy + Math.sin(mote * 47.21 + 1.7) * side * 0.42; context.beginPath(); context.arc(x, y, pixelRatio * (1.4 + mote % 3), 0, Math.PI * 2); context.fillStyle = color([a, b, c][mote % 3], 0.5 + (mote % 4) * 0.1); context.fill(); }
  }
  context.restore();
}
