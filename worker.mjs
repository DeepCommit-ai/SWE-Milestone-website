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

// The standalone leaderboard page was retired in favor of the home-page
// section; old external links and search-engine entries must keep resolving.
const RETIRED_LEADERBOARD_PATHS = new Set(["/leaderboard", "/leaderboard/", "/leaderboard.html"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const redirect = canonicalRedirect(url);
    if (redirect) return redirect;

    if (RETIRED_LEADERBOARD_PATHS.has(url.pathname)) {
      return Response.redirect(`https://${CANONICAL_HOST}/#leaderboard`, 301);
    }

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
