> **Note:** this is the Phase 1 planning document. The implemented schema is in `DATABASE_SCHEMA.md` (for example, per-user dismissal is stored in `matches.dismissed_by`, and the matching threshold is 50).

# FindIt AI – Database Requirements

PostgreSQL via Supabase. All tables have `created_at`; mutable tables also have `updated_at`. All tables have RLS enabled.

## Entities
### profiles
1:1 with `auth.users`.
`id (uuid, PK, = auth.users.id)`, `display_name`, `avatar_url`, `city`, `role (user|admin)`, `is_suspended (bool)`, timestamps.

### items (single table for lost and found)
Using one table with `type` simplifies search and listing. (Alternative of two tables is noted in OPEN_DECISIONS.md.)
`id`, `user_id → profiles`, `type (lost|found)`, `name`, `category`, `description`, `location_text` (public, general area), `city`, `latitude/longitude (nullable)`, `event_date`, `event_time (nullable, approx.)`, `color`, `brand (nullable)`, `additional_details`, `status (active|matched|resolved|closed)`, `is_hidden (bool, admin moderation)`, timestamps.

### item_images
`id`, `item_id → items (cascade)`, `storage_path`, `position`, `created_at`.

### matches
`id`, `lost_item_id → items`, `found_item_id → items`, `score (0–100)`, `reasons (jsonb)`, `status (suggested|dismissed|contacted|confirmed)`, timestamps.
Constraints: `UNIQUE(lost_item_id, found_item_id)`; CHECK lost ≠ found; types enforced by trigger.

### notifications
`id`, `user_id → profiles`, `type (match|contact_request|contact_response|system)`, `title`, `body`, `related_match_id (nullable)`, `related_request_id (nullable)`, `is_read`, `created_at`.

### contact_requests
`id`, `match_id (nullable) → matches`, `item_id → items` (item being asked about), `requester_id → profiles`, `recipient_id → profiles`, `message`, `status (pending|accepted|rejected|cancelled)`, timestamps.
Constraint: one pending request per requester per item.

### messages
Only usable when the parent request is `accepted`.
`id`, `request_id → contact_requests`, `sender_id → profiles`, `body`, `created_at`.

### flags (suspicious reports / complaints)
`id`, `reporter_id → profiles`, `item_id (nullable)`, `reported_user_id (nullable)`, `reason`, `details`, `status (open|in_review|resolved|dismissed)`, `resolved_by (nullable)`, `resolution_note`, timestamps.

### admin_actions (P1 audit log)
`id`, `admin_id`, `action`, `target_type`, `target_id`, `note`, `created_at`.

## Relationships
```
profiles 1─* items 1─* item_images
items(lost) *─* items(found)  via matches
profiles 1─* notifications
profiles 1─* contact_requests (as requester / recipient)
contact_requests 1─* messages
profiles 1─* flags ; items 1─* flags
```

## Indexes (planned)
- items: (type, status, created_at desc), (category), (city), GIN trigram on name+description.
- matches: unique pair, (lost_item_id), (found_item_id).
- notifications: (user_id, is_read, created_at desc).

## Row Level Security summary
| Table | Read | Write |
|-------|------|-------|
| profiles | own row; public view exposes display_name/avatar only | own row (cannot change role/is_suspended) |
| items | public view of active, non-hidden items (safe columns); owner sees own full rows; admin all | owner insert/update/delete; admin moderate |
| item_images | follows item visibility | owner |
| matches | only owners of either item; admin | created by matching function only; owner may update status to dismissed |
| notifications | own | system creates; owner updates `is_read` |
| contact_requests | requester or recipient | requester creates; recipient updates status |
| messages | participants of accepted request | participants of accepted request |
| flags | admin; reporter sees own | any logged-in user creates; admin updates |

## Storage
Bucket `item-images`: private; signed URLs are issued only for images the caller can see through RLS on `item_images` (public reports, own reports, admins); write only inside `{user_id}/` folder, max 5 MB, JPG/PNG/WebP only.

## Privacy rules
- Email and phone are never stored in public tables. Email stays in `auth.users`.
- No fields for passwords, serial numbers or ID numbers. UI warns users not to enter them.
- Location is a general area (e.g. "Maadi, Cairo"), not an exact home address.
