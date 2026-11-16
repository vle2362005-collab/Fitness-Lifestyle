const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const originalFetch = global.fetch;
const store = new Map();
global.window = new EventTarget();
global.localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: key => store.delete(key),
};
process.env.NEXT_PUBLIC_API_URL = "http://localhost:5088/api";
function load(file, resolve) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }}).outputText;
  const module = { exports: {} };
  Function("module", "exports", "require", js)(module, module.exports, resolve);
  return module.exports;
}
const core = load("services/api.ts", require);
const { coachApi, communityApi, coachKey } = load("lib/dacn.ts", name => {
  if (name === "@/services/api") return core;
  throw Error(name);
});

(async () => {
  core.saveSession({ token: "fixture-token", userId: 1, username: "demo" });
  assert.equal(coachKey("Push-up"), "pushup");
  assert.equal(coachKey("Chống đẩy gối"), null);

  const calls = [];
  let reply = () => new Response(JSON.stringify({ sessionId: "session", latest: null, items: [] }), {
    status: 200, headers: { "content-type": "application/json" },
  });
  global.fetch = async (url, init) => { calls.push({ url, init }); return reply(); };
  const started = await coachApi.start(1);
  assert.equal(started.sessionId, "session");
  assert.equal(calls[0].url, "http://localhost:5088/api/pose-coach/sessions");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer fixture-token");
  assert.deepEqual(JSON.parse(calls[0].init.body), { exerciseId: 1 });

  const frame = { sequence: 1, timestampMs: 200, width: 640, height: 480, points: {} };
  await coachApi.send("session", frame);
  await coachApi.sendBatch("session", [frame]);
  assert.ok(calls.slice(1).every(x => x.url.endsWith("/pose-coach/sessions/session/frames")));
  assert.deepEqual(JSON.parse(calls[2].init.body), { frames: [frame] });

  reply = () => new Response(null, { status: 204 });
  await communityApi.like(5, false);
  await communityApi.like(5, true);
  assert.equal(calls[3].init.method, "PUT");
  assert.equal(calls[4].init.method, "DELETE");
  await communityApi.edit(5, "Caption");
  assert.deepEqual(JSON.parse(calls[5].init.body), { content: "Caption" });

  let expired = false;
  window.addEventListener("fitness-session-expired", () => { expired = true; });
  reply = () => new Response(JSON.stringify({ title: "Expired" }), {
    status: 401, headers: { "content-type": "application/problem+json" },
  });
  await assert.rejects(communityApi.list, /Expired/);
  assert.ok(expired);
  assert.equal(core.getToken(), null);
  console.log("PASS Web client contract: coach payload, batch, likes, edit and expired session.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => { global.fetch = originalFetch; });
