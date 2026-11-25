> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# FindIt AI – Open Decisions

Items needing your input. Recommended defaults are marked ✅; I will proceed with them if you don't say otherwise.

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Target country/region and language | Egypt/Arabic+English, global English | ✅ English first; design layout so Arabic (RTL) can be added later |
| 2 | Lost and found in one table or two | One `items` table with `type` / two tables | ✅ **Decided: one table** |
| 3 | Email confirmation on sign-up | On / Off | ✅ On in production, Off during development |
| 4 | Image visibility | Public bucket / signed URLs | ✅ Private bucket + signed URLs (migration 008): decided in the third pass |
| 5 | Location input | Free text + city / map picker | ✅ Text + city in MVP; map later |
| 6 | Match threshold | 30 / 40 / 50 | ✅ **Decided: 50** (40 suggested false matches in tests) |
| 7 | Contact exchange after acceptance | Thread only / thread + share-contact button | ✅ Thread only; user may type contact details voluntarily |
| 8 | Suspended user behavior | Block login / block writing only | ✅ Block writing only |
| 9 | Image AI | Skip in MVP / use hosted embeddings (e.g. CLIP via API) | ✅ Skip in MVP; decide in Phase 6 if you have an API key and budget |
| 10 | Item retention | Auto-close after N days / keep forever | ✅ Auto-suggest closing after 90 days of inactivity |
| 11 | Hand-in point for found items | Not included / optional text field | ✅ Optional field |
| 12 | Branding assets | Logo needed | I will propose a simple text/icon logo in Phase 2 |
| 13 | Project name/domain | Domain name for production | Needed by Phase 9 |

## Assumptions made
- Team size: one developer plus Claude; free tiers are sufficient for MVP.
- No payment processing.
- Admin accounts are created manually.

## Decisions taken while building (review these)
- English first; Arabic/RTL not translated yet.
- Matching threshold is 50, with brand-mismatch and found-before-lost penalties.
- Email confirmation: on in production, optional locally.
- Images are private. Each photo is shown through a signed URL that expires after 1 hour; hiding or closing a report stops new URLs being issued, but a URL already handed out keeps working until it expires.
- Suspended users can browse but not write.
- Found reports have no brand field (as specified).
