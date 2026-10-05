export function isRunnerAuthorized(req: Request) {
  const expected = process.env.RUNNER_SHARED_SECRET;
  const received = req.headers.get("x-runner-secret");
  return Boolean(expected && received && received === expected);
}

export function runnerUnauthorized() {
  return Response.json({ error: "Unauthorized runner." }, { status: 401 });
}
