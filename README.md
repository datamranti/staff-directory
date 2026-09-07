# MRANTI Staff Directory

Standalone internal staff directory for MRANTI. The frontend is deliberately separated from CORE/CRM and reads live staff data from Google Workspace through an authenticated n8n API.

## Architecture

```text
Browser
  -> Firebase Google sign-in (@mranti.my only)
  -> n8n /webhook/staff-directory-data
  -> Firebase token validation
  -> Google Admin SDK Directory API
  -> sanitized active-staff JSON
  -> browser search/filter UI
```

The source code is modular: authentication, API access, directory rendering and styling are separate files. The n8n workflow returns data only; it does not generate the webpage.

## Included

- `index.html` — app shell and login screen
- `src/config.js` — Firebase and API configuration
- `src/auth.js` — Google/Firebase authentication
- `src/api.js` — authenticated directory API client + short session cache
- `src/directory.js` — search, filtering, sorting, grid/list and profile drawer
- `src/app.js` — application orchestration
- `src/styles.css` — MRANTI-style responsive design
- `n8n/staff-directory-api.json` — importable standalone n8n API workflow
- `build.mjs` — zero-dependency build to `dist/`

## 1. Import the n8n backend

Import `n8n/staff-directory-api.json` into the existing MRANTI n8n workspace.

Open **Get Google Workspace Users** and confirm it uses the same Google OAuth2 credential that already works in the existing CRM workflow (currently the existing workflow references the credential named `Unnamed credential`). The credential needs Admin SDK Directory read access.

Activate the workflow. The frontend expects:

```text
https://mrantidata.app.n8n.cloud/webhook/staff-directory-data
```

The API validates the Firebase ID token and only returns active Google Workspace users that are included in the Global Address List. It intentionally omits admin/security/account-status fields from the user-facing response.

## 2. Firebase authorized domain

This frontend reuses the existing `mranticrm` Firebase project and only requests `email` + `profile`; it does **not** request Calendar access.

Before deploying to a new host, add that host under:

**Firebase Console -> Authentication -> Settings -> Authorized domains**

Examples:
- `datamranti.github.io`
- your Cloudflare Pages hostname
- a future custom MRANTI domain

Without this, Google sign-in will fail even though the frontend itself loads.

## 3. Run locally

Any static web server works. Example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` (localhost must also be allowed by Firebase for local sign-in).

## 4. Build

No third-party build dependency is required.

```bash
npm run build
```

The deployable site is generated in `dist/`.

## 5. Cloudflare Pages (recommended for a private GitHub repo)

Use:

```text
Build command: npm run build
Build output directory: dist
```

The repository may remain private. After Cloudflare gives the site its hostname, add that hostname to Firebase Authorized Domains.

## Data shown

The public-facing directory intentionally shows only business directory information:

- Name
- Job title
- Department
- MRANTI email
- Work phone (when available)
- Organisation unit
- Location

Aliases/additional work emails may be returned for search matching, but are not presented prominently on cards.

## Security notes

- Frontend login restriction alone is not treated as security.
- Every API request carries a Firebase ID token.
- n8n independently verifies that token and checks the `@mranti.my` domain before requesting Workspace directory data.
- The frontend uses `text/plain` POSTs, following the working CORE/CRM pattern, to avoid unnecessary browser preflight complexity.
- Responses are marked `no-store`.
