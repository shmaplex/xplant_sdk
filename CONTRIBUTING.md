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

Releases are published by `.github/workflows/publish.yml` when a `v*` tag is
pushed. It uses npm trusted publishing with provenance, so no npm token is
stored in the repository.

1. Update `CHANGELOG.md`
2. Bump `version` in `package.json`
3. Commit: `git commit -m "chore: release v0.x.x"`
4. Tag and push: `git tag v0.x.x && git push origin v0.x.x`

Pushing the tag publishes to npm. Do not push one until the release has been
approved.
