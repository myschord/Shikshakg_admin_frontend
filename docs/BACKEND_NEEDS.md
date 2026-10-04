# What the backend still needs to build

The admin console is built against the backend that exists today, plus **five screens that run on sample data** because their routes do not exist yet. This file is the list of what the backend team (the owner) must create later. The routes below are proposals: the screens already follow them, and they can be changed freely before the backend starts. Changing one means editing `src/lib/api/a8.ts` (and `src/lib/mock/a8.ts`, which enforces the same rules in the browser).

When a route ships: set `NEXT_PUBLIC_USE_MOCKS=false` for the admin build, run `npm run api:pull && npm run api:types`, and replay `e2e/a8.spec.ts` against the real backend (the tests assume the sample seed, so they need a small seed script or edits).

Money amounts are decimal strings, times are ISO instants, dates are India calendar days (`YYYY-MM-DD`). Errors use the existing envelope `{error:{code,message,details,request_id}}`; the message is shown to the staff member as written, so write it in plain words. Every write below must record a staff action (`record_admin_action`) with `before` and `after`, because the Action log screen shows exactly those.

## Part 1. Features with a finished screen and no route

| Screen | Who may use it | Status in the console |
|---|---|---|
| Users and roles | admin | Built on sample data |
| Action log | admin | Built on sample data (the data is already recorded by the backend; only a read route is missing) |
| Announcements | admin | Built on sample data |
| Current affairs | editor writes, admin publishes | Built on sample data |
| Daily quiz schedule | editor and admin | Built on sample data; the test picker already uses the real tests route |

### 1. Users and roles (admin only)

| Route | Purpose |
|---|---|
| `GET /admin/users?q&role&cursor&limit` | Search by name or email (case-insensitive substring), filter by role. Returns `Page<User>`. |
| `POST /admin/users/{id}/role` `{role, reason}` | Change role to `student`, `content_editor` or `admin`. |
| `POST /admin/users/{id}/status` `{status, reason}` | `active` or `disabled`. Disabling signs the person out (revoke refresh tokens). |
| `POST /admin/staff` `{email, full_name, role}` | Create a staff account and email an activation link (what `python -m app.cli create-admin` does today). `role` is `content_editor` or `admin`. |

`User` = `{id, email, full_name, role, status: "active"|"disabled", created_at, last_login_at|null}`.

Rules the screen expects the server to enforce (codes in brackets):
- `reason` is required, 1 to 200 characters (`reason_required`, 422).
- You cannot change your own role or disable yourself (`cannot_change_own_role`, `cannot_disable_self`, 409).
- The last active administrator cannot be demoted or disabled (`last_admin`, 409).
- Same role or status as now is refused (`role_unchanged`, `status_unchanged`, 409).
- A taken email on invite is refused (`email_taken`, 409).
- Audit actions: `users.role_changed`, `users.disabled`, `users.enabled`, `users.staff_invited`.

### 2. Action log (admin only)

`GET /admin/action-log?actor_email&action_prefix&entity_type&from&to&cursor&limit`, newest first.

`Entry` = `{id, at, actor_email, action, entity_type, entity_id, before: object|null, after: object|null}`.

Backend work: a read route over the existing audit table. Join the actor's email. `action_prefix` matches the start of `action` (for example `commerce` or `courses.`). Entity types the screen offers: `announcement, course, current_affairs, daily_quiz, entitlement, exam_event, lecture, paper, product, question, refund, test, user, ai_policy`. Add a type to `ENTITY_TYPES` in `ActionLogScreen.tsx` when the backend logs a new one. Never put secrets in `before` or `after`.

### 3. Announcements (admin only)

| Route | Purpose |
|---|---|
| `GET /admin/announcements?status&cursor&limit` | List, newest first. |
| `POST /admin/announcements` | Create. With `send_at` it is `scheduled`, otherwise `draft`. |
| `PATCH /admin/announcements/{id}` | Edit a draft or scheduled one (same body as create). |
| `POST /admin/announcements/{id}/send` | Send now. |
| `POST /admin/announcements/{id}/cancel` | Cancel a draft or scheduled one. |

`Announcement` = `{id, title, body, deep_link|null, exam_slug|null, send_push, status: "draft"|"scheduled"|"sent"|"cancelled", send_at|null, sent_at|null, recipients|null, read_count|null, created_at}`.

Behaviour: sending writes one **notification inbox row per recipient** (category `announcement`) and, when `send_push` is true, a push to those with the category on. `exam_slug` null means all students; otherwise students who follow that exam. A worker sends scheduled ones when `send_at` passes. This depends on the notification inbox in the website plan (`GET /notifications/inbox`, section 8 of `ShikshakG_frontend/docs/FRONTEND_PLAN.md`).

Rules: title 1 to 120 characters; body 1 to 1000; `deep_link` is a path starting with `/` or an `https://` address; `send_at` at least a minute ahead; sent or cancelled ones cannot be edited (`announcement_locked`, 409); a sent one cannot be cancelled (`announcement_sent`, 409). Audit: `announcements.created|updated|sent|cancelled`.

### 4. Current affairs

Staff routes (the student route is `GET /current-affairs?exam_slug&from&topic_id&importance&cursor`, already assumed by the website, ADR 001):

| Route | Purpose |
|---|---|
| `GET /admin/current-affairs?exam_slug&status&cursor&limit` | List. |
| `POST /admin/current-affairs` | Create as `draft`. |
| `PATCH /admin/current-affairs/{id}` | Edit a `draft` or `in_review` item. |
| `POST /admin/current-affairs/{id}/status` `{status, note}` | Move between states. |

`Item` = `{id, exam_slug, title, summary, source_name, source_url, published_on, importance: "low"|"medium"|"high", topic_ids: uuid[], status: "draft"|"in_review"|"published"|"retired", created_by, updated_at}`.

Allowed moves (same table as `CA_MOVES` in `src/lib/api/a8.ts`): `draft → in_review`; `in_review → published | draft`; `published → retired`; `retired → draft`. An invalid move is `invalid_transition` (409). **Publishing is admin only** (`forbidden`, 403); editors write and send for review. Published items cannot be edited in place (`item_locked`, 409). Rules: title 1 to 200; summary 1 to 600; `source_url` starts with `https://`; `published_on` is not in the future; every `topic_id` belongs to the exam's syllabus. Audit: `current_affairs.created|updated|in_review|published|retired|draft`.

Open owner decision: who writes these every day (D4 in the plan).

### 5. Daily quiz schedule

Staff routes (the student route is `GET /exams/{slug}/daily-quiz`, returning today's test id and whether the student attempted it):

| Route | Purpose |
|---|---|
| `GET /admin/exams/{slug}/daily-quizzes?from&to` | Days in the range that have a quiz: `[{date, test_id, test_title}]`. |
| `PUT /admin/exams/{slug}/daily-quizzes/{date}` `{test_id}` | Set or replace the quiz of a day. |
| `DELETE /admin/exams/{slug}/daily-quizzes/{date}` | Remove a future day's quiz. |

Rules: the test must be published and belong to the exam; a day in the past cannot be set (`date_in_past`); the same test cannot be the quiz of two days (`test_already_scheduled`, details name the other day); today's and earlier days cannot be removed (`date_locked`). The attempt runs through the normal test routes; the backend credits the streak (rule D2 in the plan). Audit: `daily_quiz.scheduled|cleared`.

## Part 2. Smaller gaps found while building the console

| Gap | Where it shows | Suggested fix |
|---|---|---|
| Commerce admin routes only require staff | `/admin/products`, `orders`, `refunds`, `entitlements` use `StaffDep`. The console hides them from editors, but an editor can call them directly. | Use `AdminDep` on the commerce admin router, like the AI routes. |
| No route returns an exam's UUID | `GET/PUT /admin/ai/policy` take `exam_id` (UUID); `ExamOut` has only a slug. The console therefore edits only the all-exams policy. | Accept `exam_slug` on the policy routes, or add `id` to `ExamOut`. |
| Admin test detail has no question list | Replacing a question in a test is by position, blind. | Return `questions: [{position, question_id, preview}]` in `TestAdminOut`. |
| No lecture delete | A chapter that holds lectures can never be removed. | `DELETE /admin/lectures/{id}` for a lecture with no student progress. |
| No upload progress or resumable upload | A 200 MB video upload is one request with no progress bar. | Presigned direct-to-S3 upload with multipart (planned with the AWS staging work). |
| No video encoding | The MP4 itself plays. | HLS transcoding (planned with AWS). |
| A rejected refund is stored as `failed` | `RefundStatus` is `requested, processing, processed, failed`. The reject route sets `failed` with the staff note, so a refusal looks the same as a Razorpay error in the Refunds list. | Add a `rejected` state and set it in the reject route. |
| Staff dashboard numbers | The Today screen has no counts of new students, revenue, or open reports. | `GET /admin/dashboard/stats`. |
| AI tutor moderation | No screen: no route to list or review tutor conversations. | Add with the AI tutor (website phase F8 is mocked too). |
| Streak rule setting | Owner decision D2 is open; nothing to configure yet. | A setting once the rule is decided. |

| Catalog reads are cached for 60 s | `GET /exam-categories`, `/exams/{slug}` and the syllabus answer `Cache-Control: public, max-age=60`, so a browser shows a stale list for a minute after staff change it. The console works around it with `no-cache` requests. | Keep the cache for students, but send `no-store` (or an ETag) to staff, or version the URL. |
| No way to see or delete inactive exams, or delete anything in the catalog | The public list hides inactive exams and no `GET /admin/exams` exists, so the console cannot offer "hide from students" (it could not be undone). There are no delete routes for categories, exams, stages, subjects, topics or subtopics. | `GET /admin/exams` and `/admin/exam-categories` including inactive ones; delete or archive for unused nodes. |
| Blueprint sections cannot be read back | `GET .../blueprints` returns totals only, not the sections, subjects or difficulty mix, so a new version is written from scratch. | Return sections in `BlueprintOut`. |
| Taxonomy has no descriptions or Hindi names on read | `TaxonomySubjectOut` has only id, slug and name, so the console can rename but not edit descriptions or Hindi names. | Add `description` and `localized_names` to the taxonomy read. |
| Syllabus order is lost on read | `GET /exams/{slug}/syllabus` groups topics by subject, but the order is stored per topic. The console shows them grouped, and saving rewrites the order as shown. | Return an `position` per topic, or a flat ordered list. |
| Imported questions appear in the list a moment after the job says finished | The job page shows the records as done about half a second before `GET /admin/questions` lists them, which briefly shows an empty review queue. | Commit the question rows before the job counts, or mark the job finished after. |

## Part 3. Still to build on the console side

- Nothing else is planned for the console: A0 to A8 and the catalog editor are all built.
- Real-backend replay of `e2e/a8.spec.ts` once Part 1 ships.
