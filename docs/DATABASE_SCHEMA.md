> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# Database Schema

The application schema is defined by migrations 001–005.

| Table | Purpose |
|---|---|
| `profiles` | User display/profile data and role/suspension state |
| `items` | Lost/found reports and lifecycle state |
| `item_images` | Image metadata and Storage paths |
| `matches` | Candidate lost/found pairs, scores and explanations |
| `contact_requests` | Contact request lifecycle |
| `messages` | Messages within accepted contact threads |
| `notifications` | In-app user notifications |
| `flags` | User-submitted listing reports |
| `admin_actions` | Administrative audit records |

Migration 002 defines RLS and the restricted `public_items` view. Migration 003 defines contact and admin RPCs. Migration 004 defines matching. Migration 005 removes direct authenticated updates to `profiles.is_suspended`.

For exact columns, constraints, indexes, and functions, the SQL migrations are the source of truth; this summary does not replace them.
