# Test surface

`v1-surface.json` is a manifest of every `/api/v1` route: its path, method,
the scopes it requires, which credentials it accepts (`auth`), and whether it
replays a repeated `Idempotency-Key` (`idempotent`). It is generated from the
API's route code by the xPlant team and vendored here unchanged. Do not edit it
by hand.

```jsonc
{
  "path": "/api/v1/tasks",
  "method": "POST",
  "scopes": ["write:tasks"],
  "auth": "workspace_key",            // or "workspace_key_or_device_token"
  "idempotent": true
}
```

## Why it exists

0.1.x shipped five methods calling `/api/v1` paths that had never been
implemented. They 404'd against production and the test suite was green
throughout, because the fetch stub answered `200` to any URL. An assertion like
`expect(url).toContain("/api/v1/plants")` only checks that the SDK called the
path the test author also believed in — when that belief is wrong, both sides
are wrong together and nothing fails.

`fakeXPlant()` routes against this manifest instead. A path that is not in it
returns 404, a method the route does not export returns 405, a call missing its
scope returns 403, a device token on a workspace-only route returns 403, and a
repeated `Idempotency-Key` on a replaying route gets the stored answer back —
the same answers the real API gives.

`contract.test.ts` then checks, from the manifest rather than from a list kept
in this repo:

- every SDK method reaches a route that exists, and every route has a method;
- reads and replaying writes are resent after a network failure, under the same
  key, and other writes are not;
- device tokens reach exactly the endpoints whose `auth` accepts them.

## Keeping it current

What this repo cannot detect on its own is the copy here being *older* than the
API: a route removed upstream would still appear available to these tests.
Replace the file with the latest manifest whenever you touch a resource, and
before cutting a release. When a route changes its `auth` or `idempotent`
value, the contract tests fail until the SDK matches.
