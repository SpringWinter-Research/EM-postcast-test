# Emerging Talks Podcast Matcher
## Business requirements for the first release

**Basis** BRD v1.2 and the business owner's scope decisions  
**Status** Draft for review  
**Platform** Responsive web application for the initial India launch

### 1. Purpose

Help podcast hosts and guests find suitable collaborators. Use approved profiles to rank recommendations. Let users send a request, accept it, and exchange messages. An administrator confirms completed interviews.

The platform is free. P0 excludes payments, subscriptions, bookings, calendar integration, rescheduling, and episode tracking. P0 has no North Star metric.

### 2. Accounts and profiles

| ID | Requirement |
|---|---|
| P0-01 | Let anyone register with an email address and password. Verify the email address. Support sign-in, sign-out, password reset, and account deletion requests. Use email verification for basic account identity. |
| P0-02 | Let a user act as a host, a guest, or both under one account. Keep the host and guest profiles separate. Let a host manage more than one podcast. |
| P0-03 | Let users save draft profiles. Show which required fields are missing before submission. A profile or podcast listing can go live only when it is complete and an administrator approves it. |
| P0-04 | Let users edit their profiles. Keep edits in a draft until an administrator approves them. Use the approved version in discovery. Let users hide their profiles or podcast listings. |

**Proposed minimum fields for launch**

| Profile | Required fields |
|---|---|
| Host | Display name and short biography. |
| Podcast | Show name, description, category, interview topics, language, interview format, guest acceptance status, and a public show link. |
| Guest | Display name, short biography, expertise, discussion topics, language, and preferred interview format. |

Previous appearances, audience figures, and websites are optional. Show audience figures as user-provided when a user supplies them.

### 3. Discovery and matching

| ID | Requirement |
|---|---|
| P0-05 | Let signed-in users search approved, visible podcast and guest profiles by keyword. Search names, descriptions, topics, and expertise where applicable. |
| P0-06 | Use defined rules to rank podcasts for guests and guests for a specific podcast. Use approved profile information. Show a score from 0 to 100 and the main reasons for each recommendation. |
| P0-07 | Exclude blocked users, suspended accounts, and hidden or unapproved profiles from recommendations. Exclude podcasts that do not accept guests from guest recommendations. Recalculate affected recommendations when approved profile data changes. |

Use topic fit, language, and interview format as the starting inputs. Define the rules, weights, and examples before implementation. Missing optional audience data must not lower the score.

### 4. Requests and messages

A request is either a guest application to a podcast or a host invitation to a guest.

| ID | Requirement |
|---|---|
| P0-08 | Let a guest apply to a specific podcast with a short pitch. Let a host invite a guest on behalf of a specific podcast that the host manages. Show the podcast name and link on the invitation before the guest responds. |
| P0-09 | Let the recipient accept or decline a pending request. Let the sender withdraw a pending request. Allow one pending request per podcast and guest pair, across both directions. |
| P0-10 | Record the planned interview start time and time zone when the sender submits a request. A pending request expires at that time. The system must prevent acceptance at or after that time, even if the request screen is still open. An accepted request stays accepted. |
| P0-11 | Keep the podcast, guest, submitted pitch or invitation, and start time fixed after submission. Later profile edits apply to future requests. Participants arrange the interview outside the platform. |
| P0-12 | Open a private message thread only after the recipient accepts the request. Store messages and show unread messages. Use text messages for P0. Notify the recipient about new requests, request decisions, and new messages. Use in-app notifications and email. |
| P0-13 | Let users block users and report profiles or messages. Stop new requests and messages between blocked users. Apply rate limits to requests and messages. |

Request status changes from **Pending** to **Accepted**, **Declined**, **Withdrawn**, or **Expired**. These are final request states. Interview completion is a separate record.

### 5. Administration

| ID | Requirement |
|---|---|
| P0-14 | Provide a simple dashboard with a profile and podcast approval queue, a report queue, account status controls, and a list of accepted requests. Let an administrator approve a submission or return it for edits. |
| P0-15 | Let an administrator confirm that an interview linked to an accepted request took place. Keep one confirmation per request. Record the administrator and confirmation time. Show the result to both participants. |
| P0-16 | Log approval, suspension, reactivation, and interview confirmation actions. Restrict dashboard access to authorised administrators. Let administrators review reported content. |

### 6. Launch acceptance

1. A new user can verify an email address, create a profile, and submit it. The system keeps incomplete and unapproved profiles out of discovery.
2. A host with two approved podcasts can invite a guest on behalf of one podcast. The guest can identify the correct show before accepting.
3. A signed-in user can find approved profiles by keyword and see ranked recommendations with reasons. A blocked user does not appear in the other user's recommendations.
4. Only the recipient can accept a pending request. Concurrent requests for the same podcast and guest cannot create two pending requests. A pending request cannot be accepted at or after its start time.
5. The message thread opens after acceptance. An unrelated account cannot read it. Profile edits do not change the submitted request details.
6. Only an authorised administrator can confirm that an interview took place. A repeated confirmation does not create a second record.
7. The main workflows work on desktop and mobile browsers. The system enforces access on the server. Before launch, the team verifies a backup restore and checks error logging and notification delivery.

### 7. Draft assumptions and open decisions

- Registration is open. Publication requires approval. Emerging Talks can still recruit and review the initial cohort directly.
- The start time is a request deadline. It does not reserve a calendar slot or create a booking. The sender supplies the time when submitting the request.
- The draft treats submitted request details as fixed from submission. Users can update their profiles through the approval process.
- Confirm the minimum profile fields, scoring rules, evidence that administrators need to confirm interviews, and data retention rules before implementation.
