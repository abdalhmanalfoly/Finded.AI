# FindIt AI – User Roles

## Roles
### Visitor (not logged in)
- View landing page, Lost and Found listings, item details (public fields only).
- Search and filter.
- Cannot report, see matches, or contact anyone.

### User (registered)
- Everything a visitor can do.
- Create, edit, delete own lost/found reports; change status of own reports.
- See matches for own reports; dismiss a match.
- Send, accept and reject contact requests; use the thread after acceptance.
- See own notifications and dashboard.
- Flag another user's report.
- Edit own profile.

### Admin
- Everything a user can do.
- View all reports (including hidden ones), hide or remove reports.
- Review flagged reports.
- Suspend or restore users.
- Handle complaints.
- View platform statistics.
- Cannot read passwords. Admin role is assigned manually in the database, never through the public UI.

## Permission matrix
| Action | Visitor | User | Admin |
|--------|:------:|:----:|:-----:|
| View public listings | ✔ | ✔ | ✔ |
| View public item details | ✔ | ✔ | ✔ |
| Create report | ✖ | ✔ | ✔ |
| Edit/delete own report | ✖ | ✔ | ✔ |
| Edit/delete others' reports | ✖ | ✖ | ✔ (moderation) |
| View own matches | ✖ | ✔ | ✔ |
| Send contact request | ✖ | ✔ | ✔ |
| See another user's private contact info | ✖ | Only if they chose to share it in an accepted thread | ✖ by default |
| Flag a report | ✖ | ✔ | ✔ |
| Manage users | ✖ | ✖ | ✔ |
| Handle complaints | ✖ | ✖ | ✔ |
| View platform stats | ✖ | ✖ | ✔ |

## Notes
- Suspended users can log in but cannot create reports or send requests (decision in OPEN_DECISIONS.md).
- Admin checks are enforced in the database (RLS), not only in the UI.
