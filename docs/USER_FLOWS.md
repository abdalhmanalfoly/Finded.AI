# FindIt AI – User Flows

## 1. Register and log in
Landing → Register → submit email/password → (confirm email if enabled) → Dashboard.
Login → Dashboard. Wrong password → inline error. Forgot password → enter email → reset link → set new password → Login.

## 2. Report a lost item
Dashboard or navbar "Report Lost" → form → validate → upload image(s) → submit → success message → Item details page.
Behind the scenes: item saved → matching runs → any match ≥ threshold stored → notification created for the owner of the found item and for this user.

## 3. Report a found item
Same as above with found fields. Optional field: where the item is being kept (general description only).

## 4. Browse and search
Lost Items or Found Items → type keyword → apply filters → results (paginated) → click card → Item details.
Empty result → empty state with "Report it" button. Loading → skeleton cards. Error → retry message.

## 5. Review a match
Notification bell → "Possible match found" → Matches page → see both items side by side, score and reasons, with text "This is an estimate, not proof."
Options: **Request contact** or **Not a match**.

## 6. Contact request
User A requests contact with a short message → User B gets notification → B sees request (with item context, no personal details) → Accept or Reject.
- Accept → thread opens for both; each may choose to share contact details in the thread. Notification to A.
- Reject → A is notified without details.

## 7. Resolve a report
Owner opens report → "Mark as Resolved" → status Resolved → removed from public listings and from future matching → linked match marked confirmed.

## 8. Manage own reports
Dashboard → My Reports → Edit (matching re-runs) / Delete (confirm dialog) / Change status.

## 9. Flag a report
Item details → "Report this listing" → pick reason + details → submit → confirmation.

## 10. Admin moderation
Admin Dashboard → Flagged reports → open → hide/remove report, warn/suspend user, or dismiss flag → write resolution note → flag resolved.
Admin also views statistics and complaint queue.

## Error paths to design
Session expired, no network, image too large/wrong type, report not found, access denied, suspended account.
