<div align="center">
  <img src="./public/favicon.png" width="88" alt="ParticlePair mark" />
  <h1>ParticlePair</h1>
  <p><strong>Pairing, hidden in motion.</strong><br /><sub>An OrbitaCero project.</sub></p>
  <p>A vivid rotating galaxy for people. A verifiable optical frame for cameras.</p>

  <p>
    <a href="./README.md"><img alt="English" src="https://img.shields.io/badge/Language-English-111827?style=for-the-badge" /></a>
    <a href="./README.es.md"><img alt="Español" src="https://img.shields.io/badge/Idioma-Español-B45309?style=for-the-badge" /></a>
    <a href="./README.zh-CN.md"><img alt="简体中文" src="https://img.shields.io/badge/语言-简体中文-0F766E?style=for-the-badge" /></a>
  </p>

  <p>
    <img alt="Organization: OrbitaCero" src="https://img.shields.io/badge/organization-OrbitaCero-0F172A?style=flat-square" />
    <a href="https://github.com/tianrking/ParticlePair/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/tianrking/ParticlePair/actions/workflows/ci.yml/badge.svg?branch=main" /></a>
    <a href="#known-limitations"><img alt="Status: experimental" src="https://img.shields.io/badge/status-experimental-EA580C?style=flat-square" /></a>
    <a href="./LICENSE"><img alt="Source available" src="https://img.shields.io/badge/source-available-7C3AED?style=flat-square" /></a>
    <a href="./LICENSE"><img alt="PolyForm Noncommercial" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-0F766E?style=flat-square" /></a>
    <a href="./COMMERCIAL-LICENSE.md"><img alt="Commercial license required" src="https://img.shields.io/badge/commercial%20use-license%20required-B91C1C?style=flat-square" /></a>
  </p>

  <p>
    <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftianrking%2FParticlePair&amp;project-name=particle-pair&amp;repository-name=particle-pair"><img src="https://vercel.com/button" alt="Deploy with Vercel" /></a>
  </p>
</div>

![ParticlePair preview](./public/readme-preview.png)

> [!IMPORTANT]
> ParticlePair is **source-available**, not OSI open source. No commercial right is granted automatically. Commercial products, paid services, SDKs, hardware, internal commercial operations, and other commercial use require the copyright holder's explicit written authorization or a separate signed commercial license **before use**.

## Overview

ParticlePair encodes a 128-bit one-time pairing secret inside a vivid three-arm particle galaxy. The visual layer uses saturated blue, violet, and magenta particles, while a green-heavy cyan carrier gives the camera a separately decodable optical channel. The receiver compares opposite modulation phases, extracts a machine-readable grid, corrects limited bit errors, and releases the secret only after integrity validation.

The visual is meant to feel ambient to a person while remaining structurally decodable by software. The project is an independent research prototype; it is not an implementation of, compatible with, or affiliated with Apple Watch pairing.

**Navigate:** [Technology](#technology-stack) · [How it works](#how-it-works) · [Quick start](#quick-start) · [Camera scan](#two-device-camera-scan) · [Protocol](#particle-code-v1) · [Security](#security-model) · [Commercial licensing](#license-and-commercial-use)

## Technology stack

<table>
  <tr>
    <td align="center" width="33%">
      <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.2-000000?style=for-the-badge&amp;logo=nextdotjs&amp;logoColor=white" /><br />
      <img alt="React" src="https://img.shields.io/badge/React-19.2-149ECA?style=for-the-badge&amp;logo=react&amp;logoColor=white" /><br />
      <sub><strong>Web runtime</strong><br />App Router · SSR · responsive UI</sub>
    </td>
    <td align="center" width="33%">
      <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&amp;logo=typescript&amp;logoColor=white" /><br />
      <img alt="Vite" src="https://img.shields.io/badge/Vite-8.1-646CFF?style=for-the-badge&amp;logo=vite&amp;logoColor=white" /><br />
      <sub><strong>Language &amp; build</strong><br />Strict types · Vinext · dual builds</sub>
    </td>
    <td align="center" width="33%">
      <img alt="Canvas 2D" src="https://img.shields.io/badge/Canvas-2D-FF6B35?style=for-the-badge" /><br />
      <img alt="getUserMedia" src="https://img.shields.io/badge/Camera-getUserMedia-0284C7?style=for-the-badge" /><br />
      <sub><strong>Optical runtime</strong><br />Galaxy renderer · camera frame sampling</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img alt="Web Crypto" src="https://img.shields.io/badge/Web-Crypto-0F766E?style=for-the-badge" /><br />
      <img alt="128-bit secret" src="https://img.shields.io/badge/Secret-128--bit-115E59?style=for-the-badge" /><br />
      <sub><strong>Secret material</strong><br />Client-generated · never server-rendered</sub>
    </td>
    <td align="center">
      <img alt="Hamming 12,8" src="https://img.shields.io/badge/FEC-Hamming%2812%2C8%29-7C3AED?style=for-the-badge" /><br />
      <img alt="CRC-16" src="https://img.shields.io/badge/Integrity-CRC--16-D97706?style=for-the-badge" /><br />
      <sub><strong>Framing &amp; integrity</strong><br />Particle Code v1 · guarded release</sub>
    </td>
    <td align="center">
      <img alt="Vercel" src="https://img.shields.io/badge/Vercel-Ready-000000?style=for-the-badge&amp;logo=vercel&amp;logoColor=white" /><br />
      <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&amp;logo=cloudflareworkers&amp;logoColor=white" /><br />
      <sub><strong>Deployment</strong><br />Native Next.js · Worker/Sites</sub>
    </td>
  </tr>
</table>

| Layer | Current implementation |
| --- | --- |
| Pairing material | 128-bit browser-generated one-time secret |
| Packet | 21 bytes, including header and CRC-16 |
| Error correction | Hamming(12,8), one correctable bit per codeword |
| Optical layout | 252 encoded bits in an 18×18 grid |
| Modulation | Opposite green-heavy cyan carrier phases, 300 ms per phase |
| Rendering | Canvas 2D, 1,050-particle three-arm animated galaxy |
| Receiver | `getUserMedia()` + green-channel frame differencing + sync correlation |
| Deployment | Cloudflare Worker/Sites and native Next.js on Vercel |

## Important notice

- This repository has not received a production cryptographic, hardware-security, or independent security audit.
- Automated tests cover framing, correction, CRC rejection, rendering, and both deployment builds. They do not prove physical-link reliability across a broad device matrix.
- The scanner searches nearby crop scales and offsets, recovers rotation or mirroring, and applies bounded homography candidates for common keystone distortion. It still relies on guided alignment and does not yet infer arbitrary corners or calibrate a device automatically.
- Use is limited to purposes permitted by the [PolyForm Noncommercial License 1.0.0](./LICENSE). See [commercial licensing](./COMMERCIAL-LICENSE.md) for other use.

## How it works

```text
128-bit one-time secret
          │
          ▼  protocol frame + CRC-16
          │
          ▼  Hamming(12,8) error correction
          │
          ▼  252 bits mapped into an 18×18 grid
          │
          ▼  opposite cyan carrier phases inside a vivid galaxy
          │
          ▼  green-channel camera frame differencing
          │
          └─ sync → decode → correct → CRC verify → release secret
```

A person sees 1,050 saturated particles rotating through three spiral arms, breathing, gathering, and dispersing. The blue/violet/magenta galaxy is deliberately separated from the green-heavy cyan optical carrier. The receiver subtracts two opposite-phase green-channel frames to suppress the decorative scene and much of the global exposure offset. An asymmetric border pattern identifies the differential sign; the inner cells carry the encoded payload.

## Features

- Generate or enter a 16-byte/128-bit one-time secret.
- Switch the complete interface between English, Spanish, and Simplified Chinese, with the choice saved locally.
- Encode a 21-byte Particle Code v1 packet.
- Validate with CRC-16/CCITT-FALSE.
- Correct one bit in each Hamming(12,8) codeword.
- Render an 18×18 optical grid behind a vivid 1,050-particle, three-arm Canvas 2D galaxy.
- Separate the red/blue visual galaxy from the green-heavy cyan camera carrier.
- Decode from a browser camera with timestamped video-frame pairing, multi-scale crop search, rotation/mirror recovery, soft evidence accumulation, exposure-drift cancellation, and sync correlation.
- Render deterministic opposite-phase PNGs for a platform-independent Canvas pixel loopback test.
- Run a local loopback test with injected errors in independent codewords.
- Build for both Cloudflare Worker/Sites and native Next.js/Vercel.

## Quick start

### Requirements

- Node.js 22.13 or newer
- npm
- A modern browser with Canvas, Web Crypto, and `getUserMedia()` support

### Browser compatibility

- The sender works in current Chrome, Edge, Firefox, and Safari on desktop or mobile when Canvas 2D and Web Crypto are available.
- The camera receiver additionally requires an HTTPS secure context and `getUserMedia()` permission. iPhone Chrome and Safari, Android Chrome, and current desktop browsers are supported through feature detection rather than browser-name checks.
- The scanner uses `requestVideoFrameCallback()` when available and automatically falls back to `requestAnimationFrame()` when it is not.
- Use the full browser app instead of an in-app browser, and keep the tab in the foreground while scanning.

```bash
git clone https://github.com/tianrking/ParticlePair.git
cd ParticlePair
npm ci
npm run dev
```

Open the local URL printed in the terminal.

### Local loopback

1. Select **Generate new secret**.
2. Select **Loopback self-test**.
3. The test flips three bits in three independent Hamming codewords.
4. The decoder must correct them, pass CRC validation, and reproduce the original secret.

## LAN access

Expose the development server to devices on the same trusted local network:

```bash
npm run dev:lan
```

Open the printed network URL from another device, normally:

```text
http://<computer-LAN-IP>:3000
```

- Keep both devices on the same Wi-Fi/LAN.
- On Windows, allow Node.js through the firewall for **Private networks** when prompted.
- Guest Wi-Fi or access-point isolation may prevent devices from reaching one another.
- Do not expose the development server directly to the public internet.

> [!WARNING]
> Plain HTTP over LAN is sufficient to browse, generate, and **display** the particle code. Camera scanning uses `getUserMedia()` and browsers normally require HTTPS or `localhost`. For a complete two-device scan, open the receiver from an HTTPS deployment such as Vercel, or place the LAN server behind TLS trusted by the receiving device.

## Deploy

### Vercel — one click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftianrking%2FParticlePair&project-name=particle-pair&repository-name=particle-pair)

No environment variables, databases, or object storage are required. [`vercel.json`](./vercel.json) selects the native Next.js build, while the existing Vinext/Cloudflare path remains unchanged.

Deployment is still governed by the repository license and does **not** grant commercial-use permission.

## Two-device camera scan

1. Open ParticlePair on the sender and keep the full particle cloud visible.
2. Generate a secret and keep modulation strength around 90% or higher.
3. Open an HTTPS ParticlePair deployment on the camera-equipped receiver.
4. Select **Start camera scanner** and grant camera permission.
5. Align the sender's four cyan optical corners with the square receiver guide. The surrounding rectangular watch frame is not part of the code.
6. Keep distance, angle, and exposure stable while synchronization and CRC validation complete.

`SYNC` is calibrated evidence above the random-correlation floor, not a generic camera activity meter. Unrelated scenes should remain at or near 0%; values above 30% are treated as synchronization candidates, and values at or above 47% can enter multi-frame decoding. The UI reports success only after the packet also passes Hamming decoding and CRC-16 validation.

The receiver starts with 61 crop/perspective geometries. A hysteresis controller contracts the search to 45 geometries after five stable observations and to 25 after a sustained decode-quality lock. A quality drop expands the search within one or two observations. Every tier change invalidates incompatible frame history; the camera overlay exposes the active tier, geometry count, and local sampling time without including payload data.

Camera RGB is projected into an amplitude-preserving cyan opponent channel, `G - 0.42R - 0.16B`, so vivid blue, violet, and magenta artwork is rejected without normalizing away the optical pulse. For each opposite-phase pair, the known border estimates multiplicative auto-exposure gain from the bright/dim group separation; the decoder then removes that gain and the additive black-level shift before synchronization, Hamming correction, and CRC validation. The live `AE ×` value makes this compensation observable.

Every perspective candidate also carries a dynamic-range health record. A cell is considered clipped only when at least two RGB channels reach the sensor ceiling, avoiding false warnings from the intentionally green-heavy cyan carrier. The 10th-to-90th percentile opponent-channel span distinguishes a useful signal from a flat frame, while the all-channel shadow ratio detects underexposure. `DR` reports the combined health score; when synchronization is weak, the receiver turns that evidence into specific brightness, distance, or backlight guidance instead of reporting generic noise.

The known alternating synchronization border doubles as an in-band focus chart. Its bright/dim opponent-channel separation is normalized by the full frame's 10th-to-90th percentile span, so vivid nebula edges inside the payload cannot fake sharp focus. `F` reports this border modulation score. When dynamic range is healthy but `F` is low, the receiver recommends tap-to-focus or a slightly greater distance instead of blaming exposure or alignment.

Frame pairing uses a rolling 15-interval timing model rather than a fixed tolerance. The median interval estimates real camera FPS and the median absolute deviation measures jitter without letting one suspended callback dominate. The opposite-phase window contracts to 72 ms on stable high-frame-rate cameras and expands only as far as 145 ms for slower or irregular capture, preserving phase separation. `J` exposes jitter in milliseconds; an unstable cadence produces a specific foreground/battery-saver hint.

The displayed processing time now covers geometry sampling, RGB health analysis, eight-way orientation transforms, exposure fitting, and candidate ranking—not just canvas reads. A load controller enters cooling only after four consecutive over-budget frames, then processes alternate camera callbacks while the cadence estimator continues observing every callback. Eight sustained low-load observations restore full-rate processing. `L` reports duty-adjusted utilization, so cooling reflects actual average CPU pressure rather than the cost of one processed frame.

Candidate release also requires cross-frame orientation consensus. The receiver keeps an eight-winner window over the eight rotation/mirror transforms; nearby crop keys may move as the hand moves, but a transform must hold at least a two-thirds majority and survive the runner-up margin check. Three observations are required to establish a lock, at least two soft-evidence frames from the same candidate are required before decode, and signal loss clears the vote immediately. `C` shows consensus strength; magenta means ambiguous orientation and prevents release even before Hamming and CRC validation.

“Two frames” means two independent source frames, not two JavaScript callbacks. Each geometry/orientation bucket rejects an unchanged positive `video.currentTime` even if `requestAnimationFrame` fires again. When media time is unavailable or stuck at zero, a cadence-derived decorrelation interval uses 72% of the measured frame interval, clamped to 18–55 ms. The three cyan/violet/magenta `EVIDENCE` lights visualize independent accumulation; duplicate callbacks never light another point or advance decode.

The soft combiner's per-cell confidence is now a decode gate rather than unused telemetry. It evaluates the 252 encoded payload cells, overall coverage below a 0.32 confidence floor, every sliding 4×4 weak-cell window, and weak density in four spatial quadrants. Sparse isolated weakness remains decodable; coverage below 72% or a 75%-weak local window blocks decode. A 62.5%-weak local window or a degraded quadrant is labeled occlusion, distinct from diffuse weak coverage. `Q` beside `EVIDENCE` reports payload coverage and changes the meter from green to amber or nebula magenta with actionable guidance.

Camera lifetime is an explicit state machine: idle, running, suspended, or ended. Hiding the page or receiving a temporary track mute safely suspends callbacks and clears phase history, soft evidence, orientation votes, timing/load models, and partial Fountain sessions. Resume is legal only when the page is visible and the same track is still live and unmuted; it always starts with fresh synchronization. An `ended` track is never reused and the UI asks for an explicit scanner restart. Failed startup also stops every acquired track instead of leaking camera access.

Camera tuning is capability-driven progressive enhancement, never a hardware requirement. If `getCapabilities()` explicitly advertises continuous focus, exposure, or white balance, each mode is applied in a separate guarded `applyConstraints()` call. One rejected driver feature cannot roll back the others; absent, incomplete, or throwing capability APIs result in zero tuning calls and native browser automation. `AF·AE` appears only when continuous autofocus was actually accepted.

Capture resolution follows measured load rather than device names. Six sustained hot/cooling observations request an ECO target of 640×360; twenty sustained low-load observations request HD 1280×720 again. Targets are clamped to the track's advertised width/height range, each change is verified through `getSettings()`, and a rejected or silently ignored change disables further attempts for that session. Successful changes clear all temporal evidence and recompute object-fit geometry, while the optical sampler remains the same normalized 36×36 patch. `GEO…·HD/ECO` reports the actual capture tier.

Display refresh rate, PWM, rolling shutter, auto exposure, and browser throttling can all affect the optical link. This is a runnable research prototype, not a promise of calibration-free interoperability.

## Particle Code v1

ParticlePair is the project. **Particle Code v1** is its current optical frame protocol.

### Packet

```text
21-byte packet
├── magic           1 byte   0xA7
├── version         1 byte   0x01
├── secret length   1 byte   0x10
├── pairing secret 16 bytes
└── CRC-16          2 bytes

21 bytes × Hamming(12,8) = 252 optical bits
```

### Optical layout

- Total grid: 18×18, 324 cells.
- Outer border: 68 phase and frame-synchronization cells.
- Inner area: 16×16, 256 cells.
- Encoded payload: 252 cells.
- Remaining cells: four deterministic padding bits.

The asymmetric border lets the receiver infer the sign of the differential phase and search all four rotations plus mirrored input.

### Error correction

Every source byte is encoded as one Hamming(12,8) codeword. The implementation can repair one flipped bit per codeword. CRC-16 detects and rejects checksum mismatches after decoding, but it is neither collision-proof nor a cryptographic authenticator.

## Generative optical studio

ParticlePair now separates the reliable optical carrier from the generative art layer. Every visual uses the same calibrated 18×18 complementary phase carrier, so selecting another skin does not require another camera decoder.

- 50 selectable visual modes across Cosmic, Organic, Geometric, Atmospheric, and Synthetic collections.
- 13 renderer families: spiral fields, curtains, rings, petals, orbits, node graphs, tendrils, clouds, weaves, facets, glyphs, city grids, and embers.
- Search, category filters, per-mode three-color spectra, automatic showcase, persistent selection, and an immersive transmission stage.
- Every mode explains its generative algorithm, camera extraction path, and robustness strategy in the interface.
- The Visual Quality Engine measures vibrancy, contrast, hue coverage, motion continuity, and a composite grade from real rendered pixels. The current 50-mode baseline has no mode below grade 55.
- The Camera Channel Lab exercises clean, low-light, exposure-drift, defocus, sensor-noise, and partial-occlusion paths. A result counts only after the recovered secret matches and CRC passes.
- Adaptive modulation searches for the quietest strength that survives both clean and exposure-drift channels, then adds an eight-point safety margin.

Decorative motion never owns protocol bits. Static spectral atmosphere cancels between opposite phases; animated details remain sparse enough for Hamming and multi-frame soft evidence to absorb residual error.

## Particle Code v2: optical fountain stream

V2 retains the exact 21-byte packet and 252-bit optical budget. It divides the 128-bit secret into four 4-byte source blocks. Each transmitted fragment carries one XOR equation selected from 15 systematic and parity masks. The receiver performs Gaussian elimination over GF(2); any four linearly independent equations recover the secret, regardless of order, while duplicate equations do not increase rank.

| Byte range | Meaning |
|---|---|
| 0–1 | Magic and protocol version |
| 2–5 | 32-bit session ID |
| 6–9 | Issued-at minute |
| 10–12 | Sequence, four-bit equation mask, block length |
| 13–16 | Four-byte XOR payload |
| 17–18 | Block count and secret length |
| 19–20 | CRC-16/CCITT-FALSE |

Each byte is still protected by Hamming(12,8). Sessions expire after ten minutes and rotate after eight. Completed-session replay, conflicting equations, future fragments, expired fragments, and invalid CRCs are rejected. The decoder keeps at most eight incomplete sessions and 32 completed replay records.

V2 timing profiles are all exact multiples of the 300 ms phase:

- Fast: 600 ms per equation.
- Balanced: 900 ms per equation and the default profile.
- Robust: 1200 ms per equation for low frame rates, distance, or difficult light.

The live equation matrix shows active source blocks, XOR mask, sequence position, session TTL, and the rule that four independent equations are required. The Canvas proof runs the complete render → two-phase sample → Hamming → CRC → fountain recovery path.

## Security model

After optical recovery, both devices independently derive an 18-bit Short Authentication String from SHA-256 over a domain separator, the secret, and the v2 session ID. Users compare three words and a six-hex-digit fingerprint before accepting the peer. SAS comparison detects accidental or adversarial peer substitution only when a human actually compares both screens; it does not replace an authenticated key exchange.

| Boundary | Current state |
| --- | --- |
| Secret material | 128 random bits from browser Web Crypto |
| Optical transport | Differential modulation with limited FEC and CRC |
| Encryption | Not provided |
| Replay defense | No expiry or consumed-secret store in the demo |
| Device authentication | The optical secret only supplies material for a later authenticated protocol |
| Follow-on channel | Production systems must implement an audited authenticated key exchange |
| Security audit | Not completed |

A production design should add expiry, session binding, one-time consumption, replay detection, an audited handshake such as SPAKE2 or authenticated X25519, secure long-term key storage, parser fuzzing, and independent review. Report vulnerabilities through [SECURITY.md](./SECURITY.md).

## Verification

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build:vercel
```

`npm test` covers carrier/color separation, clean encode/decode round trips, correction across independent Hamming codewords, CRC rejection beyond the correction budget, the Cloudflare/Sites production build, and server-rendered product-shell checks. The final command verifies the native Next.js path used by Vercel.

## Known limitations

- No automatic code-boundary/corner detection; perspective recovery is a bounded five-shape homography search rather than arbitrary quadrilateral estimation.
- Scale and offset search are bounded; the complete code must remain inside the guide.
- No automatic screen color-space, camera white-balance, or refresh-rate calibration.
- Camera color crosstalk can leak a small amount of the red/blue decorative galaxy into the green carrier channel.
- Hamming correction is limited to one bit per codeword.
- V1 remains a compatibility frame without expiry or replay state; V2 adds issued time, session binding, expiry, bounded replay state, and completed-session rejection.
- Extreme rolling shutter, PWM, or exposure changes can still exceed the correction budget.
- No backward-compatibility guarantee for the experimental protocol.
- No public, reproducible cross-device success-rate dataset yet.

## Roadmap

- [ ] Automatic corner detection and arbitrary-quadrilateral refinement beyond the bounded homography search
- [x] Rotation and mirror recovery
- [ ] Screen/camera calibration workflow
- [x] Quality-weighted soft-decision decoding and fountain erasure recovery
- [x] Timestamp, session binding, expiry, bounded replay state, and human SAS
- [ ] Native Android CameraX receiver
- [ ] Reference BLE/Wi-Fi authenticated-handshake integration
- [ ] Reproducible multi-device benchmark suite
- [ ] Independent security audit

## Project structure

```text
app/          routes, metadata, and global visual styles
components/   particle transmitter, camera scanner, and lab interface
lib/          CRC, Hamming, protocol framing, and optical layout
tests/        protocol and rendered-output verification
worker/       Cloudflare Worker/Sites entry point
public/       social preview and static assets
```

## Contributing

Compatibility tests, research references, issue reports, and reproducible measurements are welcome. Because the project may offer separate commercial licenses, code contributions are not automatically accepted without an appropriate contributor agreement. Read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## License and commercial use

Copyright © 2026 tianrking.

The code is provided under the [PolyForm Noncommercial License 1.0.0](./LICENSE). It permits covered noncommercial research, learning, experimentation, modification, and redistribution under its terms. It does **not** grant use in commercial products, paid services, revenue-generating client work, internal commercial operations, commercial hardware, commercial SDKs, or other commercial activity.

Commercial use requires explicit written permission from the copyright holder or a separate commercial license identifying the licensee and permitted scope. A fork, deployment, issue response, pull request, repository access, or silence is not permission. Preserve [NOTICE](./NOTICE), then read [COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md) before making a commercial inquiry. The license text controls if this summary differs from it.

## Research references

ParticlePair is independently designed. These screen-camera communication projects provide useful research context:

- [HiLight — Real-Time Screen-Camera Communication Behind Any Scene](https://dartnets.cs.dartmouth.edu/hilight)
- [ChromaCode — A Fully Imperceptible Screen-Camera Communication System](https://walleve.github.io/ChromaCode/)
- [libcimbar — Color Icon Matrix Barcodes](https://github.com/sz3/libcimbar)
- [TXQR — Transfer data via animated QR codes](https://github.com/divan/txqr)

These references are background only. ParticlePair does not copy their wire formats or claim compatibility with any commercial device protocol.
