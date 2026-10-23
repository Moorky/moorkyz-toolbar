# Production deployment on Coolify

The portal is built as a standalone Next.js application and packaged as a
small production container. Pull requests and pushes run the full repository
checks, build the same container used in production, and smoke-test its HTTP
response. A push to `master` triggers Coolify only after those checks succeed.

## Coolify application settings

Create one application from the `Moorky/moorkyz-toolbar` GitHub repository:

| Setting                        | Value                         |
| ------------------------------ | ----------------------------- |
| Branch                         | `master`                      |
| Build pack                     | Dockerfile                    |
| Base directory / build context | Repository root (`/`)         |
| Dockerfile location            | `/Dockerfile`                 |
| Exposed port                   | `3000`                        |
| Domain                         | `https://toolbar.moorkyz.com` |
| Auto deploy                    | Manual deployments only       |

The Cloudflare DNS record is an A record: `toolbar` → `2.31.44.54`.

The container binds to `0.0.0.0:3000` and has a built-in HTTP health check.
Coolify provisions TLS for the configured domain after the first successful
deployment. No runtime environment variables or persistent volumes are
required for the current portal.

The portal is now the modular tools catalog; the former toolbar SDK and Studio
are removed. The repository and existing domain identifiers above are unchanged.
Do not set `MOORKYZ_VIDEOCRUNCH_ENABLED` or
`MOORKYZ_DIRECTORY_CLEANER_ENABLED` on a hosted deployment. Both filesystem/media
services are explicitly localhost-only and independently started by the user.
The container serves metadata, the small builder and allowlisted source downloads,
not hosted cleanup or video workers. VideoCrunch's distribution-license decision
remains a prerequisite for public source redistribution.

## GitHub Actions to Coolify

The workflow at `.github/workflows/ci.yml` runs the deployment job only for
pushes to `master`, after both `verify` and `container` succeed. It calls
Coolify's authenticated deploy webhook for the current `master` head; stale
workflow runs are skipped. Configure these repository secrets in
**Settings → Secrets and variables → Actions**:

| Secret            | Value                                                            |
| ----------------- | ---------------------------------------------------------------- |
| `COOLIFY_WEBHOOK` | The application's **Deploy webhook URL** from Coolify → Webhooks |
| `COOLIFY_TOKEN`   | A Coolify API token with the **Deploy** permission               |

Keep the Coolify application's built-in Git auto-deploy mode set to **Manual
deployments only** so CI is the single deployment trigger. Do not put either
secret in repository files or Docker build arguments.

## First deployment and recovery

After creating the Coolify application and adding both GitHub secrets, push a
commit to `master`. CI builds and runs the production image first; only a
passing image smoke test calls the deploy webhook. Confirm the new deployment
is healthy in Coolify and that `https://toolbar.moorkyz.com` returns HTTP 200.

If a deployment fails, use Coolify's deployment history to roll back to the
last healthy image. Revert a source change and push to `master` to rebuild and
deploy the corrected version after CI passes.

## References

- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Coolify Dockerfile applications](https://coolify.io/docs/applications/builds/dockerfile)
- [Coolify deployments from GitHub Actions](https://coolify.io/docs/applications/sources/github/actions)
