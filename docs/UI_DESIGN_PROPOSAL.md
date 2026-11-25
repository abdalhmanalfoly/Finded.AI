# FindIt AI – UI/UX Design Proposal (Phase 2)

Status: approved by owner. Language: English first, RTL/Arabic-ready.

## 1. Brand
- Name: FindIt AI. Tagline: Lost Something? Let AI Find It.
- Style: clean, modern, friendly, trustworthy.

## 2. Design tokens
| Token | Value | Use |
|-------|-------|-----|
| navy-900 | #0B1F3A | Headings, hero, footer, nav text |
| navy-700 | #12305A | Hover on navy surfaces |
| cyan-500 | #06B6D4 | Buttons, icons, highlights (never for body text on white) |
| cyan-600 | #0891B2 | Hover state |
| cyan-700 | #0E7490 | Links and text accents on white (passes AA) |
| cyan-50 | #E0F7FA | Search band, soft backgrounds |
| slate-600 | #475569 | Secondary text |
| slate-200 | #E2E8F0 | Borders |
| lost badge | bg #FEE2E2 / text #991B1B | Lost |
| found badge | bg #DCFCE7 / text #166534 | Found |
| success / warning / error | green / amber / red scale | Messages |

Contrast rules: navy text on cyan buttons; white text on navy; cyan-700 for links on white.

Typography: system sans-serif stack (later Inter, plus Noto Sans Arabic for Arabic). Scale: 12 / 14 / 16 / 20 / 24 / 32 / 40. Two weights: 400 and 500/600.
Spacing: 4px base grid (4, 8, 12, 16, 24, 32, 48, 64). Radius: 8px controls, 12px cards. Max content width 1152px.
Breakpoints: mobile < 640, tablet 640–1023, desktop ≥ 1024.

## 3. RTL readiness rules
- Use logical Tailwind classes (`ms-`, `me-`, `ps-`, `pe-`, `text-start`) instead of left/right.
- Direction set by `<html dir>` from a language context.
- Directional icons (arrows) flip with `rtl:rotate-180`.
- No text baked into images.
- All user-facing strings go through one `t()` function / strings file from the start.

## 4. Sitemap and routes
| # | Page | Route | Access |
|--:|------|-------|--------|
| 1 | Landing | `/` | Public |
| 2 | Login | `/login` | Public |
| 3 | Register | `/register` | Public |
| 4 | Lost Items | `/lost` | Public |
| 5 | Found Items | `/found` | Public |
| 6 | Report Lost | `/report/lost` | User |
| 7 | Report Found | `/report/found` | User |
| 8 | Item Details | `/items/:id` | Public (limited) |
| 9 | Matches | `/matches` | User |
| 10 | User Dashboard | `/dashboard` | User |
| 11 | Admin Dashboard | `/admin` | Admin |
Extra: Forgot password `/forgot-password`, Reset `/reset-password`, Profile `/profile`, 404.

## 5. Page layouts
**Landing:** navbar → hero (headline, two CTAs: "I lost something" / "I found something") → search band → How it works (4 steps) → Latest lost → Latest found → Benefits → CTA band → footer.
**Login/Register:** centered card, validation messages under fields, link between the two.
**Lost / Found Items:** page header + search; filters (category, color, date range, area, status); card grid 1/2/3-4 columns; pagination; filters in a bottom sheet on mobile.
**Report forms:** single column, grouped sections (Item, Where and when, Photos, Extra), image uploader with preview (max 3, 5 MB), privacy tip box, submit and cancel.
**Item details:** image gallery, title and status badge, info list, general location, "This could be yours? Request contact" panel, "Report this listing" link.
**Matches:** list of match cards: lost vs found side by side, score bar labeled "Similarity estimate", reasons list, buttons "Request contact" and "Not a match".
**User dashboard:** stat tiles (lost, found, active, potential matches, resolved), recent activity list, my reports table with edit/delete/status, notifications bell.
**Admin dashboard:** stat tiles, tabs (Reports, Flagged, Users, Complaints), tables with action menus.

## 6. Reusable components
Layout: Navbar, Footer, PageContainer, DashboardLayout, AdminLayout.
UI: Button (primary / secondary / ghost / danger), Input, Textarea, Select, DatePicker field, ImageUploader, Badge, StatusBadge, Card, StatTile, Modal/ConfirmDialog, Toast, Tabs, Pagination, Skeleton, Spinner.
Domain: ItemCard, ItemFilters, SearchBar, MatchCard, ScoreBar, NotificationBell, StepCard, EmptyState, ErrorState.

## 7. States
- Loading: skeleton cards and spinners on buttons.
- Empty: headline + one line + action button (e.g. "No lost items match your filters. Clear filters").
- Error: what happened and what to do, with Retry.
- Forms: inline errors, disabled-on-submit with spinner, success toast.

## 8. Accessibility
Focus rings visible, labels for all inputs, alt text for images, 44px minimum tap targets, keyboard-navigable menus, AA contrast.

## 9. Frontend structure
```
frontend/src/
  components/ui/   components/layout/   components/items/
  pages/           layouts/             routes/
  services/        (data access; sample-data now, Supabase later)
  data/            (clearly labeled SAMPLE data)
  hooks/           lib/    i18n/    styles/
```
Data and UI logic stay separate: pages call `services/*`, which return sample data until Phase 4/5.
