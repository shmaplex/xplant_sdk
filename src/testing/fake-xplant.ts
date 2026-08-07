/**
 * A fake xPlant server that can refuse.
 *
 * 0.2.0 fixed five methods that called `/api/v1` paths which had never been
 * implemented. Every one of them 404'd against production, and the test suite
 * was green the whole time: the old `stubFetch` helper answered 200 to any URL,
 * so `expect(url).toContain("/api/v1/whatever")` only ever asserted that the
 * SDK called the path the test author also believed in. Both sides encoded one
 * assumption, so neither could catch it being wrong.
 *
 * This routes against `v1-surface.json`, which is generated from the real route
 * files in the xplant repo (`npm run api:surface`). A path that does not exist
 * there 404s here, a method that is not exported 405s, and a call missing its
 * scope 403s — the same answers production gives. Tests written against this
 * fail when the SDK drifts from the API, which is the only property that
 * matters.
 */

import surface from "./v1-surface.json" with { type: "json" };

export interface SurfaceEndpoint {
  path: string;
  method: string;
  scopes: string[];
  guard: string;
}

export const V1_ENDPOINTS: SurfaceEndpoint[] = surface.endpoints;

/** `/api/v1/tasks/{id}` -> matcher for `/api/v1/tasks/anything`. */
function toMatcher(pattern: string): RegExp {
  const source = pattern
    .split("/")
    .map((seg) =>
      seg.startsWith("{") && seg.endsWith("}") ? "[^/]+" : escapeLiteral(seg),
    )
    .join("/");
  return new RegExp(`^${source}$`);
}

function escapeLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Count of `{param}` segments in a manifest path. A literal path like
 * `/api/v1/tasks/demand` also satisfies the wildcard regex for
 * `/api/v1/tasks/{id}`, so on a tie the manifest's declaration order would
 * otherwise decide — exactly backwards from Next.js, which always routes a
 * static segment to its own file ahead of a dynamic sibling.
 */
function specificity(path: string): number {
  return path.split("/").filter((seg) => seg.startsWith("{")).length;
}

const MATCHERS = V1_ENDPOINTS.map((endpoint) => ({
  ...endpoint,
  matcher: toMatcher(endpoint.path),
}));

export interface RecordedCall {
  method: string;
  /** Path with the query string still attached, as the SDK built it. */
  pathWithQuery: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
  /** The manifest entry this call resolved to, or null if nothing matched. */
  matched: SurfaceEndpoint | null;
}

export interface FakeXPlantOptions {
  /**
   * Scopes the API key is treated as holding. Defaults to every scope the
   * manifest mentions, so a test opts in to scope failures rather than
   * tripping over them.
   */
  scopes?: string[];
  /**
   * Response payload per `"METHOD /path"` manifest key, e.g.
   * `{ "GET /api/v1/tasks": [task()] }`. The value is placed in `data` inside
   * the real success envelope.
   */
  responses?: Record<string, unknown>;
  /** Status for a matched route. Defaults to 201 for POST, else 200. */
  status?: number;
}

export interface FakeXPlant {
  /** Install as `globalThis.fetch`. */
  fetch: typeof fetch;
  calls: RecordedCall[];
}

const ALL_SCOPES = [...new Set(V1_ENDPOINTS.flatMap((e) => e.scopes))];

function json(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

/**
 * The error envelope. `authorizeV1` routes answer 403 with code `FORBIDDEN`;
 * the older device and sensor routes hand-roll the check and answer 403 with
 * code `UNAUTHORIZED`. That divergence is real, is recorded in the manifest as
 * `guard`, and is reproduced here so the SDK is tested against what the API
 * actually returns rather than what it ought to.
 */
function failure(code: string, error: string, status: number): Response {
  return json({ ok: false, data: null, error, code }, status);
}

export function fakeXPlant(options: FakeXPlantOptions = {}): FakeXPlant {
  const granted = options.scopes ?? ALL_SCOPES;
  const responses = options.responses ?? {};
  const calls: RecordedCall[] = [];

  const impl = (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(
      Object.entries((init.headers ?? {}) as Record<string, string>).map(
        ([k, v]) => [k.toLowerCase(), v],
      ),
    );

    let body: unknown = null;
    if (typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }

    const samePath = MATCHERS.filter((m) => m.matcher.test(url.pathname));
    // The most specific (fewest wildcard segments) match for this method wins,
    // the same way a static route file outranks a dynamic one in Next.js.
    const sameMethod = samePath.filter((m) => m.method === method);
    const matched =
      sameMethod.length === 0
        ? null
        : sameMethod.reduce((best, candidate) =>
            specificity(candidate.path) < specificity(best.path) ? candidate : best,
          );

    calls.push({
      method,
      pathWithQuery: `${url.pathname}${url.search}`,
      path: url.pathname,
      query: url.searchParams,
      headers,
      body,
      matched: matched
        ? {
            path: matched.path,
            method: matched.method,
            scopes: matched.scopes,
            guard: matched.guard,
          }
        : null,
    });

    if (samePath.length === 0) {
      return Promise.resolve(
        failure("NOT_FOUND", `No such route: ${url.pathname}`, 404),
      );
    }
    if (!matched) {
      return Promise.resolve(
        failure(
          "METHOD_NOT_ALLOWED",
          `${method} is not supported on ${url.pathname}`,
          405,
        ),
      );
    }

    const auth = headers.authorization ?? "";
    if (!auth.startsWith("Bearer ") || auth.length <= "Bearer ".length) {
      return Promise.resolve(failure("UNAUTHORIZED", "Unauthorized", 401));
    }

    const missing = matched.scopes.filter((s) => !granted.includes(s));
    if (missing.length > 0) {
      return Promise.resolve(
        failure(
          matched.guard === "authorizeV1" ? "FORBIDDEN" : "UNAUTHORIZED",
          `Missing scope: ${matched.scopes.join(", ")}`,
          403,
        ),
      );
    }

    const key = `${matched.method} ${matched.path}`;
    const status = options.status ?? (method === "POST" ? 201 : 200);
    return Promise.resolve(
      json({ ok: true, data: responses[key] ?? null }, status),
    );
  };

  return { fetch: impl as unknown as typeof fetch, calls };
}
