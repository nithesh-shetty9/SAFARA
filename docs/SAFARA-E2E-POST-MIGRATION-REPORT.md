# SAFARA Post-Migration E2E Retest

**Date:** 2026-10-01  
**Database:** `safara` (migration already applied by user before this retest). No schema changes were made by this run.  
**Coordinates:** Direct API writes used synthetic coordinates. On one browser attempt, Explore auto-requested the browser's existing geolocation before the mock took effect; the resulting row was removed immediately from verified synthetic user 12. No coordinate values are recorded here.

## Migration Verification

Read-only `information_schema` queries confirmed:

- `user_locations` and `location_trail` exist as InnoDB tables.
- `user_locations.user_id` is `BIGINT UNSIGNED` primary key; `location_trail.id` is `BIGINT AUTO_INCREMENT` primary key.
- Both tables have `BIGINT UNSIGNED` user keys and cascading foreign keys to `users(id)`.
- Coordinate and optional measurement fields are DOUBLE; `navigating` is `TINYINT(1)`/BOOLEAN.
- Current update timestamp, trail record timestamp, live index, and user/time trail index exist.

## Acceptance Matrix

| TEST ID | RESULT | Evidence |
|---|---|---|
| LOC-01 | PASS | Synthetic USER 3 `PUT /api/v1/locations/current` -> 200; subsequent GET -> 200 and returned the same measurements. Fresh MySQL read showed the row owned by user 3. |
| LOC-02 | BLOCKED | Explore populated Current location and a marker, and its save produced a DB row, but the browser used ambient geolocation before the mock took effect. That row was immediately removed. The explicit button action with controlled coordinates was not verified, so this is not accepted as a controlled GPS pass. |
| LOC-05 | PASS | USER 7 initially received `location: null` even with `?user_id=3`; after writing B's own location, USER 3 with `?user_id=7` still received USER 3's row. DB rows remained separated by user IDs. |
| LOC-06 | BLOCKED | API calls while `navigating=true` updated current DB state and created two trail rows; `navigating=false` updated current state without adding trail. The React eight-second throttle was not exercised because the browser click path was blocked. |
| LOC-07 | BLOCKED | Browser refresh/close and server stale-state lifecycle were not exercised through the UI. The server live-feed stale filter was exercised under LOC-08. |
| LOC-08 | PASS | Direct API role matrix: USER -> 403; NGO_OFFICER/GOV_OFFICER/DISTRICT_ADMIN/SUPER_ADMIN -> 200. Fresh active navigator was the only returned row; 11-minute stale, non-navigating, and suspended synthetic users were excluded. Response fields were user_id, coordinates, accuracy, heading, speed, updated_at only. |
| NAV-07 | BLOCKED | API stop request persisted `navigating=0`, and a subsequent non-navigating API update created no trail row. React `clearWatch` -> final API write -> DB assertion was not run because UI activation remained blocked. |
| ROUTE-02 | BLOCKED | Same-place helper/network behavior had passed in the prior fix verification (zero route, zero Directions requests), but the selected-place React UI message/card/button state was not retested here. |
| NAV-01 arrival | BLOCKED | Arrival predicate boundary checks had passed previously; UI arrival state and Finish navigation were not verified in this browser session. |
| SOS privacy | PASS | Direct live API regression after the SOS scope fix verified USER ownership, officer ACTIVE/ACKNOWLEDGED projection, admin projection, 403 for cross-user cancel and officer cancel, and allowed officer acknowledge/resolve. |

## Database Evidence and Cleanup

- Synthetic USER 3 and USER 7 current location rows were verified before cleanup; USER 3's navigation test produced two trail rows.
- USER 3 stop state was stored as `navigating=0`; a later non-navigation update left trail count unchanged.
- Synthetic current rows and trail rows for users 3, 7, and 12 were deleted after testing. No other user rows were touched.
- Final current-location rows contain only pre-existing user 2; trail row count is zero.
- Temporary staff roles were restored to USER. Browser token/user storage was cleared.

## Final Status

Location API and MySQL persistence, two-user ownership, navigating-only trail append, API stop state, and live-feed role/filter rules now have live DB evidence. Browser-driven navigation/watch throttling and final arrival/same-place UI assertions remain **Not Run/Blocked** by this browser automation session; they are not counted as passes.

**Production E2E status: BLOCKED** until React watchPosition -> location API -> MySQL -> stop -> UI is exercised with controlled GPS, and same-place/arrival UI states are verified.
