/**
 * Public URL used for OAuth redirect_uri generation.
 * In production behind nginx, AUTH_URL must be the external https URL
 * (no trailing slash), e.g. https://wg.example.com
 */
export function getAuthConfigUrl(): string | undefined {
  const raw = process.env.AUTH_URL?.trim();
  if (!raw) {
    return undefined;
  }

  return raw.replace(/\/$/, "");
}

export function getPublicOrigin(): string | undefined {
  const configUrl = getAuthConfigUrl();
  if (!configUrl) {
    return undefined;
  }

  try {
    return new URL(configUrl).origin;
  } catch {
    return undefined;
  }
}

export function applyProxyHeaders(requestHeaders: Headers): Headers {
  const origin = getPublicOrigin();
  if (!origin) {
    return requestHeaders;
  }

  const headers = new Headers(requestHeaders);
  const publicUrl = new URL(origin);

  headers.set(
    "x-forwarded-proto",
    publicUrl.protocol === "https:" ? "https" : "http",
  );
  headers.set("x-forwarded-host", publicUrl.host);

  return headers;
}
