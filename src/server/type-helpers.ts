export function makeRoutes<D, const R extends string>(
  routes: Bun.Serve.Routes<D, R>,
): typeof routes {
  return routes;
}
