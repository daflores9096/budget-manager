## Android (future) — recommended path

This project is built as a web app (React + Vite) backed by a PHP API. The lowest-effort path to Android is:

1) **PWA first** (installed from Chrome)
2) If you later need an APK/AAB or native APIs, wrap the same web UI using **Capacitor**

This repo is being prepared for that migration (PWA manifest + service worker + env-based API base URL).

---

## 1) PWA (today)

### Install on Android (Chrome)

- Open the web app URL in Chrome.
- Menu → **Add to Home screen** (or “Install app”).
- Launch it from the home screen; it should run in **standalone** mode.

### Notes

- The PWA is configured with a conservative caching strategy. Static assets are cached, API calls are network-first.
- If you run the UI on a different host than the API, set `VITE_API_BASE_URL` at build time.

---

## 2) Capacitor (later)

### Prerequisites

- Android Studio + Android SDK
- JDK 17+

### Steps (high level)

From `frontend/`:

```bash
npm install
npm run build
npx cap init budget-manager com.example.budgetmanager
npx cap add android
npx cap copy android
npx cap open android
```

### Dev workflow options

- **Use the built assets**: run `npm run build`, then `npx cap copy android`, then run from Android Studio.
- **Live reload** (optional): point Capacitor to a dev server (`vite dev`) via `server.url` in `capacitor.config.*` (recommended only after basic flows are stable).

---

## Authentication notes (mobile)

The web app uses HttpOnly cookies, but the API can also accept:

- `Authorization: Bearer <access_token>`

`POST /api/auth/login` returns `access_token` (in addition to the cookie session) so mobile wrappers can avoid cookie edge cases.

