// 서버 렌더링/라우트 오류를 error_logs 테이블과 콘솔에 남긴다.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logServerError } = await import("./lib/errorlog");
  logServerError("render", err, { path: request.path, method: request.method, routePath: context.routePath, routeType: context.routeType });
}
