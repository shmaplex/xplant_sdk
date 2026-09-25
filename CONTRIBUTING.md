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

Releases publish from a maintainer's machine when a `v*` tag is pushed. The
GitHub Actions publish workflow (`publish.yml`) is paused for now.

One-time setup in your clone:

```bash
git config core.hooksPath .githooks   # enables .githooks/pre-push
npm login                             # an account that can publish @shmaplex
```

To release:

1. Update `CHANGELOG.md` and bump `version` in `package.json`, and merge that to `main`.
2. Tag the merge commit and push the tag:

   ```bash
   git checkout main && git pull
   git tag -a v0.x.y -m "v0.x.y"
   git push origin v0.x.y
   ```

The pre-push hook then:
- checks the tag matches `package.json`
- checks out exactly the tagged commit in a throwaway worktree
- runs lint, and then `prepublishOnly` (build, typecheck, tests)
- runs `npm publish`, which may ask you to approve in the browser

If any step fails, the push is aborted, so a tag reaches GitHub only once its
version is on npm. Pushing a tag whose version is already on npm skips the
publish.

- Rehearse without publishing: `XPLANT_RELEASE_DRY_RUN=1 git push origin v0.x.y`
  runs every check and then stops the push.
- Push a tag without publishing: `SKIP_NPM_PUBLISH=1 git push …`.

Versions published this way carry no npm provenance attestation, because npm
only attaches one when the package is built in a supported CI system. To go
back to publishing from CI, re-enable the workflow (`gh workflow enable
publish.yml`). npm's trusted-publisher record for the package must name this
repository (`shmaplex/xplant_sdk`) and `publish.yml`.
