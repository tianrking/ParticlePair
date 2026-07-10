# Security policy

## Project status

ParticlePair is an experimental optical out-of-band pairing prototype. It has not received a production security audit and must not be treated as a complete production pairing system.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting or a draft Security Advisory when the repository is published. Do not disclose exploitable security issues in a public issue before a fix is available.

Include:

- the affected commit or version;
- the expected and observed behavior;
- reproduction steps or a minimal proof of concept;
- the security impact and required preconditions;
- suggested mitigations, if known.

## Security boundaries

- The optical frame transports a short-lived authentication secret; it does not encrypt application data.
- Production pairing still requires an authenticated key exchange such as SPAKE2 or X25519 with an appropriate authentication construction.
- Secrets need expiration, replay protection, secure random generation, and secure storage.
- Camera decoding robustness is not equivalent to cryptographic authenticity.
- Compatibility with Apple Watch or any Apple private pairing protocol is explicitly out of scope.
