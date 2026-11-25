> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# FindIt AI – MVP Scope

## In the MVP
**Accounts:** register, login, logout, password reset, profile.

**Reports:** lost and found reports with all required fields, up to 3 images, edit, delete, status (Active / Matched / Resolved / Closed).

**Browse:** Lost and Found pages, keyword search, filters (category, color, date, area, status), pagination, item details with public info only.

**Matching (explainable, text-based):**
- Normalized text comparison of name and description.
- Category, color and brand comparison.
- Location proximity (text-based area/city match in MVP; coordinates only if captured).
- Date proximity.
- Weighted score from 0–100 with a list of reasons.
- Stored in the database, de-duplicated, refreshed on edits.

**Notifications:** in-app, with unread count.

**Contact:** request → accept/reject → simple text thread after acceptance.

**User dashboard:** counts and recent activity.

**Admin:** all reports, flagged reports, user management, complaints, basic statistics.

**Safety:** RLS, image validation, input validation, report/flag button.

## Out of MVP (future)
| Feature | Reason deferred |
|---------|-----------------|
| Image similarity (embeddings) | Needs a model/API, credentials and cost decisions; only add when available and tested |
| Semantic text embeddings | Start with simple, explainable scoring first |
| Map picker and distance search | Adds map provider dependency |
| Real-time chat | Request thread is enough to start |
| Email / push notifications | In-app first |
| Social login | Not essential |
| Multi-language (Arabic/RTL) | Plan for it, build later |
| Reward system, verification badges | Needs trust model |
| Mobile apps | Responsive web first |
| Institutions (airports, universities) accounts | Later business feature |

## MVP exit criteria
- A new user can register, report an item with a photo, and see it listed.
- A matching lost/found pair produces a stored match with reasons and a notification.
- Contact can be requested and approved without exposing contact details beforehand.
- A normal user cannot read or edit another user's private data or reach admin pages.
- Production build deploys and works end to end.
