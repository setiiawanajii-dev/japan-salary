const CACHE = "japan-salary-v1.1.0";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./storage.js",
  "./demo.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./engine/settings.js",
  "./engine/timeCalculator.js",
  "./engine/overtimeCalculator.js",
  "./engine/payPeriodCalculator.js",
  "./engine/salaryEngine.js",
  "./engine/allowanceCalculator.js",
  "./engine/deductionCalculator.js",
];
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("japan-salary-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== location.origin
  )
    return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches
        .match(e.request)
        .then(
          (r) =>
            r ||
            (e.request.mode === "navigate"
              ? caches.match("./index.html")
              : Response.error()),
        ),
    ),
  );
});
