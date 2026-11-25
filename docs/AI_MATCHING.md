> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# How FindIt AI matching works

**Important:** the score is a **similarity estimate**, not proof that two items are the same object. The app says so wherever a score is shown.

## Approach
An explainable, rule-based scorer written in PostgreSQL (`supabase/migrations/004_matching.sql`). It is "AI-assisted" in the sense of fuzzy text similarity (trigram similarity from `pg_trgm` plus word overlap), **not** a machine-learning model. No image AI is implemented.

## When it runs
A database trigger runs the engine whenever a report is created, or one of its matching-relevant fields, its status, or its visibility changes. It compares that report with every **active/matched, visible** report of the opposite type that belongs to a **different user**.

## Scoring
Text is lower-cased, punctuation removed, common words ignored. Text similarity = the better of trigram similarity and word-overlap (Jaccard).

| Signal | Points | Rule |
|--------|-------:|------|
| Item name | 25 | 25 × text similarity |
| Category | 15 | full points if equal |
| Description | 15 | 15 × text similarity |
| Color | 10 | full points if equal |
| Brand | 10 | counted **only when both reports give a brand**; equal (or one contains the other) = full points |
| Location | 15 | 7 if same city + 8 × similarity of the area text |
| Date | 10 | found 0 days after lost = 10, falling to 0 at 30 days |

Score = points earned ÷ points possible × 100, then:
- **Different brand** (both given): × 0.75.
- **Found more than 1 day before it was lost:** × 0.8.
- Different category **and** names less than half similar: score 0.

A pair is stored only if the score is **≥ 50**. Existing pairs are updated when reports change and removed (if still just "suggested") when they stop qualifying. A unique constraint prevents duplicates. Resolved, closed or hidden reports are excluded, and a user's own reports are never matched with each other.

## Explanations
Each stored match includes reasons such as "Same category: Phones", "Same brand: Samsung", "Same area", "Found 1 day(s) after it was lost", "Different brand (lowers the score)". The Matches page shows them under every suggestion.

## Examples (from the automated tests)
| Pair | Score |
|------|------:|
| Black Samsung phone (lost) / black Samsung phone (found), same area | 86 |
| Same, but found in a different city | 73 |
| Black iPhone (lost) / black Samsung phone (found) | 43, not suggested |
| Wallet / car keys | 0 |

## Known weaknesses
- Wording differences ("mobile" vs "phone") or typos lower the score; Arabic/English mixing is not handled.
- Location is text, not coordinates.
- Weights and the threshold were set by reasoning and a handful of test cases, not tuned on real data.

## Image matching (not implemented)
Recommended approach for later: compute image embeddings with a CLIP-style model through a hosted API (needs an API key and cost approval), store them with `pgvector`, and add cosine similarity as one more weighted signal. Until that exists the product must not claim image matching.
