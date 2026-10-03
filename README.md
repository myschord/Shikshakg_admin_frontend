# ShikshakG admin console

Staff console for the ShikshakG backend. It is a separate app from the student website (`../ShikshakG_frontend`) so staff
screens are never downloaded by students. Same backend, same light-blue palette, its own Cloudflare deploy.
Desktop first, usable on a tablet, not designed for phones.

## Status

| Phase | What | State |
|---|---|---|
| A0 | Shell, staff sign-in, role-aware menu, table / form / dialog kit | Done |
| A1 | Exam dates: add, edit draft, publish, correct, recheck, retire, stale queue | Done. Catalog editor (categories, exams, stages, syllabus, blueprints, prerequisites) is not built yet |
| A2 to A8 | Question bank and review, imports, PDF extraction, papers and tests, courses, commerce, AI controls, new backend features | Planned (menu shows "Soon") |

## Run it

The local backend must be up (`docker compose up` in `../shikshag_backend`, API on port 8020) and its
`CORS_ORIGINS` must include `http://localhost:3100`.

```bash
npm install
npm run dev          # http://localhost:3100
```

Environment (`.env.local`, see `.env.example`): `NEXT_PUBLIC_API_URL` (backend origin) and `NEXT_PUBLIC_APP_ENV`.

## Staff accounts

There is no public sign-up. An operator creates an account, and the person sets a password from the emailed link:

```bash
docker exec shikshag-api-1 python -m app.cli create-admin --email ops@example.com --full-name "Ops Admin"
docker exec shikshag-api-1 python -m app.cli create-admin --email editor@example.com --full-name "An Editor" --role content_editor
```

Locally the email provider prints the link in `docker logs shikshag-worker-1`.

Roles: **admin** sees everything; **content_editor** does not see Commerce, AI controls, or Users and roles, and is refused if
they open those addresses directly. The menu only hides things. The backend checks the role on every call, and a student
account is refused at sign-in and keeps no session.

## Build and check

```bash
npm run build        # next build, then fills the Content-Security-Policy into out/_headers
npm run serve        # serves out/ on port 3100 with the same headers Cloudflare sends
npm run e2e          # Playwright against the build and the local backend
```

The end-to-end suite covers student refusal, different menus for editor and admin, a full date lifecycle (draft, publish,
reaches a student, correct, replace, retire), the stale queue, and every screen at 768 and 1280 px for overflow, CSP
violations and accessibility (axe, WCAG 2.1 AA). Run `npx playwright install chromium` once first.

## Deploying

Cloudflare build command `npm run build`, output `out`. Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_ENV` as build variables.
The backend's `CORS_ORIGINS` must include this site's origin. Use its own project and domain, for example
`admin.shikshakg.com`.

## API types

`npm run api:pull` downloads the backend's OpenAPI file and `npm run api:types` regenerates `src/lib/api/schema.d.ts`.
Each app generates its own, so no shared package is needed.
