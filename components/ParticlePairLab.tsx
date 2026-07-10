"use client";

/* eslint-disable @next/next/no-img-element -- These are client-generated PNG evidence frames, not network assets. */

import { useEffect, useMemo, useRef, useState } from "react";
import { ParticleCloud } from "./ParticleCloud";
import { OpticalScanner } from "./OpticalScanner";
import { extractPayloadBits, isBorderCell, layoutBits } from "../lib/optical-layout";
import {
  bytesToHex,
  createRandomSecret,
  decodeParticleCode,
  encodeParticleCode,
  hexToBytes,
  type DecodedParticleCode,
} from "../lib/protocol";
import {
  runRenderedPixelLoopback,
  type RenderedPixelLoopbackResult,
} from "../lib/rendered-pixel-loopback";
import {
  isLanguage,
  LANGUAGE_OPTIONS,
  UI_COPY,
  type Language,
} from "../lib/i18n";
import { VISUAL_CATEGORIES, VISUAL_MODES, visualMode as getVisualMode, type VisualCategory, type VisualModeId } from "../lib/visual-modes";

const LANGUAGE_STORAGE_KEY = "particlepair-language";
const MODE_STORAGE_KEY = "particlepair-visual-mode";

type TestStatus = "idle" | "running" | "success" | "error";
type LoopDetail =
  | { kind: "idle" | "new-secret" | "running" | "error" }
  | { kind: "success"; corrected: number };
type PixelDetail =
  | { kind: "idle" | "new-secret" | "running" | "mismatch" | "error" }
  | { kind: "success"; corrected: number; quality: number };
type Copy = (typeof UI_COPY)[Language];

function randomSecretHex(): string {
  return bytesToHex(createRandomSecret());
}

function loopDetailText(detail: LoopDetail, copy: Copy): string {
  switch (detail.kind) {
    case "new-secret":
      return copy.loopNewSecret;
    case "running":
      return copy.loopRunning;
    case "success":
      return copy.loopSuccess(detail.corrected);
    case "error":
      return copy.loopError;
    default:
      return copy.loopIdle;
  }
}

function pixelDetailText(detail: PixelDetail, copy: Copy): string {
  switch (detail.kind) {
    case "new-secret":
      return copy.pixelNewSecret;
    case "running":
      return copy.pixelRunningDetail;
    case "success":
      return copy.pixelSuccessDetail(detail.quality, detail.corrected);
    case "mismatch":
      return copy.pixelMismatch;
    case "error":
      return copy.pixelGenericError;
    default:
      return copy.pixelIdleDetail;
  }
}

export function ParticlePairLab() {
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const [language, setLanguage] = useState<Language>("en");
  const [secretHex, setSecretHex] = useState("");
  const [strength, setStrength] = useState(0.9);
  const [paused, setPaused] = useState(false);
  const [visualMode, setVisualMode] = useState<VisualModeId>("galaxy");
  const [modeQuery, setModeQuery] = useState("");
  const [modeCategory, setModeCategory] = useState<"All" | VisualCategory>("All");
  const [autoShowcase, setAutoShowcase] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [matrixStatus, setMatrixStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [matrixProgress, setMatrixProgress] = useState(0);
  const [matrixFailures, setMatrixFailures] = useState<string[]>([]);
  const [result, setResult] = useState<DecodedParticleCode | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testDetail, setTestDetail] = useState<LoopDetail>({ kind: "idle" });
  const [pixelTestStatus, setPixelTestStatus] = useState<TestStatus>("idle");
  const [pixelTestDetail, setPixelTestDetail] = useState<PixelDetail>({ kind: "idle" });
  const [pixelResult, setPixelResult] = useState<RenderedPixelLoopbackResult | null>(null);
  const copy = UI_COPY[language];

  useEffect(() => {
    // Generate the initial secret only after hydration so it never appears in
    // server-rendered HTML and cannot diverge between the server and iOS Safari.
    const initializationFrame = window.requestAnimationFrame(() => {
      setSecretHex(randomSecretHex());
      try {
        const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (isLanguage(savedLanguage)) {
          setLanguage(savedLanguage);
        }
        const savedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
        if (savedMode && VISUAL_MODES.some((mode) => mode.id === savedMode)) setVisualMode(savedMode);
      } catch {
        // Language persistence is optional when storage is blocked.
      }
    });

    return () => window.cancelAnimationFrame(initializationFrame);
  }, []);

  useEffect(() => {
    if (!autoShowcase) return;
    const interval = window.setInterval(() => {
      setVisualMode((current) => {
        const index = VISUAL_MODES.findIndex((mode) => mode.id === current);
        return VISUAL_MODES[(index + 1) % VISUAL_MODES.length].id;
      });
    }, 4200);
    return () => window.clearInterval(interval);
  }, [autoShowcase]);

  useEffect(() => {
    if (!immersive) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setImmersive(false); };
    document.body.classList.add("is-immersive");
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.classList.remove("is-immersive"); window.removeEventListener("keydown", onKeyDown); };
  }, [immersive]);

  useEffect(() => {
    const option = LANGUAGE_OPTIONS.find(({ code }) => code === language);
    document.documentElement.lang = option?.htmlLang ?? "en";
  }, [language]);

  const frame = useMemo(() => {
    try {
      return layoutBits(encodeParticleCode(hexToBytes(secretHex)));
    } catch {
      return layoutBits(encodeParticleCode(new Uint8Array(16)));
    }
  }, [secretHex]);

  const selectLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // The UI can still switch languages when storage is unavailable.
    }
  };

  const regenerate = () => {
    setSecretHex(randomSecretHex());
    setResult(null);
    setPixelResult(null);
    setPixelTestStatus("idle");
    setPixelTestDetail({ kind: "new-secret" });
    setTestStatus("idle");
    setTestDetail({ kind: "new-secret" });
  };

  const validSecret = /^[0-9a-f]{32}$/i.test(secretHex);
  const selectedVisualMode = getVisualMode(visualMode);
  const filteredModes = VISUAL_MODES.filter((mode) => {
    const categoryMatches = modeCategory === "All" || mode.category === modeCategory;
    const query = modeQuery.trim().toLowerCase();
    return categoryMatches && (!query || `${mode.name} ${mode.subtitle} ${mode.category}`.toLowerCase().includes(query));
  });

  const selectVisualMode = (mode: VisualModeId) => {
    setVisualMode(mode);
    setAutoShowcase(false);
    try { window.localStorage.setItem(MODE_STORAGE_KEY, mode); } catch { /* Persistence is optional. */ }
  };

  const stepVisualMode = (direction: -1 | 1) => {
    const current = VISUAL_MODES.findIndex((mode) => mode.id === visualMode);
    selectVisualMode(VISUAL_MODES[(current + direction + VISUAL_MODES.length) % VISUAL_MODES.length].id);
  };

  const runPixelLoopbackTest = async () => {
    const canvas = particleCanvasRef.current;
    if (!canvas || !validSecret) return;

    setPixelTestStatus("running");
    setPixelTestDetail({ kind: "running" });
    setPixelResult(null);

    try {
      const decoded = await runRenderedPixelLoopback(canvas, frame, strength, secretHex, visualMode);
      setPixelResult(decoded);
      setResult({
        correctedCodewords: decoded.correctedCodewords,
        secret: hexToBytes(decoded.recoveredSecretHex),
        secretHex: decoded.recoveredSecretHex,
      });

      if (!decoded.matchesExpected) {
        setPixelTestStatus("error");
        setPixelTestDetail({ kind: "mismatch" });
        return;
      }

      setPixelTestStatus("success");
      setPixelTestDetail({
        kind: "success",
        corrected: decoded.correctedCodewords,
        quality: Math.round(decoded.quality * 100),
      });
    } catch {
      setPixelTestStatus("error");
      setPixelTestDetail({ kind: "error" });
    }
  };

  const runModeMatrix = async () => {
    const canvas = particleCanvasRef.current;
    if (!canvas || !validSecret) return;
    setMatrixStatus("running"); setMatrixProgress(0); setMatrixFailures([]); setAutoShowcase(false);
    const failures: string[] = [];
    for (let index = 0; index < VISUAL_MODES.length; index += 1) {
      const mode = VISUAL_MODES[index];
      try {
        const decoded = await runRenderedPixelLoopback(canvas, frame, strength, secretHex, mode.id);
        if (!decoded.matchesExpected) failures.push(mode.name);
      } catch { failures.push(mode.name); }
      setMatrixProgress(index + 1);
      if (index % 4 === 3) await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    setMatrixFailures(failures);
    setMatrixStatus(failures.length ? "error" : "success");
  };

  const runLoopbackTest = () => {
    setTestStatus("running");
    setTestDetail({ kind: "running" });

    window.setTimeout(() => {
      try {
        const noisyCells = [...frame];
        const payloadIndices = noisyCells
          .map((_, index) => index)
          .filter((index) => !isBorderCell(index));

        // Flip three bits in separate Hamming codewords to exercise correction.
        [13, 91, 181].forEach((payloadOffset) => {
          const cellIndex = payloadIndices[payloadOffset];
          noisyCells[cellIndex] = !noisyCells[cellIndex];
        });

        const decoded = decodeParticleCode(extractPayloadBits(noisyCells));
        setResult(decoded);
        setTestStatus("success");
        setTestDetail({ kind: "success", corrected: decoded.correctedCodewords });
      } catch {
        setTestStatus("error");
        setTestDetail({ kind: "error" });
      }
    }, 650);
  };

  const linkStatusTitle =
    testStatus === "success"
      ? copy.linkSuccess
      : testStatus === "error"
        ? copy.linkError
        : testStatus === "running"
          ? copy.linkRunning
          : copy.linkIdle;
  const pixelStatusTitle =
    pixelTestStatus === "success"
      ? copy.pixelSuccess
      : pixelTestStatus === "error"
        ? copy.pixelError
        : pixelTestStatus === "running"
          ? copy.pixelRunning
          : copy.pixelIdle;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label={copy.homeLabel}>
          <span className="brand-mark"><i /><i /><i /></span>
          <span>PARTICLEPAIR</span>
        </a>
        <div className="protocol-pill"><span /> Optical OOB · v1</div>
        <div className="topbar-actions">
          <a className="text-link" href="#protocol">{copy.protocolLink} <span>↗</span></a>
          <nav className="language-switcher" aria-label={copy.languageSelector}>
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                className={language === option.code ? "is-active" : ""}
                type="button"
                key={option.code}
                aria-pressed={language === option.code}
                title={option.name}
                onClick={() => selectLanguage(option.code)}
              >
                {option.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.heroLineOne}<br /><em>{copy.heroLineTwo}</em></h1>
          <p className="lede">{copy.heroDescription}</p>
          <div className="hero-metrics">
            <div><strong>128</strong><span>{copy.metricSecret}</span></div>
            <div><strong>300</strong><span>{copy.metricPhase}</span></div>
            <div><strong>CRC</strong><span>CCITT</span></div>
          </div>
        </div>

        <div className="transmitter-card">
          <div className="card-heading">
            <div><span className="section-index">01</span><h2>{copy.broadcastTitle}</h2></div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? copy.resumeAnimation : copy.pauseAnimation}
            >
              {paused ? "▶" : "Ⅱ"}
            </button>
          </div>
          <div className="watch-frame">
            <ParticleCloud ariaLabel={copy.particleCanvasLabel} canvasRef={particleCanvasRef} cells={frame} strength={strength} paused={paused} mode={visualMode} />
            <div className="optical-boundary" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="watch-glass" />
            <span className="broadcast-label"><i /> {copy.liveSignal}</span>
          </div>
          <div className="mode-toolbar">
            <label><span>SEARCH MODES</span><input value={modeQuery} onChange={(event) => setModeQuery(event.target.value)} placeholder="Galaxy, organic, glyph…" /></label>
            <button type="button" className={autoShowcase ? "is-active" : ""} onClick={() => setAutoShowcase((value) => !value)}>{autoShowcase ? "STOP SHOWCASE" : "AUTO SHOWCASE"}</button>
          </div>
          <button className="immersive-launch" type="button" onClick={() => setImmersive(true)}><span>◉</span><strong>IMMERSIVE TRANSMIT</strong><small>Distraction-free optical stage</small></button>
          <div className="mode-categories" aria-label="Mode categories">
            {VISUAL_CATEGORIES.map((category) => <button key={category} type="button" className={modeCategory === category ? "is-active" : ""} onClick={() => setModeCategory(category)}>{category}</button>)}
          </div>
          <div className="mode-picker" aria-label="Visual transmission mode">
            {filteredModes.map((mode) => (
              <button key={mode.id} type="button" className={visualMode === mode.id ? "is-active" : ""} onClick={() => selectVisualMode(mode.id)} aria-pressed={visualMode === mode.id}>
                <span>{mode.icon}</span><strong>{mode.name}</strong><small>{mode.subtitle}</small>
              </button>
            ))}
          </div>
          <div className="mode-intelligence">
            <div className="mode-intelligence-heading"><span>{selectedVisualMode.category}</span><strong>{selectedVisualMode.name}</strong><i>{VISUAL_MODES.findIndex((mode) => mode.id === visualMode) + 1}/50</i></div>
            <div className="mode-palette" aria-label="Mode color palette">{selectedVisualMode.colors.map((color) => <span key={color} style={{ backgroundColor: color }} />)}</div>
            <dl><div><dt>GENERATIVE ALGORITHM</dt><dd>{selectedVisualMode.algorithm}</dd></div><div><dt>CAMERA EXTRACTION</dt><dd>{selectedVisualMode.extraction}</dd></div><div><dt>ROBUSTNESS</dt><dd>{selectedVisualMode.robustness}</dd></div></dl>
          </div>
          <div className="strength-row">
            <label htmlFor="strength">{copy.modulationStrength}</label>
            <input
              id="strength"
              type="range"
              min="0.25"
              max="1"
              step="0.01"
              value={strength}
              onChange={(event) => setStrength(Number(event.target.value))}
            />
            <output>{Math.round(strength * 100)}%</output>
          </div>
        </div>
      </section>

      <section className="workspace">
        <article className="panel sender-panel">
          <div className="panel-title"><span className="section-index">02</span><div><h2>{copy.sendTitle}</h2><p>{copy.sendDescription}</p></div></div>
          <label className="field-label" htmlFor="secret">{copy.pairingSecret}</label>
          <div className={`secret-field ${validSecret ? "" : "has-error"}`}>
            <input
              id="secret"
              spellCheck={false}
              value={secretHex}
              maxLength={32}
              onChange={(event) => setSecretHex(event.target.value.replaceAll(/[^0-9a-f]/gi, "").toLowerCase())}
            />
            <span>{secretHex.length}/32</span>
          </div>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={regenerate}>{copy.generateSecret}</button>
            <button className="secondary-button" type="button" disabled={!validSecret} onClick={runLoopbackTest}>{copy.loopbackTest}</button>
          </div>
          <div className={`test-result ${testStatus}`}>
            <span className="status-orb" />
            <div><strong>{linkStatusTitle}</strong><p>{loopDetailText(testDetail, copy)}</p></div>
          </div>
          <button
            className="secondary-button full-width pixel-test-button"
            type="button"
            disabled={!validSecret || pixelTestStatus === "running" || paused}
            onClick={runPixelLoopbackTest}
          >
            {pixelTestStatus === "running" ? copy.pixelButtonRunning : copy.pixelButton}
          </button>
          <div className={`pixel-test-result ${pixelTestStatus}`}>
            <div className="pixel-test-heading">
              <span className="status-orb" />
              <div><strong>{pixelStatusTitle}</strong><p>{pixelDetailText(pixelTestDetail, copy)}</p></div>
            </div>
            {pixelResult ? (
              <div className="pixel-evidence">
                <figure><img src={pixelResult.referenceImage} alt={copy.phaseAAlt} /><figcaption>PHASE A · PNG</figcaption></figure>
                <figure><img src={pixelResult.currentImage} alt={copy.phaseBAlt} /><figcaption>PHASE B · PNG</figcaption></figure>
                <figure><img src={pixelResult.differenceImage} alt={copy.differenceAlt} /><figcaption>18×18 DIFF</figcaption></figure>
                <div className="pixel-key-compare">
                  <span>{copy.recoveredKey}</span>
                  <code>{pixelResult.recoveredSecretHex.match(/.{1,8}/g)?.join(" ")}</code>
                  <strong>{pixelResult.matchesExpected ? copy.keyMatches : copy.keyMismatch}</strong>
                </div>
              </div>
            ) : null}
          </div>
          <button className="secondary-button full-width matrix-button" type="button" disabled={!validSecret || matrixStatus === "running" || paused} onClick={runModeMatrix}>
            {matrixStatus === "running" ? `VALIDATING ${matrixProgress}/50` : "VALIDATE ALL 50 VISUAL MODES"}
          </button>
          <div className={`matrix-result ${matrixStatus}`}><span /><p>{matrixStatus === "success" ? "50/50 modes recovered the exact secret and passed CRC." : matrixStatus === "error" ? `${matrixFailures.length} modes need calibration: ${matrixFailures.join(", ")}` : "Full optical compatibility matrix has not run yet."}</p></div>
        </article>

        <article className="panel receiver-panel">
          <div className="panel-title"><span className="section-index">03</span><div><h2>{copy.receiveTitle}</h2><p>{copy.receiveDescription}</p></div></div>
          <OpticalScanner language={language} onDecoded={setResult} />
        </article>

        <article className="panel decoded-panel">
          <div className="panel-title"><span className="section-index">04</span><div><h2>{copy.decodedTitle}</h2><p>{copy.decodedDescription}</p></div></div>
          {result ? (
            <div className="decoded-success">
              <span className="success-ring">✓</span>
              <p>{copy.validFrame}</p>
              <code>{result.secretHex.match(/.{1,8}/g)?.join(" ")}</code>
              <dl><div><dt>{copy.correctedCodewords}</dt><dd>{result.correctedCodewords}</dd></div><div><dt>{copy.integrity}</dt><dd>CRC-16 ✓</dd></div></dl>
            </div>
          ) : (
            <div className="empty-result"><span /><p>{copy.emptyResult}</p><small>{copy.emptyResultDetail}</small></div>
          )}
        </article>
      </section>

      <section className="protocol-section" id="protocol">
        <div><p className="eyebrow">{copy.pipelineEyebrow}</p><h2>{copy.pipelineTitle}</h2></div>
        <ol>
          {copy.protocolSteps.map((step, index) => (
            <li key={step.title}><span>{index + 1}</span><strong>{step.title}</strong><p>{step.description}</p></li>
          ))}
        </ol>
        <p className="security-note">{copy.securityNote}</p>
      </section>

      <footer><span>PARTICLEPAIR / {copy.footerTagline}</span><span>ORBITACERO · PARTICLEPAIR · 2026</span></footer>
      {immersive ? (
        <section className="immersive-stage" role="dialog" aria-modal="true" aria-label={`${selectedVisualMode.name} immersive optical transmitter`}>
          <ParticleCloud ariaLabel={`${selectedVisualMode.name} optical transmission`} cells={frame} strength={strength} mode={visualMode} />
          <div className="immersive-glass" aria-hidden="true" />
          <header><div className="immersive-brand"><span /><div><strong>PARTICLEPAIR</strong><small>LIVE GENERATIVE OPTICAL LINK</small></div></div><button type="button" onClick={() => setImmersive(false)} aria-label="Exit immersive transmitter">ESC <i>×</i></button></header>
          <div className="immersive-meta"><span>{selectedVisualMode.category}</span><h2>{selectedVisualMode.name}</h2><p>{selectedVisualMode.subtitle}</p><div className="immersive-palette">{selectedVisualMode.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</div></div>
          <div className="immersive-controls"><button type="button" onClick={() => stepVisualMode(-1)} aria-label="Previous visual mode">←</button><div><span className="live-dot" />TRANSMITTING · PHASE 300 MS · CRC-16</div><button type="button" onClick={() => stepVisualMode(1)} aria-label="Next visual mode">→</button></div>
          <div className="immersive-boundary" aria-hidden="true"><i /><i /><i /><i /></div>
        </section>
      ) : null}
    </main>
  );
}
