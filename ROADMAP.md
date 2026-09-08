# Sathivo development roadmap

## Current status

The public homepage is in place, including the Indian cafe hero image. The owner enabled GitHub Pages from main at the repository root. A separate account preview and Supabase authentication integration have now been added. Public signup/sign-in remain closed pending email sender/template configuration and live acceptance testing. Discovery, companion profiles, bookings, payments, and moderation are not implemented yet.

## Confirmed product decisions

- India-wide, strictly platonic companionship for adults 18+ only. Sexual services, offers, escort services, and sexual activity are prohibited.
- Male and female companions; customers choose according to preference.
- Customers can browse without logging in; a booking request requires an account.
- In-person discovery: State or Union Territory -> selected important districts -> selected main cities/towns. Include every State/UT, not every village/locality.
- Use the same canonical location records for customers and companions. Companions may select nearby service cities.
- Online experiences do not require a city selection.
- Email address and password for normal login. Forgot password -> OTP to the verified account email -> verification -> new password.
- Companions set their own prices. Platform fees, pricing units, payments, cancellation rules, and payouts are not finalized.
- Preserve the premium rose/plum design, responsive layout, and existing working behavior. Inspect current repository files before each edit. Make changes directly in GitHub; the owner should not copy and paste code.

## Implementation order

| Stage | Deliverable | Completion check |
| --- | --- | --- |
| 1 | Backend project and authentication setup | Connected project, protected user records, verified email delivery setup, no secrets in frontend or GitHub |
| 2 | Signup, email verification, email/password login, logout, and OTP password recovery | Real test account completes signup, login, logout, reset; expired/wrong OTP and resend limits handled; old password fails after reset |
| 3 | Curated India location catalog | All current States/UTs and selected districts/cities sourced and checked; stable IDs; shared hierarchy and nearby service areas |
| 4 | Find a Companion page | In-person/online choice, location/activity/gender/language/budget filters; anonymous browsing; truthful empty states |
| 5 | Companion application and editable profile | Photo, bio, languages, experiences, rates, availability, home and service cities persisted |
| 6 | Administration and moderation | Proposed owner review before profile visibility; approval, rejection, suspension, reports, and access controls |
| 7 | Booking requests and account dashboards | Activity/date/time/duration, companion acceptance or rejection, status tracking, cancellation and completion |
| 8 | Booking communication and notifications | Proposed in-platform coordination with reporting/blocking and limited contact-data exposure |
| 9 | Monetization and payments | Owner chooses fee and payment/refund/payout rules; test transaction and failure handling before real payments |
| 10 | Launch preparation | Publish service/privacy/cancellation policies and support route; define verification; check privacy boundaries, real user flows, mobile layouts, and launch configuration |

Stages 6, 8, and the detailed commercial/operational rules are proposed plans to discuss with the owner, not settled policies. An 18+ statement or email OTP is not identity/age verification. Do not publish verification or other protection claims before they exist.

## First milestone: real account access

Supabase is now connected. The Sathivo project (`ujutlzjsgbqtlisecpnh`, `ap-south-1`) is active. GitHub remains the website source repository. Account screens, signup/email verification, password login, sign-out, and recovery OTP integration are implemented behind a closed-enrollment flag. Eighteen automated tests cover auth flow boundaries and SDK loading; live email delivery and end-to-end acceptance remain pending. See [account activation setup](docs/AUTH_SETUP.md) for exact progress and the remaining configuration.

Prepare email/password signup and recovery with verified email, a password-recovery OTP (not a normal login OTP substituted for recovery), expiry, resend/attempt limits, neutral error responses, and password-change confirmation. Keep privileged keys server-side. Protect account/profile records with server-enforced access rules.

Public email delivery requires an appropriate email provider and configuration; Supabase's built-in sender is for limited testing, not production delivery to all users. Domain/sender setup will be completed before public signup opens.

Official references:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/auth-smtp
