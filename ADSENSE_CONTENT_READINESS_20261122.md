# Sathivo public quality and AdSense readiness — 22 November 2026

## Why this exists

The AdSense site page reports **Needs attention → Low value content**, while site ownership verification is successful. A low-value-content rejection is not the same as an indexing error or evidence that every page violates a policy. This report describes actual quality steps without representing a review or approval as completed.

## Observed baseline (read-only database aggregate, 22 November 2026)

- 138 published listings with active moderation status.
- 42 of those bios were fewer than 60 characters.
- 11 lacked an interest or language field.
- 4 matched broad potentially risky wording/contact patterns that require context-aware human review. A flag is **not** proof of misconduct. Some results may overlap.
- All 138 had recorded photo paths; none were missing both city name and location ID, hourly rate, or a category according to the checks used.

All these counts may change as members edit, publish, hide and update profiles. A 60-character threshold is a quality-review heuristic, **not** a new publication rule. There are no automated profile suspensions, deletions, rating changes or edits in this update.

## Changes in this branch

- Admin-only **Companion Listings → Quality review** summary and filter. Counts are computed from already authorized admin listing data; no new public data endpoint or RLS changes.
- Advisory flags for short bios, missing useful fields, possible direct contact promotion, potentially prohibited services and repeated text. The owner must read context before taking any existing moderation action.
- Companion profile publishing checklist: truthful activities, meeting preferences, languages, privacy protection, and current availability.
- Explore directory explanation: an illustrative profile example and what visitors should check before arranging paid platonic activities.
- Regression tests for the review logic and dashboard safety invariants.

## Google publisher-policy risk (independent of content quality)

Google Publisher Policies treat compensated sexual acts as prohibited content and give **“companionship and escort services”** as examples of content that may be interpreted as promotion of compensated sexual acts. Sathivo's stated strictly platonic rules do not guarantee that Google's reviewer will consider an in-person paid companionship marketplace eligible. See: https://support.google.com/publisherpolicies/answer/10438120

Do not remove accurate fee disclosures, conceal the real business model, fake testimonials, or promise identity verification. No AdSense resubmission is made by this change.

## Human verification before requesting another review

1. On desktop and mobile, browse Explore while logged out, filter by state/district, open a public profile, paginate, retry after a connection failure, and verify no console errors.
2. In the authorized Admin Panel, use **Companions → Needs human review**, inspect flagged descriptions in context, and only suspend a listing after determining that it actually breaches site rules. Do not remove genuine accounts for being short or incomplete alone.
3. Confirm public navigation and internal links across Home, Guides, About, Privacy, Terms, Safety, Contact, Feedback and Booking Guide. Test real support/contact form submission with a controlled test account.
4. Confirm that publishing and hiding a companion profile updates Explore without exposing private member email or profile fields. Test one genuine account only with consent; do not create fake listings.
5. Check the live sitemap and Search Console indexing reports after Google has reprocessed the new pages. “Sitemap: Success” does not guarantee indexing.
6. Review the actual AdSense eligibility risk from compensated companionship before submitting the “I confirm I have fixed the issues” checkbox. Google can still decline the site.

## What is not verified here

- Google AdSense approval; a Google review is external.
- A full logged-in browser test of the live site, payment transactions or delivery of support emails.
- Identity verification of members, truth of self-described bios, or whether any individual bio definitively violates policy.
- Search indexing of dynamically generated profile cards. Explore's live cards are rendered from Supabase by browser JavaScript, so crawlability should not be assumed.

## Privacy and data preservation

The admin review analyzes public listing fields already available in the admin session. No new public API or credential, database migration, service-role key, automatic removal, background job, external export, or mass edit is introduced.
