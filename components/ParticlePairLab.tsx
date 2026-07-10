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

function randomSecretHex(): string {
  return bytesToHex(createRandomSecret());
}

export function ParticlePairLab() {
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const [secretHex, setSecretHex] = useState("");
  const [strength, setStrength] = useState(0.9);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<DecodedParticleCode | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [testDetail, setTestDetail] = useState("尚未运行闭环测试");
  const [pixelTestStatus, setPixelTestStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [pixelTestDetail, setPixelTestDetail] = useState("尚未读取真实Canvas像素");
  const [pixelResult, setPixelResult] = useState<RenderedPixelLoopbackResult | null>(null);

  useEffect(() => {
    // Generate the initial secret only after hydration so it never appears in
    // server-rendered HTML and cannot diverge between the server and iOS Safari.
    const initializationFrame = window.requestAnimationFrame(() => {
      setSecretHex(randomSecretHex());
    });
    return () => window.cancelAnimationFrame(initializationFrame);
  }, []);

  const frame = useMemo(() => {
    try {
      return layoutBits(encodeParticleCode(hexToBytes(secretHex)));
    } catch {
      return layoutBits(encodeParticleCode(new Uint8Array(16)));
    }
  }, [secretHex]);

  const regenerate = () => {
    setSecretHex(randomSecretHex());
    setResult(null);
    setPixelResult(null);
    setPixelTestStatus("idle");
    setPixelTestDetail("密钥已更新，等待新的真实像素测试");
    setTestStatus("idle");
    setTestDetail("已生成新的单次配对秘密");
  };

  const runPixelLoopbackTest = async () => {
    const canvas = particleCanvasRef.current;
    if (!canvas || !validSecret) return;

    setPixelTestStatus("running");
    setPixelTestDetail("正在用同一渲染器生成确定性双相PNG…");
    setPixelResult(null);

    try {
      const decoded = await runRenderedPixelLoopback(
        canvas,
        frame,
        strength,
        secretHex,
      );
      setPixelResult(decoded);
      setResult({
        correctedCodewords: decoded.correctedCodewords,
        secret: hexToBytes(decoded.recoveredSecretHex),
        secretHex: decoded.recoveredSecretHex,
      });

      if (!decoded.matchesExpected) {
        throw new Error("CRC通过，但恢复密钥与当前发送密钥不一致");
      }

      setPixelTestStatus("success");
      setPixelTestDetail(
        `Canvas双相解码成功 · 同步质量 ${Math.round(decoded.quality * 100)}% · Hamming纠正 ${decoded.correctedCodewords} 个码字`,
      );
    } catch (error) {
      setPixelTestStatus("error");
      setPixelTestDetail(error instanceof Error ? error.message : "真实像素解码失败");
    }
  };

  const runLoopbackTest = () => {
    setTestStatus("running");
    setTestDetail("注入传输噪声并恢复数据…");

    window.setTimeout(() => {
      try {
        const noisyCells = [...frame];
        const payloadIndices = noisyCells.map((_, index) => index).filter((index) => !isBorderCell(index));

        // Flip three bits in separate Hamming codewords to exercise correction.
        [13, 91, 181].forEach((payloadOffset) => {
          const cellIndex = payloadIndices[payloadOffset];
          noisyCells[cellIndex] = !noisyCells[cellIndex];
        });

        const decoded = decodeParticleCode(extractPayloadBits(noisyCells));
        setResult(decoded);
        setTestStatus("success");
        setTestDetail(`CRC通过，Hamming纠正 ${decoded.correctedCodewords} 个码字`);
      } catch (error) {
        setTestStatus("error");
        setTestDetail(error instanceof Error ? error.message : "闭环测试失败");
      }
    }, 650);
  };

  const validSecret = /^[0-9a-f]{32}$/i.test(secretHex);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ParticlePair 首页">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>PARTICLEPAIR</span>
        </a>
        <div className="protocol-pill"><span /> Optical OOB · v1</div>
        <a className="text-link" href="#protocol">协议说明 <span>↗</span></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">源码可见 · 非商业光学配对实验室</p>
          <h1>让配对码<br /><em>隐入粒子。</em></h1>
          <p className="lede">人眼看到流动的粒子云，相机从连续帧中恢复经过纠错保护的一次性秘密。</p>
          <div className="hero-metrics">
            <div><strong>128</strong><span>bit secret</span></div>
            <div><strong>300</strong><span>ms phase</span></div>
            <div><strong>CRC</strong><span>CCITT</span></div>
          </div>
        </div>

        <div className="transmitter-card">
          <div className="card-heading">
            <div><span className="section-index">01</span><h2>广播粒子码</h2></div>
            <button className="icon-button" type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "继续动画" : "暂停动画"}>
              {paused ? "▶" : "Ⅱ"}
            </button>
          </div>
          <div className="watch-frame">
            <ParticleCloud canvasRef={particleCanvasRef} cells={frame} strength={strength} paused={paused} />
            <div className="optical-boundary" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="watch-glass" />
            <span className="broadcast-label"><i /> LIVE OPTICAL SIGNAL</span>
          </div>
          <div className="strength-row">
            <label htmlFor="strength">调制强度</label>
            <input id="strength" type="range" min="0.25" max="1" step="0.01" value={strength} onChange={(event) => setStrength(Number(event.target.value))} />
            <output>{Math.round(strength * 100)}%</output>
          </div>
        </div>
      </section>

      <section className="workspace">
        <article className="panel sender-panel">
          <div className="panel-title"><span className="section-index">02</span><div><h2>发送数据</h2><p>生成或输入16字节一次性秘密</p></div></div>
          <label className="field-label" htmlFor="secret">PAIRING SECRET</label>
          <div className={`secret-field ${validSecret ? "" : "has-error"}`}>
            <input id="secret" spellCheck={false} value={secretHex} maxLength={32} onChange={(event) => setSecretHex(event.target.value.replaceAll(/[^0-9a-f]/gi, "").toLowerCase())} />
            <span>{secretHex.length}/32</span>
          </div>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={regenerate}>生成新秘密</button>
            <button className="secondary-button" type="button" disabled={!validSecret} onClick={runLoopbackTest}>闭环自检</button>
          </div>
          <div className={`test-result ${testStatus}`}>
            <span className="status-orb" />
            <div><strong>{testStatus === "success" ? "链路验证成功" : testStatus === "error" ? "链路验证失败" : testStatus === "running" ? "正在解码" : "等待验证"}</strong><p>{testDetail}</p></div>
          </div>
          <button className="secondary-button full-width pixel-test-button" type="button" disabled={!validSecret || pixelTestStatus === "running" || paused} onClick={runPixelLoopbackTest}>
            {pixelTestStatus === "running" ? "正在捕获真实像素…" : "从动态画面恢复密钥"}
          </button>
          <div className={`pixel-test-result ${pixelTestStatus}`}>
            <div className="pixel-test-heading">
              <span className="status-orb" />
              <div><strong>{pixelTestStatus === "success" ? "真实像素解码成功" : pixelTestStatus === "error" ? "真实像素解码失败" : pixelTestStatus === "running" ? "正在比较相反相位" : "等待真实像素测试"}</strong><p>{pixelTestDetail}</p></div>
            </div>
            {pixelResult ? (
              <div className="pixel-evidence">
                <figure><img src={pixelResult.referenceImage} alt="动态粒子画面的参考相位PNG" /><figcaption>PHASE A · PNG</figcaption></figure>
                <figure><img src={pixelResult.currentImage} alt="动态粒子画面的相反相位PNG" /><figcaption>PHASE B · PNG</figcaption></figure>
                <figure><img src={pixelResult.differenceImage} alt="两个光学相位的18乘18差分图" /><figcaption>18×18 DIFF</figcaption></figure>
                <div className="pixel-key-compare">
                  <span>RECOVERED KEY</span>
                  <code>{pixelResult.recoveredSecretHex.match(/.{1,8}/g)?.join(" ")}</code>
                  <strong>{pixelResult.matchesExpected ? "与发送密钥完全一致 ✓" : "与发送密钥不一致"}</strong>
                </div>
              </div>
            ) : null}
          </div>
        </article>

        <article className="panel receiver-panel">
          <div className="panel-title"><span className="section-index">03</span><div><h2>相机接收</h2><p>使用另一台设备扫描这块屏幕</p></div></div>
          <OpticalScanner onDecoded={setResult} />
        </article>

        <article className="panel decoded-panel">
          <div className="panel-title"><span className="section-index">04</span><div><h2>解码结果</h2><p>通过校验后才释放配对秘密</p></div></div>
          {result ? (
            <div className="decoded-success">
              <span className="success-ring">✓</span>
              <p>VALID PARTICLE FRAME</p>
              <code>{result.secretHex.match(/.{1,8}/g)?.join(" ")}</code>
              <dl><div><dt>纠错码字</dt><dd>{result.correctedCodewords}</dd></div><div><dt>完整性</dt><dd>CRC-16 ✓</dd></div></dl>
            </div>
          ) : (
            <div className="empty-result"><span /><p>有效结果将显示在这里</p><small>拒绝未通过协议头与CRC校验的数据</small></div>
          )}
        </article>
      </section>

      <section className="protocol-section" id="protocol">
        <div><p className="eyebrow">协议管线</p><h2>视觉是载体，密码学才是边界。</h2></div>
        <ol>
          <li><span>1</span><strong>封装</strong><p>128位随机秘密、版本与CRC组成21字节数据帧。</p></li>
          <li><span>2</span><strong>纠错</strong><p>每字节经Hamming(12,8)编码，可修正单比特错误。</p></li>
          <li><span>3</span><strong>调制</strong><p>252个数据位映射到18×18光学网格的内部区域。</p></li>
          <li><span>4</span><strong>恢复</strong><p>相机比较相反相位，利用边界同步后验证并输出。</p></li>
        </ol>
        <p className="security-note">本项目证明光学带外认证链路。生产配对应在识别后继续执行经过认证的密钥交换；粒子码本身不是加密算法。</p>
      </section>

      <footer><span>PARTICLEPAIR / EXPERIMENTAL OPTICAL PAIRING</span><span>POLYFORM NONCOMMERCIAL 1.0.0 · © 2026 TIANRKING</span></footer>
    </main>
  );
}
