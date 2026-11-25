> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# FindIt AI – Project Description

**FindIt AI** is a web platform that helps people recover lost belongings. Owners report what they lost, finders report what they found, and the platform suggests likely pairs with a clear explanation of why. Contact details stay private until both sides agree, and administrators can moderate content.

## Why it matters
Lost-and-found today is fragmented and unsafe: posts are scattered, matching is manual, and public phone numbers attract scams.

## Who uses it
- **Owners** who lost an item.
- **Finders** who picked one up.
- **Administrators** who keep the platform trustworthy.

## What makes it different
- **Explainable matching:** every suggestion lists its reasons and is labeled as an estimate.
- **Privacy by design:** public pages show only safe fields; contact happens through approved requests; rules are enforced in the database.
- **Simple architecture:** a React single-page app on Supabase (database, authentication, storage) with no custom server to maintain.

## Scope
The first release covers accounts, reports with photos, search, matching, notifications, contact requests, dashboards and moderation. Image-based matching, maps, email notifications and Arabic translations are planned (see `FUTURE_IMPROVEMENTS.md`).

## Current state
Code and database are written and the database layer is tested. First browser run, real-Supabase verification and deployment are still to do (see `QA_REPORT.md`).
