# Emerging Talks Podcast Matcher
## Business requirements for future releases

**Basis** BRD v1.2 and the business owner's scope decisions  
**Status** Proposed scope. Each workstream needs separate approval.  
**Baseline** The P0 BRD defines the free launch. This document does not set release dates.

### 1. Interview operations

| ID | Proposed capability | Decision before approval |
|---|---|---|
| FUT-01 | Create a booking from an eligible accepted request. Record the agreed time, time zone, recording link, and confirmation. Support reminders and cancellations. | Define who can confirm or cancel, how to handle no-shows, and whether one request can produce more than one booking. |
| FUT-02 | Connect supported calendars or provide an event export. | Define whether users need an export, calendar event creation, or availability sync. Validate provider access. |
| FUT-03 | Track recorded interviews and published episodes. Let the host submit the publication date and link. Show the result in the guest's appearance history. Let the guest report an error. | Define who can correct a record and what evidence supports publication. Keep a separate profile section for previous appearances that users add themselves. |
| FUT-04 | Let each participant review an eligible completed interview once. Support reporting and moderation of reviews. | Define review eligibility, publication rules, and dispute handling. Use the interview confirmation record as the basis for eligibility. |

Use the accepted request as the source for the booking. Keep booking and episode records separate. Keep the agreed details fixed during the interview. Rescheduling is outside the proposed scope. Any later change to that rule requires a new decision.

### 2. Trust, discovery, and reporting

| ID | Proposed capability | Decision before approval |
|---|---|---|
| FUT-05 | Add formal profile and podcast ownership verification. Record evidence and show the verification status. | Define the proof to accept, who reviews it, who can access it, and when to remove a verification status. |
| FUT-06 | Add advanced filters, sorts, favourites, shortlists, saved searches, and richer profile and media kit tools. | Select the features that solve observed discovery problems. Define which media users can upload, generate, or share. |
| FUT-07 | Add richer messaging and notification controls. Consider attachments, mute controls, and delivery status. Keep messaging limited to accepted requests. | Define attachment access, moderation, and delivery requirements. |
| FUT-08 | Add moderation tools and separate administrator permissions as the workload grows. | Define moderation duties, access to private information, and audit requirements. |
| FUT-09 | Add user and business reporting for discovery, requests, confirmed interviews, and publication. | Define each event, the evidence it needs, and who can see the data. Decide later whether the platform needs a North Star metric. |
| FUT-10 | Consider AI support for matching, pitch drafts, interview topics, and media kit drafts. | Measure improvement against the rules-based baseline. Keep drafts editable. Label claims that lack verification. |

### 3. Commercial options

The platform is free under the current plan. Payments and subscriptions require a separate business decision before they enter any release.

| ID | Proposed capability | Decision before approval |
|---|---|---|
| FUT-11 | Evaluate subscriptions, one-off services, per-booking fees, and clearly labelled paid placement. Keep paid placement separate from organic match scores. | Approve the model, buyer, price, and access rules. Define refunds, cancellations, and expiry. |
| FUT-12 | If Emerging Talks approves payments, integrate a selected payment service provider. Verify payment events on the server. Keep transaction records and access rules in the platform. | Select the provider and methods. Define account linking, duplicate-event handling, reconciliation, and the effect of refunds or failed renewals on access. |

### 4. Expansion options

- **FUT-13** Evaluate agency accounts with explicit permission to manage client profiles and requests.
- **FUT-14** Evaluate native mobile apps and expansion to more markets.
- **FUT-15** Evaluate podcast catalogue imports, audience data integrations, and podcast network partnerships. Validate provider access and data quality before committing.
- **FUT-16** Evaluate recording, conferencing, editing, distribution, and guest payouts as separate proposals.

### 5. Release approval

For each future workstream, approve its scope, dependencies, business owner, and acceptance tests before scheduling development. Add new account, role, or data requirements only when an approved workstream needs them.
