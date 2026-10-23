function failure(status: number, message: string): Response {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function proxyVideoCrunch(
  request: Request,
  segments: readonly string[],
): Promise<Response> {
  if (process.env.MOORKYZ_VIDEOCRUNCH_ENABLED !== "1") {
    return failure(
      503,
      "VideoCrunch connection is off. Enable MOORKYZ_VIDEOCRUNCH_ENABLED=1 locally and restart the portal.",
    );
  }
  const host = request.headers.get("host") ?? "";
  if (
    !/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(host) ||
    (request.headers.get("origin") !== null &&
      request.headers.get("origin") !== `http://${host}`) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return failure(
      403,
      "VideoCrunch is available only from the local portal address. Public hosting is disabled.",
    );
  }
  const port = process.env.MOORKYZ_VIDEOCRUNCH_PORT ?? "8765";
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    return failure(
      503,
      "MOORKYZ_VIDEOCRUNCH_PORT must be a valid local TCP port.",
    );
  }
  const serviceOrigin = `http://127.0.0.1:${port}`;
  const pathname = segments.join("/");
  const staticFile = [
    "",
    "index.html",
    "app.js",
    "styles.css",
    "favicon.svg",
  ].includes(pathname);
  const api =
    /^(?:api\/config|api\/jobs(?:\/[0-9a-f-]+(?:\/files\/(?:index\.html|manifest\.json|original\/source\.[a-z0-9]+|compressed\/video\.mp4))?)?)$/.test(
      pathname,
    );
  if (
    (!staticFile && !api) ||
    segments.some(
      (part) =>
        part.includes("/") ||
        part.includes("\\") ||
        part === "." ||
        part === "..",
    )
  ) {
    return failure(404, "Unknown VideoCrunch resource.");
  }
  if (
    !["GET", "HEAD"].includes(request.method) &&
    !(request.method === "POST" && pathname === "api/jobs")
  ) {
    return failure(405, "This operation is not available.");
  }
  const headers = new Headers();
  for (const name of ["content-type", "x-webvideocrunch-token", "range"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  let body: ArrayBuffer | undefined;
  if (request.method === "POST") {
    if (!/^application\/json(?:;|$)/i.test(headers.get("content-type") ?? ""))
      return failure(415, "Send the export configuration as JSON.");
    const reader = request.body?.getReader();
    if (!reader) return failure(400, "Expected an export configuration.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 16384) {
          await reader.cancel();
          return failure(413, "The request is too large.");
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    body = bytes.buffer;
  }
  const url = new URL(
    pathname === "index.html" ? "/" : `/${pathname}`,
    serviceOrigin,
  );
  if (new URL(request.url).searchParams.has("download"))
    url.searchParams.set("download", "1");
  let upstream: Response;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 15000);
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body: body ?? null,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.any([request.signal, timeout.signal]),
    });
  } catch (error) {
    console.error("VideoCrunch local connection failed:", error);
    return failure(
      502,
      "Cannot reach VideoCrunch. Start pnpm tool:videocrunch on this Windows PC, keep its terminal open, and retry.",
    );
  } finally {
    clearTimeout(timer);
  }
  const responseHeaders = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy":
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
  });
  for (const name of [
    "content-type",
    "content-length",
    "content-disposition",
    "accept-ranges",
    "content-range",
  ]) {
    const value = upstream.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
