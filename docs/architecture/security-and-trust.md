# Security and trust boundaries

## Primary trust model
The **host app** controls authn/authz, data access, commands, network/service worker integration, privileged actions and cross-origin workflows. The toolbar **cannot grant these permissions**. Each extension receives only explicit scoped capabilities and typed context; the core validates each sensitive action at use time, not just registration. Browser and platform policies always apply.

## DOM and CSS
- Default: Shadow DOM for CSS encapsulation; developer can opt into namespaced Light DOM. Neither is a JS security sandbox.
- Host-provided UI must use supported rendering contracts; no unsafe HTML insertion. Manage portals/popovers/focus per mount mode; avoid global CSS resets.
- Strict CSP-first: no `eval`, `new Function` or forced `unsafe-eval`; no default remote script/style/font injection; avoid assumptions about inline styles, constructable stylesheets, and browser CSP enforcement—test approved strategies under strict policies.
- Test Trusted Types where browsers support it, URL protocol allowlisting, attribute/style sanitization and malicious display content.

## Extension boundary
Trusted code may use supported SDK operations, but must not mutate core internals or bypass host authorization. **Executing trusted extension JavaScript in the same realm is not isolated from arbitrary JS behavior**: clearly document this limitation. Experimental code in the website's Extension Studio must run in an explicitly isolated, policy-constrained environment; never inside the privileged portal realm.

## Command and network safety
- No automatic unsafe retries, no queue by default, no recovery after auth failure.
- Optional offline queues require host approval, current permission checks, idempotency or equivalent exactly-once mitigation and explicit data handling.
- Navigations use host-defined route adapter and validated URLs. Cross-app handoff optional, secured and not an implicit preference/data sync feature.
- No default telemetry, tracking, behavior learning, server dependency or external calls to Moorkyz services.

## Security verification
Threat model host-versus-toolbar authority, hostile extension content, style interference, CSP, XSS, prototype pollution, URL injection, accidental credential disclosure, insecure generated configuration, dependency supply chain, command replay, persistence data corruption, stale privilege changes, race conditions and isolation failures. Include malicious input fixtures, permission revocation tests and non-authorized operations; assign severity and block critical issues.

## Security issue handling
Security failures fail closed and retain structured redacted diagnostics. Core integrity failures enter safe unavailable state when needed. Never silently weaken CSP, security flags, or authorization because an integration test fails.
