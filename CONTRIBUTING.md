# Contributing to @shmaplex/xplant-sdk

Thank you for your interest in contributing!

## Development setup

```bash
git clone https://github.com/shmaplex/xplant_sdk.git
cd xplant_sdk
npm install
npm run build
npm test
```

## Making changes

1. Fork the repo and create a branch: `git checkout -b fix/your-fix`
2. Make your changes in `src/`
3. Run `npm run lint && npm run typecheck && npm test && npm run build` — all must pass
4. Submit a pull request against `main`

## Adding a method or a resource

Methods follow the API's paths: the first path segment names the resource
(`/api/v1/sop-runs/...` → `client.sopRuns`), and methods are `list`, `get`,
`create`, `update`, or `record*` for append-only history such as scans, step
evidence and equipment events.

1. Add the request and response shapes to `src/types.ts`, using the API's own
   field names.
2. Add the method to `src/resources/<resource>.ts`. Take a trailing
   `options?: RequestOptions` (reads) or `options?: WriteOptions` (writes) and
   pass it through. If the route replays a repeated `Idempotency-Key`, pass
   `{ ...options, idempotent: true }`.
3. For a new resource, add a getter to `XPlantClient` in `src/client.ts` and
   export the class and types from `src/index.ts`.
4. Add an entry to `INVOCATIONS` in `src/contract.test.ts`. The suite fails
   until every method has one and every route in `src/testing/v1-surface.json`
   is reached by some method.
5. Document it in `README.md` with a short example.

## Publishing (maintainers only)

Releases publish themselves when a version bump reaches `main`. There is
nothing to run locally and no npm token to manage.

1. In a pull request, bump `version` in `package.json` and add a dated entry to
   `CHANGELOG.md`: `## [0.x.y] — YYYY-MM-DD`.
2. Merge it.

`.github/workflows/publish.yml` then:
- sees that npm doesn't have that version yet
- checks for the dated CHANGELOG entry
- runs lint, build, typecheck and tests
- publishes to npm with provenance, through npm trusted publishing
- tags the merge commit `v0.x.y` and creates the GitHub Release from the
  CHANGELOG entry

Other things to know:
- A merge that doesn't change the version publishes nothing.
- A prerelease version such as `0.5.0-rc.1` is published under the `next` tag,
  so it never becomes `latest`.
- To rehearse, run the workflow by hand from the Actions tab with **dry run**
  checked. That runs every check and packs the tarball without publishing.

The workflow authenticates with OIDC. npm's trusted-publisher record for the
package names this repository (`shmaplex/xplant_sdk`) and the file
`publish.yml`, so don't rename it.
