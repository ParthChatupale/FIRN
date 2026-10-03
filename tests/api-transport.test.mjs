import test from "node:test";
import assert from "node:assert/strict";
import { requestApi, FirnApiError } from "../src/lib/api-transport.ts";
test("successful request preserves JSON and body headers", async (t) => {
  t.mock.method(globalThis, "fetch", async (_, init) => {
    assert.equal(init.headers["Content-Type"], "application/json");
    return Response.json({ id: "saved" });
  });
  assert.deepEqual(await requestApi("local", { method: "POST", body: "{}" }), { id: "saved" });
});
test("structured infeasibility reaches callers unchanged", async (t) => {
  const detail = { code: "infeasible", message: "No-go", diagnostics: { shortfall: 4 } };
  t.mock.method(globalThis, "fetch", async () => Response.json({ detail }, { status: 422 }));
  await assert.rejects(
    requestApi("local"),
    (e) =>
      e instanceof FirnApiError &&
      e.status === 422 &&
      e.message === "No-go" &&
      e.detail.diagnostics.shortfall === 4,
  );
});
test("network loss is distinct from a server rejection", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("network");
  });
  await assert.rejects(
    requestApi("local"),
    (e) => e.status === 0 && e.message.includes("unreachable"),
  );
});
test("timeout gives recoverable pending warning", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    (_, init) =>
      new Promise((_, reject) =>
        init.signal.addEventListener("abort", () => reject(new Error("abort"))),
      ),
  );
  await assert.rejects(
    requestApi("local", undefined, 5),
    (e) => e.status === 408 && e.message.includes("may still finish"),
  );
});
test("timeout while parsing the body is not reported as unreadable JSON", async (t) => {
  t.mock.method(globalThis, "fetch", async (_, init) => ({
    ok: true,
    status: 200,
    json: () =>
      new Promise((_, reject) =>
        init.signal.addEventListener("abort", () => reject(new Error("abort"))),
      ),
  }));
  await assert.rejects(requestApi("local", undefined, 5), (e) => e.status === 408);
});
test("invalid JSON is an explicit error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("bad", { status: 200 }));
  await assert.rejects(
    requestApi("local"),
    (e) => e.status === 200 && e.message.includes("unreadable"),
  );
});
