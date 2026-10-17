# Contributing

Moorkyz Toolbar is an Apache-2.0 development preview. Public contracts and
supported-version promises are not yet stable. Self-hosted DM font assets retain
their separate SIL Open Font License notices.

## Work locally

Use Node.js 22.18 or newer and the pnpm version pinned in `package.json`.

```powershell
pnpm install --frozen-lockfile
pnpm --filter @moorkyz/portal dev
pnpm check
pnpm test:coverage
pnpm check:source
pnpm measure:bundles
```

Browser tests require the Playwright Chromium, Firefox and WebKit engines.
Use `pnpm exec playwright install chromium firefox webkit` if they are missing.
Do not replace native browser tests with mocks of the SDK.

## Propose a focused change

1. Read [AGENTS.md](AGENTS.md), the [decision
   register](docs/decisions/decision-register.md), relevant draft contracts and
   [coding standards](docs/engineering/coding-standards.md).
2. Preserve host authorization, accessibility, local-first behavior, disabled
   feature inactivity and browser/CLI dependency boundaries.
3. Add observable-behavior tests and run the smallest relevant gates, then the
   required full gates before an MVP/release acceptance claim.
4. Include a scoped [task audit](docs/audits/TEMPLATE.md), actual verification
   evidence and known limitations. Do not stage unrelated user changes.
5. Open a focused pull request for review. Report security concerns privately
   through GitHub's security reporting options when available; do not post
   exploitable details or credentials in public issues.

Publishing, deployment, signing, infrastructure spending and integration into
other Moorkyz applications require separate explicit authorization.
The [release dossier](docs/engineering/release-readiness.md) remains authoritative
for M10/M11 holds. Automated checks are not independent security or accessibility
certification.
