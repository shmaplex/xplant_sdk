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
 * This routes against `v1-surface.json`, which is generated from the real API
 * routes. A path that does not exist there 404s here, a method that is not
 * exported 405s, a call missing its scope 403s, a device token on a
 * workspace-only route 403s, and a repeated `Idempotency-Key` on a route that
 * replays gets the stored answer back — the same answers production gives.
 * Tests written against this fail when the SDK drifts from the API, which is
 * the only property that matters.
 */

import surface from "./v1-surface.json" with { type: "json" };

/** Which credentials an endpoint accepts. */
export type SurfaceAuth = "workspace_key" | "workspace_key_or_device_token";

export interface SurfaceEndpoint {
  path: string;
  method: string;
  scopes: string[];
  auth: SurfaceAuth;
  /** The endpoint answers a repeated `Idempotency-Key` with the stored result. */
  idempotent: boolean;
}

export const V1_ENDPOINTS: SurfaceEndpoint[] = surface.endpoints as SurfaceEndpoint[];

/** `/api/v1/tasks/{id}` -> matcher for `/api/v1/tasks/anything`. */
function toMatcher(pattern: string): RegExp {
  const source = pattern
    .split("/")
    .map((seg) =>
      seg.startsWith("{") && seg.endsWith("}") ? "([^/]+)" : escapeLiteral(seg),
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
  params: endpoint.path
    .split("/")
    .filter((seg) => seg.startsWith("{"))
    .map((seg) => seg.slice(1, -1)),
}));

export interface RecordedCall {
  method: string;
  /** Path with the query string still attached, as the SDK built it. */
  pathWithQuery: string;
  path: string;
  query: URLSearchParams;
  /** Lower-cased header names. */
  headers: Record<string, string>;
  body: unknown;
  /** The manifest entry this call resolved to, or null if nothing matched. */
  matched: SurfaceEndpoint | null;
  /** `true` when the answer was a stored result replayed for a repeated `Idempotency-Key`. */
  replayed: boolean;
}

export interface FakeXPlantOptions {
  /**
   * Scopes a workspace key is treated as holding. Defaults to every scope the
   * manifest mentions, so a test opts in to scope failures rather than
   * tripping over them.
   */
  scopes?: string[];
  /**
   * Device tokens the fake recognises, mapped to the device each is bound to,
   * e.g. `{ "xpd_live_shelf3": "d1" }`. Any other `xpd_` bearer is unknown and
   * answers 401, as a revoked token does.
   */
  deviceTokens?: Record<string, string>;
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
  /** Install as `globalThis.fetch`, or pass as the client's `fetch` option. */
  fetch: typeof fetch;
  calls: RecordedCall[];
}

const ALL_SCOPES = [...new Set(V1_ENDPOINTS.flatMap((e) => e.scopes))];

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** The error envelope every `/api/v1` route shares. */
function failure(code: string, error: string, status: number): Response {
  return json({ ok: false, data: null, error, code }, status);
}

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  const record: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

/** The device ids a request writes about: the `{deviceId}` path segment, or `device_id` in the body. */
function devicesNamed(pathParams: Record<string, string>, body: unknown): string[] {
  if (pathParams.deviceId) return [pathParams.deviceId];
  if (body === null || typeof body !== "object") return [];
  const record = body as { device_id?: unknown; readings?: unknown };
  if (Array.isArray(record.readings)) {
    return record.readings
      .map((r) => (r as { device_id?: unknown } | null)?.device_id)
      .filter((id): id is string => typeof id === "string");
  }
  return typeof record.device_id === "string" ? [record.device_id] : [];
}

export function fakeXPlant(options: FakeXPlantOptions = {}): FakeXPlant {
  const granted = options.scopes ?? ALL_SCOPES;
  const deviceTokens = options.deviceTokens ?? {};
  const responses = options.responses ?? {};
  const calls: RecordedCall[] = [];
  const receipts = new Map<string, { status: number; body: unknown }>();

  const answer = (
    url: URL,
    method: string,
    headers: Record<string, string>,
    body: unknown,
  ): { response: Response; matched: SurfaceEndpoint | null; replayed: boolean } => {
    const samePath = MATCHERS.filter((m) => m.matcher.test(url.pathname));
    // The most specific (fewest wildcard segments) match for this method wins,
    // the same way a static route file outranks a dynamic one in Next.js.
    const sameMethod = samePath.filter((m) => m.method === method);
    const route =
      sameMethod.length === 0
        ? null
        : sameMethod.reduce((best, candidate) =>
            specificity(candidate.path) < specificity(best.path) ? candidate : best,
          );
    const matched: SurfaceEndpoint | null = route
      ? {
          path: route.path,
          method: route.method,
          scopes: route.scopes,
          auth: route.auth,
          idempotent: route.idempotent,
        }
      : null;
    const refuse = (response: Response) => ({ response, matched, replayed: false });

    if (samePath.length === 0) {
      return refuse(failure("NOT_FOUND", `No such route: ${url.pathname}`, 404));
    }
    if (!route) {
      return refuse(
        failure("METHOD_NOT_ALLOWED", `${method} is not supported on ${url.pathname}`, 405),
      );
    }

    const auth = headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
    if (!token) return refuse(failure("UNAUTHORIZED", "Unauthorized", 401));

    if (token.startsWith("xpd_")) {
      // Refused by shape before the token is even looked up, as production does.
      if (route.auth !== "workspace_key_or_device_token") {
        return refuse(
          failure(
            "DEVICE_TOKEN_NOT_ACCEPTED",
            "This endpoint requires a workspace API key. A device token can only post its own device's readings and events.",
            403,
          ),
        );
      }
      const boundTo = deviceTokens[token];
      if (!boundTo) return refuse(failure("UNAUTHORIZED", "Unauthorized", 401));

      const values = route.matcher.exec(url.pathname)?.slice(1) ?? [];
      const pathParams = Object.fromEntries(route.params.map((name, i) => [name, values[i]]));
      if (devicesNamed(pathParams, body).some((id) => id !== boundTo)) {
        return refuse(
          failure(
            "DEVICE_TOKEN_WRONG_DEVICE",
            "This device token can only write about the device it is bound to.",
            403,
          ),
        );
      }
      // A device token carries no scopes; what it may do is fixed by what it is.
    } else {
      const missing = route.scopes.filter((s) => !granted.includes(s));
      if (missing.length > 0) {
        return refuse(failure("FORBIDDEN", `Missing scope: ${route.scopes.join(", ")}`, 403));
      }
    }

    const key = headers["idempotency-key"];
    const receiptKey = route.idempotent && key ? `${token} ${method} ${route.path} ${key}` : null;
    const stored = receiptKey ? receipts.get(receiptKey) : undefined;
    if (stored) {
      return {
        response: json(stored.body, stored.status, { "Idempotent-Replay": "true" }),
        matched,
        replayed: true,
      };
    }

    const status = options.status ?? (method === "POST" ? 201 : 200);
    const envelope = { ok: true, data: responses[`${route.method} ${route.path}`] ?? null };
    if (receiptKey && status < 400) receipts.set(receiptKey, { status, body: envelope });
    return { response: json(envelope, status), matched, replayed: false };
  };

  const impl = (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    const headers = headerRecord(init.headers);

    let body: unknown = null;
    if (typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }

    const { response, matched, replayed } = answer(url, method, headers, body);
    calls.push({
      method,
      pathWithQuery: `${url.pathname}${url.search}`,
      path: url.pathname,
      query: url.searchParams,
      headers,
      body,
      matched,
      replayed,
    });
    return Promise.resolve(response);
  };

  return { fetch: impl as unknown as typeof fetch, calls };
}
