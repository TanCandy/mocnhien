// Shared helpers for the E2E flow scripts.
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "..");
const SHOTS = path.join(OUT, "screenshots");
const LOGS = path.join(OUT, "logs");
const BASE = "http://localhost:3000";
const API = "http://localhost:4000";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PASS = "E2e-Pass-123";
const USERS = {
  admin: { email: "admin-e2e@test.local", password: PASS },
  a: { email: "khach-a@test.local", password: PASS },
  b: { email: "khach-b@test.local", password: PASS },
};
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

const ROOT = path.resolve(OUT, "..");
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || path.resolve(ROOT, ".playwright-browsers");

function playwright() {
  for (const p of ["playwright", "playwright-core", process.env.PW_PATH || ""]) {
    try {
      if (p) return require(p);
    } catch (e) {
      /* try next */
    }
  }
  throw new Error("playwright not found: npm i playwright, or set PW_PATH");
}

const results = [];

/** Record one check: id, area, title, pass/fail (+ evidence text / screenshot file). */
function check(id, area, title, ok, detail = "", shot = "") {
  results.push({ id, area, title, ok: !!ok, detail: String(detail).slice(0, 300), shot });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${title}${ok ? "" : "  -> " + String(detail).slice(0, 200)}`);
  return !!ok;
}

function skip(id, area, title, reason) {
  results.push({ id, area, title, ok: null, detail: reason, shot: "" });
  console.log(`SKIP ${id} ${title} (${reason})`);
}

function save(name) {
  fs.writeFileSync(path.join(LOGS, name), JSON.stringify(results, null, 2));
}

async function http(method, url, { token, body, headers = {} } = {}) {
  const h = { "Content-Type": "application/json", ...headers };
  if (token) h.Authorization = "Bearer " + token;
  const r = await fetch(API + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = {};
  try {
    json = await r.json();
  } catch (e) {
    /* not json */
  }
  return { status: r.status, body: json, headers: r.headers };
}

async function login(who) {
  const r = await http("POST", "/api/auth/login", { body: USERS[who] });
  return { token: r.body.token, user: r.body.user, status: r.status };
}

async function control(p) {
  let ok = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch("http://localhost:4999" + p);
      if (res.ok) { ok = true; break; }
    } catch (e) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  if (!ok) {
    throw new Error("Failed to reach control server for " + p);
  }
  // the backend needs a moment to reconnect to Mongo after a restart
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(API + "/health");
      if (r.ok) return;
    } catch (e) {
      /* not up yet */
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error("backend did not come back after " + p);
}
const reset = () => control("/reseed");
const restart = () => control("/restart");

module.exports = {
  OUT, SHOTS, LOGS, BASE, API, CHROME, PASS, USERS,
  playwright, check, skip, save, results, http, login, reset, restart, control,
};
