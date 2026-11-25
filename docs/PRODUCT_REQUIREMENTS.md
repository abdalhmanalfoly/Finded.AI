# FindIt AI – Product Requirements

Priority: **P0** = MVP must have, **P1** = MVP nice to have, **P2** = future.

## 1. Accounts
| ID | Requirement | Priority |
|----|-------------|----------|
| A1 | Register with email + password | P0 |
| A2 | Log in / log out | P0 |
| A3 | Password reset by email | P0 |
| A4 | Edit profile (display name, avatar optional, general area) | P0 |
| A5 | Social login (Google) | P2 |
| A6 | Delete account and data | P1 |

## 2. Reporting
| ID | Requirement | Priority |
|----|-------------|----------|
| R1 | Create lost report: name, category, description, last known location, date lost, approx. time, color, brand (optional), image(s), extra details | P0 |
| R2 | Create found report: name, category, description, found location, date found, approx. time, color, image(s), extra details | P0 |
| R3 | Upload 1–3 images (JPG/PNG/WebP, max 5 MB each) | P0 |
| R4 | Edit and delete own reports | P0 |
| R5 | Status: Active, Matched, Resolved, Closed | P0 |
| R6 | Field validation with clear errors | P0 |
| R7 | Map pin picker for location | P2 |
| R8 | Found-item "hand-in point" (e.g. police, shop) field | P1 |

## 3. Browse and search
| ID | Requirement | Priority |
|----|-------------|----------|
| S1 | Lost Items page and Found Items page, paginated | P0 |
| S2 | Keyword search | P0 |
| S3 | Filters: category, color, date range, city/area, status | P0 |
| S4 | Item details page with public information only | P0 |
| S5 | Sort by newest | P0 |
| S6 | Distance-based search | P2 |

## 4. Matching
| ID | Requirement | Priority |
|----|-------------|----------|
| M1 | Text/attribute matching (name, category, description, color, brand, location, date) with weighted score | P0 |
| M2 | Store matches, no duplicates, never match a report with itself | P0 |
| M3 | Exclude Resolved/Closed reports | P0 |
| M4 | Re-run matching when a report is edited | P0 |
| M5 | Human-readable reasons for each match | P0 |
| M6 | User can mark a suggestion "Not a match" (dismiss) | P1 |
| M7 | Image similarity | P2 |

## 5. Notifications and contact
| ID | Requirement | Priority |
|----|-------------|----------|
| N1 | In-app notification for new potential match | P0 |
| N2 | In-app notification for contact request and its response | P0 |
| N3 | Read/unread state and unread count | P0 |
| N4 | Email notifications | P1 |
| C1 | Contact request with short message; recipient accepts or rejects | P0 |
| C2 | After acceptance, a simple per-request message thread (text only) | P0 |
| C3 | Private contact details never shown unless user chooses to share inside an accepted thread | P0 |
| C4 | Real-time chat | P2 |

## 6. User dashboard
Totals for lost reports, found reports, active reports, potential matches, resolved reports, and recent activity. **P0**

## 7. Admin
| ID | Requirement | Priority |
|----|-------------|----------|
| AD1 | View all reports, hide/remove a report | P0 |
| AD2 | Review user-flagged (suspicious) reports | P0 |
| AD3 | Manage users: view, suspend, restore | P0 |
| AD4 | Handle complaints (open, in review, resolved) | P0 |
| AD5 | Platform statistics (users, reports, matches, resolution rate) | P0 |
| AD6 | Audit log of admin actions | P1 |

## 8. Non-functional requirements
- Responsive: desktop, tablet, mobile.
- Page load under 3 s on a normal connection for list pages.
- WCAG AA colour contrast.
- All secrets in environment variables.
- Row Level Security on every table.
- English first; structure should allow adding Arabic/RTL later (P2).
