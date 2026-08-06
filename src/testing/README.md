# Test surface

`v1-surface.json` is generated in the **xplant** repo, not here:

```bash
# in the xplant checkout
npm run api:surface     # rewrites docs/api/v1-surface.json from app/api/v1/**
```

Then copy it across:

```bash
cp ../xplant/docs/api/v1-surface.json src/testing/v1-surface.json
```

## Why it exists

0.1.x shipped five methods calling `/api/v1` paths that had never been
implemented. They 404'd against production and the test suite was green
throughout, because the fetch stub answered `200` to any URL. An assertion like
`expect(url).toContain("/api/v1/plants")` only checks that the SDK called the
path the test author also believed in — when that belief is wrong, both sides
are wrong together and nothing fails.

`fakeXPlant()` routes against this manifest instead. A path that is not in it
returns 404, a method the route does not export returns 405, and a call missing
its scope returns 403 — the same answers the real API gives.

## Keeping it current

xplant's own `tests/api/v1-surface.test.ts` fails if the manifest there drifts
from the route files, so the generated artifact is trustworthy. What this repo
cannot detect on its own is the copy here being *older* than that one: a route
deleted in xplant would still appear available to these tests.

Re-copy it whenever you touch a resource, and before cutting a release.
