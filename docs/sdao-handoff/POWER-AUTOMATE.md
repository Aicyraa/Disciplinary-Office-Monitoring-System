# Power Automate (Premium) — integration design

Your stack (from the repo): **Express 5 + TypeScript API**, **Prisma 7 on Neon**, React 19 + Vite SPA, passport-local + express-session + connect-pg-simple, bcryptjs, helmet, express-rate-limit. Power Automate (PA) Premium adds the HTTP trigger/action and sends mail through the NU Microsoft 365 tenant.

## 0. Trust model (decision 11)

Power Automate gives you **one thing per flow: a signed trigger URL**. There is no shared secret and no API key.
- **The trigger URL is the credential.** Store it as `PA_NOTIFY_URL` (Flow 2) and `PA_GATE_URL` (Flow 1) in the root `.env`. Treat each like a password: never under a `VITE_` key, never in Git, never in logs.
- **The flow never calls the API.** The flow does its work and answers in its own HTTP **Response**. The API reads that response to set `email_status`. So there is no callback URL, no tunnel, no `x-api-key`, no `PA_SHARED_SECRET`, and no `/integrations/*` endpoints.
- Trigger setting: "Who can trigger the flow" = **Anyone**. This is safe only because the URL carries a signature and stays server-side.

## 1. Principle: the API is the only writer to the database

PA never writes to Postgres directly. Reasons:
- All rules (escalation, status checks, the "open every file before verify" gate, overlap checks, idempotency) live in one tested place. PA can't run a database transaction.
- No database credentials in PA. A leaked flow can't read or delete the data.
- Neon scales to zero; the API deals with cold starts and retries once instead of every flow.

## 2. Ordering: commit first, notify second

```
Admin action in the web app
  → API validates + writes to the DB (one transaction) incl. a `notifications` row (email_status = 'pending')
  → COMMIT
  → in the background, API POSTs the envelope to the flow's trigger URL
  → flow sends the email and answers with a Response: {"status":"sent"} or {"status":"failed","error":"..."}
  → API updates notifications.email_status / date_email_sent
```
Why: if you notify first and the database write then fails, the student is told about something that never happened, and PA cannot roll the email back. With commit-first, the worst case is "saved but not yet emailed", which `pending` exposes and a retry fixes. The `idempotency_key` on `notifications` makes retries safe on the API side.

## 3. The two flows

Both flows receive the **same envelope** (section 4). Only `type` and `payload` differ.

### Flow 1 — "SDO Gate Report Submitted"
The **web gate form stays** in your app. It posts to your API, never to Power Automate (a trigger URL in browser code would be public and spammable).

```
Visitor submits the web gate form
  → POST /public/gate-reports on your API   (bot checks + rate limit + validation, see SPEC 4.10)
  → API inserts one disciplinary_cases row per violation (source='gate', shared submission_ref) + timeline + notification rows (one transaction), COMMIT
  → API POSTs the envelope (type "report") to PA_GATE_URL
  → Flow 1 sends: (a) "report received" email to the student (only if the ID matched), (b) alert to the staff alert address
  → Flow 1 answers with the Response
```
| Step | Action | Notes |
|---|---|---|
| 1 | Trigger: **When an HTTP request is received** | Method POST |
| 2 | **Parse JSON** on the body | schema = the envelope, section 4 |
| 3 | **Condition**: `payload.student_matched` | yes → email the student; no → skip (staff alert says "ID not on file") |
| 4 | **Send an email (V2)** to the student | reference number, violations listed, "waiting for staff review" |
| 5 | **Send an email (V2)** to the staff alert address (`SDO_STAFF_MAILBOX`, set in the flow) | link to the case in the staff app |
| 6 | **Response** (200) | wrap steps 3–5 in a Scope; on success `{"status":"sent"}`, on failure (Configure run after: failed / timed out) `{"status":"failed","error":"<message>"}` |

Flow 1 payload (`type` = `"report"`):
```json
{
  "type": "report",
  "payload": {
    "reference": "3f0c2c1e-8a47-4b8e-9d59-1f2a6b7c9d10",
    "student_matched": true,
    "student_email": "student@students.nu-fairview.edu.ph",
    "student_name": "Darlwyn Jee Daguman",
    "violations": ["Improper Uniform", "No ID"],
    "submitted_at": "2026-10-11T08:00:00Z",
    "case_url": "https://app.example.edu/staff/cases/17"
  }
}
```
`reference` is the form submit's `submission_ref` (uuid). Because the API commits first, a submission is never lost if Power Automate is down; the notifications stay `pending` and the API retries.

> Flow 1 and Flow 2 do almost the same job. You can keep both (Flow 1 = form submissions, Flow 2 = every admin-triggered notification). If you ever want to cut maintenance, Flow 1 can simply become a call to Flow 2.

### Flow 2 — "SDO Notify (dynamic)" (one flow, takes parameters)
Trigger: **When an HTTP request is received** (Premium), method POST. The API pre-renders subject and HTML, so email wording lives in your repo and is versioned.

Payload (`type` = one of the notification kinds):
```json
{
  "type": "sanction",
  "payload": {
    "notification_id": 123,
    "idempotency_key": "san:12:completed",
    "channel": "email",
    "to": "student@students.nu-fairview.edu.ph",
    "cc": [],
    "subject": "Sanction S012 verified",
    "html_body": "<p>Hi Jee, your sanction was verified.</p>",
    "link_url": "https://app.example.edu/sanctions/12"
  }
}
```
Steps:
1. **Parse JSON** on the body (schema = envelope).
2. **Switch on `payload.channel`**: `email` → **Send an email (V2)** using the flow owner's own mail connection (SPEC decision 15); `teams` (optional later) → **Post message in a chat/channel**.
3. **Scope (try/catch)**: on success → **Response 200** `{"status":"sent"}`; on failure (Configure run after: failed / timed out) → **Response 200** `{"status":"failed","error":"<message>"}`.

A synchronous Response must finish within PA's HTTP limit (about 2 minutes); sending one email takes seconds. The API does not make the user wait for it (section 2).

Why this is "dynamic": the **same** flow handles every notification kind (case validated, sanction assigned, appointment moved, clearance change, password reset…). Only the parameters change.

## 4. Helper function rules (any code that calls Power Automate)

All outbound calls go through **one** helper, for example `api/src/integrations/power-automate.ts` exporting `sendToPowerAutomate(type, payload)`. No other file calls `fetch` against a PA URL.

**The request body is exactly two top-level keys, `type` and `payload`, nothing else:**
```json
{
  "type": "sanction",
  "payload": { }
}
```
Rules:
1. `type` is a closed union exported from `shared/types.ts` (import with `import type`), equal to the `notifications.kind` values: `report`, `case`, `esc`, `sanction`, `appt`, `clr`, `account`, `newviol`. A new type means a spec change, not an ad-hoc string.
2. `payload` is a plain JSON object built by a **pure builder function per `type`** (so tests need no network and no database). Never spread request bodies or DB rows into it.
3. The flow reads `triggerBody()?['type']` and `triggerBody()?['payload']?['<field>']`. Each flow's Parse JSON schema must declare both keys.
4. The helper reads the URL lazily from env (`PA_NOTIFY_URL`, or `PA_GATE_URL` for `type: "report"` from the gate form), uses a 10-second timeout, and never throws into the business transaction.
5. It returns `{ outcome: 'sent' | 'failed' | 'unknown' }`: HTTP 200 with `status:"sent"` → `sent`; 200 with `status:"failed"` → `failed`; network error, timeout, non-2xx or unparsable body → `unknown` (row stays `pending`).
6. It never logs the URL or `html_body`.
7. Send happens **after commit**, in the background (not inside the user's request).
8. Tests (API level, fake `fetch`): body has exactly `type` + `payload`; each outcome maps to the right `email_status`; the call happens only after the transaction committed; an unknown `type` fails type-check.

## 5. Retries, sweeps and reminders (inside the API, version 1)

- On `unknown`, the row stays `email_status = 'pending'` and the helper retries up to 3 times with backoff.
- A **sweep** inside the API (a `setInterval` started in `api/src/server.ts`, never in `app.ts`, no new dependency) re-sends `pending` rows older than a few minutes, and sends the **day-before appointment reminder** with an idempotency key such as `appt:3:reminder`.
- Rows still `pending` 24 hours after `date_created` are marked `failed` (SPEC decision 14; no schema change).
- Caveat: a free host that sleeps when idle stops the sweep. On `localhost` it runs while the API runs. Production decides the host.
- Known risk: if the flow sent the email but the response timed out, a retry sends a **duplicate email**. PA cannot dedupe on `idempotency_key`. Accepted for version 1.
- Bulk sends: every notification has one recipient. If you ever mass-notify, batch ~50 recipients in BCC per call; inbox rows stay one per student.

## 6. Things to check in your tenant (I can't verify these from here)
1. **Trigger access.** The trigger must allow "Anyone" so the API (outside the tenant) can call it. The signed URL is the guard; keep it out of the client and Git. If it leaks, regenerate the URL (re-save the trigger) and update `.env`.
2. **Sender account.** Emails come from the flow owner's own mailbox (SPEC decision 15). The "Send an email (V2)" action uses whatever mail connection is signed in on the flow, so check in the flow's connections that it is the account you intend. Recipients see that name and address in `From`, and replies land in that mailbox. NU may filter or flag mail sent to students from a personal-looking sender; test with a real student address early.
3. **Flow owner.** Flows run as the account that owns them. If that student account loses its license or graduates, notifications stop. Use a service or office account, or co-own the flow with a staff account.
4. **Premium trial / license.** If the trial ends, HTTP triggers stop working: the API keeps saving and notifications stay `pending` (nothing is lost). Demo before it ends, or let the sweep re-send afterwards.
5. **Limits.** Premium has per-user daily request limits and per-flow throttles; check your plan's numbers before a bulk notice.
6. **Reachability in development.** Your API calls the trigger URL outbound from `localhost`, which just works. **No tunnel is needed**, because PA never calls into your API.

## 7. Why not let PA write to the database directly?
It is possible with the PostgreSQL connector, but I'd avoid it: there is no transaction across several tables, the escalation rule and the status gates would have to be re-implemented in flow actions, and Neon requires SSL/SNI settings that connectors have historically handled poorly. If you do use it, restrict it to a **read-only** role.

## 8. API endpoints for PA
```
POST /public/gate-reports      (web gate form → API; bot checks + rate limit; the API then triggers Flow 1)
```
That is the only PA-related route. Version 1 has **no** `/integrations/*` endpoints.

## 9. Growth path (parked, not in version 1)

Rule for all of these: the flow **schedules or sends**; the **API decides and writes**. A scheduled flow would have to call into the API, which needs a public API address and an authentication choice, so revisit the trust model (section 0) first.

### Worth doing first
1. **Scheduled "reminders & retry" flow** (Recurrence) — replaces the in-API sweep of section 5 if the host sleeps. Also: warn students 3 days before a sanction due date and on the day it becomes overdue; flag overdue sanctions to staff.
2. **Nightly backup export.** Neon's Free plan keeps only ~6 hours of restore history. Export CSV/Excel into SharePoint or OneDrive.
3. **Teams channel alerts for staff** (new gate report, proof uploaded, Major escalation). Add `channel: "teams"` to Flow 2's switch.
4. **Failure alerting.** Turn on run-failure notifications for every flow; daily check for `notifications` rows `pending` for more than an hour.

### Worth doing next
5. **Weekly digest to the SDO** (open cases, sanctions awaiting verification, overdue sanctions, appointments this week).
6. **Auto-generated documents** (violation slip, written warning, appointment notice, clearance certificate) from Word templates. Check each connector's license tier.
7. **Term rollover / student import** from the registrar's Excel list.
8. **Teams direct message to students** for urgent items.

### Later / only if needed
9. **Approvals** for decisions that need a second signature.
10. **Reporting dashboards** in Power BI over a read-only copy.

### Keep it maintainable
- Use a **Solution** (not loose flows) so you can export, import and version the flows; use **environment variables** for settings.
- Add a **co-owner** (a staff account) to every flow.
- Keep flows generic: one notify flow with parameters, not one flow per message. Put wording and rules in the API repo where they are tested and versioned.
- Set retry policies on every outgoing HTTP action; make every API endpoint idempotent.
- Watch your plan's daily request limits before adding high-volume flows.
