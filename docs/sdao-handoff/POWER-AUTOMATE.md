# Power Automate (Premium) — integration design

Your stack (from the repo): **Express 5 + TypeScript API**, **Prisma 7 on Neon**, React 19 + Vite SPA, passport-local + express-session + connect-pg-simple, bcryptjs, helmet, express-rate-limit. Power Automate (PA) Premium adds the HTTP trigger/action and sends mail through the NU Microsoft 365 tenant.

## 1. Principle: the API is the only writer to the database

PA never writes to Postgres directly. It calls the Express API. Reasons:
- All rules (escalation, status checks, the "open every file before verify" gate, overlap checks, idempotency) live in one tested place. PA can't run a database transaction.
- No database credentials in PA. A leaked flow can't read or delete the data.
- Neon scales to zero; the API deals with cold starts and retries once instead of every flow.

## 2. Ordering: commit first, notify second

Your sketch was **Admin input → PA → notify student → process database**. I recommend swapping the last two:

```
Admin action in the web app
  → API validates + writes to the DB (one transaction) incl. a `notifications` row (email_status = 'pending')
  → API calls Flow 2 (HTTP trigger) with the notification
  → Flow 2 emails / Teams-messages the student
  → Flow 2 calls the API back: "sent" or "failed"
```
Why: if you notify first and the database write then fails, the student is told about something that never happened, and PA cannot roll the email back. With commit-first, the worst case is "saved but not yet emailed", which the `pending` status exposes and a retry fixes. The `idempotency_key` on `notifications` makes retries safe.

## 3. The two flows

### Flow 1 — "SDO Gate Report Submitted" (form submission → notifications)
The **web gate form stays** in your app. It posts to your API, not to Power Automate (a Power Automate trigger URL put in browser code would be public and spammable).

```
Visitor submits the web gate form
  → POST /public/gate-reports on your API   (captcha + rate limit + validation)
  → API inserts one disciplinary_cases row per violation (source='gate', shared submission_ref) + timeline + notification rows (one transaction)
  → API calls Flow 1 (HTTP trigger) with the submission
  → Flow 1 sends: (a) "report received" email to the student (if the ID matched a student), (b) alert to the SDO mailbox / Teams channel
  → Flow 1 calls the API back with sent / failed per message
```
| Step | Action | Notes |
|---|---|---|
| 1 | Trigger: **When an HTTP request is received** | respond `202` right away |
| 2 | Condition: `x-api-key` header = secret | reject otherwise |
| 3 | **Condition**: `student_matched` | yes → email the student; no → skip (staff alert says "ID not on file") |
| 4 | **Send an email (V2)** to the student | reference number, violations listed, "waiting for staff review" |
| 5 | **Send an email / Post in Teams** to staff | link to the case in the staff app |
| 6 | **HTTP callback** to the API | `{ "status": "sent" | "failed" }` per recipient; wrap steps 4–5 in a Scope for failure handling |

Payload:
```json
{
  "reference": "3f0c2c1e-8a47-4b8e-9d59-1f2a6b7c9d10",   // submission_ref (uuid) of the form submit
  "student_matched": true,
  "student_email": "student@students.nu-fairview.edu.ph",
  "student_name": "Darlwyn Jee Daguman",
  "violations": ["Improper Uniform", "No ID"],
  "submitted_at": "2026-10-11T08:00:00Z",
  "case_url": "https://app.example.edu/staff/cases/17",
  "callback_url": "https://api.example.edu/integrations/notifications/result"
}
```
Because the API commits first, a submission is never lost if Power Automate is down; the notifications simply stay `pending` and are retried.

Public endpoint hardening (`POST /public/gate-reports`): Cloudflare Turnstile (or hCaptcha) token verified server-side, `express-rate-limit` per IP, `express-validator` for fields, body-size limit, the duplicate rule (same typed student ID + violation + Manila day, enforced by a unique index), and generic error messages.

> Flow 1 and Flow 2 do almost the same job (send a message, report back). You can keep both as requested: Flow 1 = form submissions, Flow 2 = every admin-triggered notification. If you ever want to cut maintenance, Flow 1 can simply become a call to Flow 2.

### Flow 2 — "SDO Notify (dynamic)" (one flow, takes parameters)
Trigger: **When an HTTP request is received** (Premium). Method POST. Immediately respond `202 Accepted` with a **Response** action so the API never waits for the email.

Request schema (the API pre-renders the text, so email wording lives in your repo and is versioned):
```json
{
  "notification_id": 123,
  "idempotency_key": "san:12:completed",
  "channel": "email",                      
  "to": "student@students.nu-fairview.edu.ph",
  "cc": [],
  "subject": "Sanction S-12 verified",
  "html_body": "<p>Hi Jee, your sanction was verified…</p>",
  "kind": "sanction",
  "link_url": "https://app.example.edu/sanctions/12",
  "callback_url": "https://api.example.edu/integrations/notifications/123/result"
}
```
Steps:
1. **Condition**: header `x-api-key` equals the secret (anyone with the trigger URL could otherwise send mail as the SDO).
2. **Response 202**.
3. **Switch on `channel`**: `email` → **Send an email from a shared mailbox (V2)** (SDO mailbox); `teams` (optional later) → **Post message in a chat/channel**.
4. **Scope (try/catch)**: on success → **HTTP POST callback** `{ "status": "sent" }`; on failure (Configure run after: failed/timed out) → callback `{ "status": "failed", "error": "<message>" }`.

API side: `POST /integrations/notifications/:id/result` (same shared secret) sets `email_status` and `date_email_sent`.

Why this is "dynamic": the **same** flow handles every notification kind (case validated, sanction assigned, appointment moved, clearance change, password reset…). Only the parameters change. You do not need a flow per message type.

## 4. How the API triggers Flow 2
- Store the Flow 2 URL as `PA_NOTIFY_URL` (it contains a signature, so treat it like a password; never put it under a `VITE_` key).
- After the DB commit, `POST` the notification JSON to `PA_NOTIFY_URL`. If PA answers non-2xx or times out, leave `email_status = 'pending'` and retry (3 attempts with backoff).
- Rows still `pending` after that are picked up by a retry sweep. If your host sleeps when idle (free tiers), add a tiny optional **Flow 3: Recurrence (every 10 min) → POST `/integrations/notifications/retry-pending`**.
- **Bulk sends:** there is no announcement feature, so every notification has one recipient. If you ever mass-notify (for example a term-start reminder), batch ~50 recipients in BCC per Flow 2 call; inbox rows stay one per student.

## 5. Things to check in your tenant (I can't verify these from here)
1. **Trigger access.** You tested the trigger with curl from outside the tenant ("anyone"), so the API can call it. Because anyone with the URL can fire it, the `x-api-key` check (step 1 of each flow) is the real guard; keep the URL out of the client and Git.
2. **Shared mailbox.** Ask NU IT for an SDO shared mailbox and make sure the flow owner has "send as". This also settles the email-sender decision (6.3 in the spec): you send from NU's own domain.
3. **Flow owner.** Flows run as the account that owns them. If that student account loses its license or graduates, notifications stop. Use a service or office account, or co-own the flow with a staff account.
4. **Premium trial / license.** If the trial ends, HTTP triggers stop working: the API keeps saving and notifications stay `pending` (nothing is lost). Demo before it ends, or re-send pending rows afterwards via the retry endpoint.
5. **Limits.** Premium has per-user daily request limits and per-flow throttles; check your plan's numbers before a bulk notice.
6. **Reachability in development.** Your API calling Flow 2's HTTP trigger works fine from `localhost` (outbound request to a public URL). A tunnel (Dev Tunnels / ngrok / cloudflared) is only needed where PA must call **into** your API: Flow 2's result callback and Flow 1. While developing you can skip the callback (email still sends; `email_status` stays `pending`), and test Flow 1's endpoint by sending the same JSON with curl. Production needs a public HTTPS API address either way.

## 6. Why not let PA write to the database directly?
It is possible with the PostgreSQL connector, but I'd avoid it: there is no transaction across several tables, the escalation rule and the status gates would have to be re-implemented in flow actions, and Neon requires SSL/SNI settings that connectors have historically handled poorly. If you do use it, restrict it to a **read-only** role.

## 7. API endpoints added for PA
```
POST /public/gate-reports                             (web gate form → API; captcha + rate limit; the API then triggers Flow 1)
POST /integrations/notifications/:id/result           (Flow 2 → API, x-api-key)
POST /integrations/notifications/result               (Flow 1 → API, x-api-key; body lists results)
POST /integrations/notifications/retry-pending        (optional Flow 3, x-api-key)
```
These sit outside the session/passport login. Protect them with `PA_SHARED_SECRET` (env, not `VITE_`), rate limiting (already in your dependencies), and body-size limits. Rotate the secret by updating the env var and the two flows together.

## 8. Growth path — what else Power Automate can do for this system

Rule for all of these: the flow **schedules or sends**; the **API decides and writes**. A scheduled flow calls an API endpoint; the API creates idempotent notifications and triggers Flow 2.

### Worth doing first (high value, low effort)
1. **One scheduled "reminders & retry" flow** (Recurrence, e.g. every 30 min or hourly) → `POST /integrations/run-reminders`. The API then, with idempotency keys so nothing repeats: retries `pending` notifications, sends the **appointment reminder** the day before a window opens, warns students **3 days before a sanction due date** and on the day it becomes overdue, and flags **overdue sanctions** to staff. This replaces the optional retry flow and the "7:00 AM reminder" the prototype faked.
2. **Nightly backup export.** Neon's Free plan keeps only ~6 hours of restore history. A scheduled flow calls an API export endpoint (or runs read-only queries) and saves CSV/Excel into SharePoint or OneDrive. Cheap insurance for discipline records.
3. **Teams channel alerts for staff** (new gate report, proof uploaded, Major escalation) with a deep link to the case. Teams reaches staff faster than an email inbox. Add `channel: "teams"` to Flow 2's switch.
4. **Failure alerting.** Turn on run-failure notifications for every flow, and add a daily check: if `notifications` has rows `pending` for more than an hour, email the owner.

### Worth doing next
5. **Weekly digest to the SDO**: open cases older than N days, sanctions waiting for verification, overdue sanctions, appointments this week. Scheduled flow → API summary endpoint → HTML email.
6. **Auto-generated documents.** Fill a Word template (violation slip, written warning, appointment notice, clearance certificate) with case data, save the PDF to SharePoint, and attach it to the email. Fits S001 and S002 ("issued by the SDO") exactly. Check each connector's license tier before committing.
7. **Term rollover / student import.** The registrar's Excel list (SharePoint) → flow → `POST /integrations/students/import`, which creates or updates accounts, sets temp passwords with `must_change_password`, and opens the new term's clearances. This removes manual account entry.
8. **Teams direct message to students** as a second channel for urgent items (sanction returned, appointment tomorrow).

### Later / only if needed
9. **Approvals**: a Teams or email approval for decisions that need a second signature (for example a Major sanction). The flow records the decision through the API.
10. **Reporting dashboards** in Power BI over a read-only copy of the data.

### Keep it maintainable
- Use a **Solution** (not loose flows) so you can export, import and version the flows, and use **environment variables** for the API base URL and secrets, so you don't edit each flow when the URL changes.
- Add a **co-owner** (a staff account) to every flow.
- Keep flows generic: one notify flow with parameters, not one flow per message. Put wording and rules in the API repo where they are tested and versioned.
- Always return `202` quickly and use callbacks; set retry policies on every outgoing HTTP action; make every API endpoint idempotent.
- Watch your plan's daily request limits before adding high-volume flows (bulk notices, frequent recurrences). Prefer batching and an hourly cadence over every-minute polling.
