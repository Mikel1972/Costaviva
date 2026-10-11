// functions/pt/index.js — /pt a secas: a los pesqueros de Portugal en portugués.
export function onRequestGet(context) {
  return Response.redirect(new URL("/pt/spots/region/portugal", context.request.url).toString(), 301);
}
