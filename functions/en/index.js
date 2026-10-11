// functions/en/index.js — /en y /en/ llevan al índice de spots de NZ.
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  url.pathname = "/en/spots";
  url.search = "";
  return Response.redirect(url.toString(), 301);
}
