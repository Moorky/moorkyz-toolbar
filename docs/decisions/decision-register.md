# Current product decisions

## 2026-10-23: modular tools portal

User-approved:

- The landing page is a growing catalog of cards with brief explanations.
- Each tool has title, release date (honest unpublished status where unknown),
  updated date, description, use cases and setup.
- Script tools show a **Tool** section immediately after Description with file
  hierarchy, text-only console source, Copy/Download and complete source ZIP.
- VideoCrunch is integrated as a separately started Windows localhost service.
  Hosted workers, accounts, multi-user features and infrastructure stay off.
- The footer matches the current live moorkyz.com mark/credit and separator.
  Games are deferred until a reference is supplied, as the user explicitly chose.
- Next.js 16.4.1 and its lockfile patch were approved to fix the existing
  16.4.0 security gate. No dependency gate may be bypassed.

## 2026-10-23: replace the legacy toolbar product

The user explicitly selected:

> Keep a tiny standalone Toolbar Builder; remove the old SDK, Studio, examples,
> toolbar-specific tests and active docs. Replace the portal's SDK navigation.
> Preserve Git history and audit records.

The old Q1-Q80 SDK specifications no longer define active scope. Their exact
versions remain in Git history; historical audit links can refer to those
revisions. Current code must not depend on an unpublished toolbar package,
framework adapters, SDK generation or the former Studio.

The remaining builder is a small browser-only link/appearance editor producing
one self-contained HTML file. Shared portal navigation is native and independent.
This is an intentional approved product/API removal, not a compatibility release.

## 2026-10-23: Directory Cleaner

The user requested pattern-based Keep/Move rules, creation date before/after
filters, and size smaller/larger filters, then selected **both** local service and
downloadable script, with **deletions always going to an archive**.

Implementation semantics:

- Conditions within a rule combine with AND. Keep rules always win; otherwise
  the first matching rule applies. Unmatched files remain untouched.
- Date bounds and byte-size bounds are strict. Date fields use UTC midnight,
  clearly labeled. Recursive traversal is optional and off initially.
- Preview does not mutate files. Applying requires the exact preview's explicit
  confirmation and complete preflight revalidation; stale files require a new
  preview.
- Delete means archive, never unlink without a verified preserved destination.
  No overwrite, no symlink/junction traversal, no root/home-directory cleanup.
  Archive and move destinations are excluded from scans.
- Local services remain independently opt-in and loopback-only. No hosting,
  telemetry, automatic installs or unattended scheduled cleanup.

## Change authority

Reversible implementation details/tests/docs can proceed autonomously. New
dependencies, security/data handling, public APIs, infrastructure, release,
publishing, deployment and external integration need explicit approval.
Accessibility, protected data, honest verification and dependency gates remain
mandatory. Task audits and focused local commits are required; pushing is not.
