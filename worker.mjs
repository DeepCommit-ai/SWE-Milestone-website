const CANONICAL_HOST = "swe-milestone.com";
const PRODUCTION_HOSTS = new Set([CANONICAL_HOST, `www.${CANONICAL_HOST}`]);

function canonicalRedirect(url) {
  if (!PRODUCTION_HOSTS.has(url.hostname)) return null;
  if (url.protocol === "https:" && url.hostname === CANONICAL_HOST) return null;

  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return Response.redirect(url.toString(), 301);
}

export default {
  async fetch(request, env) {
    const redirect = canonicalRedirect(new URL(request.url));
    if (redirect) return redirect;

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
