# Landing site

- **Status:** ready-for-agent
- **Area:** 11 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** `foundation`, `hardening`
- **Blocks:** nothing

## Problem Statement

`foundation` scaffolds `apps/landing` far enough to build and deploy, and it says nothing.
DeanPOS has a product, a deployment, and no way for anybody to find out it exists or to ask
for it.

The gap is specific rather than general. Self-serve signup is not in v1 (tenant provisioning
is admin-run), so the landing site is not a funnel into an application — it is the place
where an interested restaurant owner learns what DeanPOS does, sees what it costs, and
leaves their details. Without it, every prospective tenant arrives through a conversation
that has to start from nothing.

There is also a constraint that shapes the whole area: **DeanPOS has no email transport, by
decision.** A contact form that "sends an email" cannot exist. Whatever this site collects
has to land somewhere real and reach a human by some path that already exists.

## Solution

A small static marketing site on the root origin: what DeanPOS is, who it is for, what it
costs, and a form to join the waitlist.

Content lives in the repository, not a CMS — it changes at the speed of the product, and a
CMS for six pages is a service to run and secure for no benefit.

The waitlist form is the only unauthenticated write endpoint in the entire product, which
makes it the area's whole security story. Submissions are stored in PostgreSQL by
`apps/api`, rate-limited using `hardening`'s limiter, protected from bots without a captcha,
and announced to the Slack channel `observability` already configured — reusing an existing
path rather than introducing an email transport that was deliberately ruled out.

## User Stories

**Understanding the product**

1. As a restaurant owner, I want to understand what DeanPOS does within a few seconds of landing, so that I know whether to keep reading.
2. As a restaurant owner, I want to see that it is built for counter-service food businesses, so that I can tell whether it fits my shop.
3. As a restaurant owner, I want to see that it keeps selling when the internet drops, so that the thing I actually worry about is addressed early.
4. As a restaurant owner, I want to see how the menu structure handles the way I actually sell — an ulam with variations and sizes — so that I recognise my own business in it.
5. As a restaurant owner, I want to see what the terminal looks like, so that I can judge whether my staff could use it.
6. As a restaurant owner, I want to know it handles cash reconciliation, so that I understand it covers the end of the day and not just the sale.
7. As a restaurant owner, I want to know plainly what it does **not** do, so that I do not discover the gaps after committing.

**Pricing and next steps**

8. As a restaurant owner, I want to see pricing, so that I am not made to ask.
9. As a restaurant owner, I want to know what happens after I express interest, so that I am not left wondering.
10. As a restaurant owner, I want to join a waitlist with minimal effort, so that interest costs me nothing.
11. As a restaurant owner, I want confirmation that my submission was received, so that I do not submit it three times.
12. As a restaurant owner, I want to reach a human directly if I would rather not use a form, so that a serious enquiry is not blocked by a widget.
13. As the operator, I want each submission to reach me where I already look, so that a lead is not sitting unread in a database.
14. As the operator, I want submissions stored durably, so that a missed notification does not lose a lead.

**Trust and clarity**

15. As a restaurant owner, I want the site to say who is behind it, so that I know who I would be dealing with.
16. As a restaurant owner, I want to know how my data would be handled, so that I can judge whether to proceed.
17. As a restaurant owner, I want the site to not make claims about tax compliance, so that I am not misled about something that matters legally.

**Quality of the site itself**

18. As a restaurant owner on a phone, I want the site to be fast on a mediocre connection, so that I do not leave before it loads.
19. As a restaurant owner on a phone, I want it to be fully usable at phone width, so that reading it is not a chore.
20. As a visitor using a screen reader, I want the site to be navigable and readable, so that it is usable at all.
21. As a visitor, I want a shared link to show a sensible preview, so that a recommendation looks credible.
22. As the operator, I want the site to be findable by search, so that it can be found without being sent.
23. As the operator, I want content edits to be a code change, so that the site cannot drift out of sync with the product.

**Abuse resistance**

24. As the operator, I want the form protected from bot submissions, so that the waitlist is not noise.
25. As the operator, I want protection that does not require a visitor to solve a puzzle, so that a real owner is not deterred.
26. As the operator, I want a flood of submissions to be rate-limited, so that the form cannot be used to attack the API or my notification channel.

## Implementation Decisions

**Next.js, statically generated.** `apps/landing` keeps its own build (ADR-0001). Pages are
static; there is no per-request rendering, no session, and no authentication on this
application at all. It is served on the root origin.

**Content in the repository** as MDX or typed content modules — no CMS. A CMS for a handful
of pages is another service to run, secure, back up, and keep available; content changes
here are product changes and belong in the same diff.

**Pages.** Home, pricing, a "what it does not do" section carried from the plan's non-goals,
an about/contact page, and a privacy statement. Six pages at most. Any page that cannot
justify itself is not built.

**The non-goals are published deliberately.** No card processing, no accounting or
e-invoicing, no loyalty or promotions, no purchasing or inventory, no dine-in tables, no
printed receipts in v1. Publishing the limits filters out mismatched enquiries before they
cost a conversation, and prevents the worse outcome of a tenant discovering them after
committing.

**Nothing on this site claims tax compliance.** DeanPOS produces business reports, not
statutory ones (`reporting`). Any wording implying BIR compliance is a defect.

**The waitlist form** collects name, business name, contact (email or mobile), city, and an
optional message. It posts to a public procedure in `apps/api` — the **only** unauthenticated
write in DeanPOS — which stores the submission and posts a notification to the Slack webhook
`observability` already configured.

Storage is durable and primary; the notification is a convenience. A failed notification must
not fail the submission, and must be visible in logs.

**Bot protection without a captcha:** a honeypot field, a minimum time-to-submit, and
`hardening`'s rate limiter keyed on IP. No third-party captcha — it costs a real owner
friction and adds a third party to the one page whose job is to make a good impression.
**Deferred, trigger:** honeypot and rate limit demonstrably failing.

**Waitlist submissions are not Tenants.** They are a separate table outside tenant RLS, since
they belong to no tenant. Converting one into a Tenant is an admin action in
`tenancy-identity`, not something this area automates.

**Performance and quality budget.** Static output, no client-side framework work beyond the
form, images compressed and correctly sized, fonts self-hosted. Targets: usable on a slow
mobile connection, WCAG 2.2 AA, correct Open Graph and Twitter card metadata, `sitemap.xml`
and `robots.txt`, and per-page titles and descriptions.

**No analytics in v1.** **Deferred, trigger:** enough traffic that a decision depends on
knowing where it came from — at which point the choice must be a privacy-respecting one, and
it is a decision with a record, not a script pasted into a layout.

**Design.** `ORC2_DESIGN="lofi"`. Mocks are committed: `landing/home-{1440,390}` and
`landing/pricing-1440`. The screenshot slots in them are placeholders — real terminal
imagery is a separate task. The landing site may use `packages/ui` tokens for consistency,
but it is a marketing site and is not required to look like the product.

## Testing Decisions

**What makes a good test here.** This is a static site with one form. The form is worth real
tests; the pages are worth a smoke test and an accessibility check. Testing marketing copy is
testing a decision, not behaviour.

**Seam.** The in-process seam from `foundation` for the submission procedure. Page rendering
uses ordinary Vitest with happy-dom. **No new seam.**

**Through the seam.**

- A valid submission is stored, and the response confirms receipt.
- A submission with the honeypot filled is accepted by the response and **not** stored — a
  bot must not learn it was detected.
- A submission faster than the minimum time threshold is rejected.
- Exceeding the rate limit returns the limiter's response and does not store.
- A failing Slack notification does not fail the submission, and is logged.
- Input validation: a malformed contact is rejected; oversized fields are rejected;
  submissions are length-bounded.
- The procedure requires no authentication and reaches nothing else — asserted explicitly,
  since it is the only unauthenticated write in the product.
- It appears on `hardening`'s exemption list with a written reason, and the sweep's meta-test
  confirms the exemption is declared rather than absent.

**Page-level.**

- Every page renders and its critical content is present.
- Automated accessibility checks pass on every page; keyboard navigation reaches the form and
  submits it.
- Each page has a title, a description, and Open Graph metadata.
- `sitemap.xml` and `robots.txt` are generated and correct.
- The form is usable and legible at phone width.

**Deliberately not tested.** Copy, visual design, SEO ranking, and Lighthouse scores as a
gate — a performance budget is checked when the site is built, not asserted in the suite.

## Security Criteria

1. **The waitlist procedure is the only unauthenticated write in DeanPOS.** It is enumerated
   in the threat model, declared on `hardening`'s exemption list with a reason, and reaches
   nothing but its own table.
2. **It reads nothing.** No lookup, no existence check, no enumeration surface.
3. **Rate-limited by IP** through `hardening`'s limiter, with rejections logged and alertable.
4. **Honeypot detection is silent.** A caught bot receives the same response as a success.
5. **Every field is length-bounded and validated** at the contract boundary; the message field
   is stored as text and never rendered as HTML anywhere, including in the Slack notification.
6. **The Slack notification carries the submission's fields**, which is acceptable because the
   submitter volunteered them for contact — but it carries nothing else, and the webhook
   remains a secret.
7. **Submissions are personal data.** They are held outside tenant RLS, access is
   platform-admin only, they are covered by `hardening`'s export and deletion procedures, and
   they are deleted once converted or declined.
8. **The landing application has no authentication, no session, and no database access of its
   own.** It talks to `apps/api` and nothing else.
9. **Security headers and CSP** from `hardening` apply to this origin too. A marketing site is
   the most likely place for a third-party script to be added casually.
10. **No third-party scripts, tags, pixels, or fonts.** Self-hosted only.

## Out of Scope

- Self-serve signup, account creation, and billing. Not in v1 — the waitlist is the entry
  point.
- A CMS or any non-developer editing path. **Deferred, trigger:** somebody other than the
  developer needing to change copy weekly.
- Blog, changelog, documentation site, help centre.
- Analytics, heatmaps, session recording, A/B testing.
- Live chat and chatbots.
- Multi-language content. **Deferred, trigger:** a tenant segment that does not read English
  comfortably — plausible for this market and worth revisiting.
- Customer testimonials and case studies. There are no customers yet.
- Email capture sequences, newsletters, drip campaigns. No email transport exists.
- Interactive product demo or sandbox. **Deferred, trigger:** enough inbound interest that
  demos become the bottleneck.
- Formal privacy policy drafting as a legal document. The site states plainly how data is
  handled; a lawyer-drafted policy becomes necessary at self-serve signup, and that is
  recorded in `hardening`.

## Further Notes

- **This area is small and it is last for a reason.** It blocks nothing and nothing blocks on
  it. If time is short, it is the correct thing to cut — but only after saying so, since an
  undeclared cut becomes an argument later.
- **The form is the whole risk surface.** Everything else is static files. Treat the
  procedure with the seriousness of an authenticated endpoint, because it is reachable by
  everybody.
- **Publishing the non-goals is a feature.** The instinct will be to soften them. A tenant who
  discovers after onboarding that DeanPOS does not process cards is a much worse outcome than
  one who never enquired.
- **No third-party scripts.** A marketing page is where an analytics snippet or a font CDN
  gets added without thought, and `hardening`'s CSP will — correctly — break it.
- The site should show the terminal, because "does it work when the internet drops" and "can
  my staff use it" are the two questions that actually decide this purchase.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31 and ADR-0001.
Reuses the in-process seam and `hardening`'s rate limiter, and `observability`'s existing
Slack webhook in place of the email transport that was ruled out._
