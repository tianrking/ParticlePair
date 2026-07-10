<div align="center">
  <img src="./public/favicon.png" width="88" alt="ParticlePair mark" />
  <h1>ParticlePair</h1>
  <p><strong>Human-visible particle cloud. Machine-decodable pairing structure.</strong></p>
  <p>Experimental optical out-of-band pairing for screens and cameras.</p>
  <p><strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a></p>

  <p>
    <a href="https://github.com/tianrking/ParticlePair/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/tianrking/ParticlePair/actions/workflows/ci.yml/badge.svg?branch=main" /></a>
    <a href="#known-limitations"><img alt="Status: experimental" src="https://img.shields.io/badge/status-experimental-EA580C?style=flat-square" /></a>
    <a href="./LICENSE"><img alt="Source available" src="https://img.shields.io/badge/source-available-7C3AED?style=flat-square" /></a>
    <a href="./LICENSE"><img alt="PolyForm Noncommercial" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-0F766E?style=flat-square" /></a>
    <a href="./COMMERCIAL-LICENSE.md"><img alt="Commercial license required" src="https://img.shields.io/badge/commercial%20use-license%20required-B91C1C?style=flat-square" /></a>
  </p>

  <p>
    <a href="https://nextjs.org/"><img alt="Next.js 16.2" src="https://img.shields.io/badge/Next.js-16.2-000000?style=flat-square&amp;logo=nextdotjs&amp;logoColor=white" /></a>
    <a href="https://react.dev/"><img alt="React 19.2" src="https://img.shields.io/badge/React-19.2-149ECA?style=flat-square&amp;logo=react&amp;logoColor=white" /></a>
    <a href="https://www.typescriptlang.org/"><img alt="TypeScript 5.9" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" /></a>
    <a href="https://vite.dev/"><img alt="Vite 8.1" src="https://img.shields.io/badge/Vite-8.1-646CFF?style=flat-square&amp;logo=vite&amp;logoColor=white" /></a>
    <a href="https://workers.cloudflare.com/"><img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&amp;logo=cloudflareworkers&amp;logoColor=white" /></a>
    <a href="https://nodejs.org/"><img alt="Node.js 22.13 or newer" src="https://img.shields.io/badge/Node.js-%E2%89%A522.13-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" /></a>
  </p>

  <p>
    <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftianrking%2FParticlePair&amp;project-name=particle-pair&amp;repository-name=particle-pair"><img src="https://vercel.com/button" alt="Deploy with Vercel" /></a>
  </p>
</div>

![ParticlePair preview](./public/og.png)

> [!IMPORTANT]
> ParticlePair is **source-available**, not OSI open source. The deploy button does not grant commercial rights. Commercial products, paid services, SDKs, hardware, or other commercial use require a separate written license.

## Overview

ParticlePair encodes a 128-bit one-time pairing secret into an animated particle cloud. A camera receiver compares opposite modulation phases, extracts a machine-readable grid, corrects limited bit errors, and releases the secret only after integrity validation.

The visual is meant to feel ambient to a person while remaining structurally decodable by software. The project is an independent research prototype; it is not an implementation of, compatible with, or affiliated with Apple Watch pairing.

**Navigate:** [How it works](#how-it-works) · [Quick start](#quick-start) · [LAN access](#lan-access) · [Deploy](#deploy) · [Protocol](#particle-code-v1) · [Security](#security-model)

## Technical palette

![Canvas 2D](https://img.shields.io/badge/Canvas-2D-FF6B35?style=flat-square)
![Web Crypto](https://img.shields.io/badge/Web-Crypto-14B8A6?style=flat-square)
![getUserMedia](https://img.shields.io/badge/Camera-getUserMedia-0EA5E9?style=flat-square)
![Hamming 12,8](https://img.shields.io/badge/FEC-Hamming%2812%2C8%29-8B5CF6?style=flat-square)
![CRC-16](https://img.shields.io/badge/Integrity-CRC--16-D97706?style=flat-square)
![Particle Code v1](https://img.shields.io/badge/Protocol-Particle%20Code%20v1-DB2777?style=flat-square)

| Layer | Current implementation |
| --- | --- |
| Pairing material | 128-bit browser-generated one-time secret |
| Packet | 21 bytes, including header and CRC-16 |
| Error correction | Hamming(12,8), one correctable bit per codeword |
| Optical layout | 252 encoded bits in an 18×18 grid |
| Modulation | Opposite luminance phases, 300 ms per phase |
| Rendering | Canvas 2D animated particle cloud |
| Receiver | `getUserMedia()` + frame differencing + sync correlation |
| Deployment | Cloudflare Worker/Sites and native Next.js on Vercel |

## Important notice

- This repository has not received a production cryptographic, hardware-security, or independent security audit.
- Automated tests cover framing, correction, CRC rejection, rendering, and both deployment builds. They do not prove physical-link reliability across a broad device matrix.
- The scanner searches nearby crop scales and offsets and recovers rotation or mirroring, but it still relies on guided alignment and does not yet provide automatic corner detection, perspective correction, or device calibration.
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
          ▼  opposite luminance phases inside a particle cloud
          │
          ▼  camera frame differencing
          │
          └─ sync → decode → correct → CRC verify → release secret
```

A person mainly sees particles rotating, breathing, gathering, and dispersing. The receiver subtracts two opposite-phase frames to suppress the static scene and much of the global exposure offset. An asymmetric border pattern identifies the differential sign; the inner cells carry the encoded payload.

## Features

- Generate or enter a 16-byte/128-bit one-time secret.
- Encode a 21-byte Particle Code v1 packet.
- Validate with CRC-16/CCITT-FALSE.
- Correct one bit in each Hamming(12,8) codeword.
- Render an 18×18 optical grid as an animated Canvas 2D particle cloud.
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

## Security model

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

`npm test` covers clean encode/decode round trips, correction across independent Hamming codewords, CRC rejection beyond the correction budget, the Cloudflare/Sites production build, and server-rendered product-shell checks. The final command verifies the native Next.js path used by Vercel.

## Known limitations

- No automatic code-boundary detection or perspective correction.
- Scale and offset search are bounded; the complete code must remain inside the guide.
- No automatic screen color-space, camera white-balance, or refresh-rate calibration.
- Decorative particle motion still introduces differential noise.
- Hamming correction is limited to one bit per codeword.
- No timestamps, session binding, consumed-secret state, or replay prevention.
- Extreme rolling shutter, PWM, or exposure changes can still exceed the correction budget.
- No backward-compatibility guarantee for the experimental protocol.
- No public, reproducible cross-device success-rate dataset yet.

## Roadmap

- [ ] Corner detection and perspective correction
- [x] Rotation and mirror recovery
- [ ] Screen/camera calibration workflow
- [ ] Soft-decision decoding and stronger erasure coding
- [ ] Timestamp, nonce, session binding, and replay state
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

The code is provided under the [PolyForm Noncommercial License 1.0.0](./LICENSE). It permits covered noncommercial research, learning, experimentation, modification, and redistribution under its terms. It does not grant use in commercial products, paid services, commercial hardware, commercial SDKs, or other commercial activity.

Preserve [NOTICE](./NOTICE). For commercial rights, see [COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md). The license text controls if this summary differs from it.

## Research references

ParticlePair is independently designed. These screen-camera communication projects provide useful research context:

- [HiLight — Real-Time Screen-Camera Communication Behind Any Scene](https://dartnets.cs.dartmouth.edu/hilight)
- [ChromaCode — A Fully Imperceptible Screen-Camera Communication System](https://walleve.github.io/ChromaCode/)
- [libcimbar — Color Icon Matrix Barcodes](https://github.com/sz3/libcimbar)
- [TXQR — Transfer data via animated QR codes](https://github.com/divan/txqr)

These references are background only. ParticlePair does not copy their wire formats or claim compatibility with any commercial device protocol.
