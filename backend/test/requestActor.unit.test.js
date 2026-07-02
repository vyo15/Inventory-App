const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getRequestActor, getRequestActorUser } = require("../src/utils/requestActor");

test("request actor memakai username user lokal", () => {
  const user = { username: "vio", role: "Administrator" };
  const req = { localAuth: { user } };
  assert.equal(getRequestActor(req), "vio");
  assert.equal(getRequestActorUser(req), user);
});

test("request actor memakai fallback system ketika auth kosong", () => {
  assert.equal(getRequestActor(), "system");
  assert.deepEqual(getRequestActorUser(), {});
});
