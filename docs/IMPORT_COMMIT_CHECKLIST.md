# Controlled Business Data Import Checklist

## Before commit

- Confirm the workbook is the intended source file.
- Confirm worksheet classifications and ignored reporting sheets.
- Review all ERROR findings; imports with errors must not be committed.
- Review WARNING findings, especially organisation similarity and account-manager resolution.
- Confirm the importing account is an active `ADMIN` user.
- Confirm no production changes are expected outside the imported records.

## Commit behaviour

- Upload and analysis are read-only.
- Organisation matches are accepted only at high confidence.
- Ambiguous organisation matches are not silently assigned.
- Contacts without a resolvable organisation are not created.
- Reporting relationships are linked only after contact IDs are allocated.
- Missing/invalid source dates are not replaced with the current date.
- The Firestore write is performed as one deterministic batch.
- Audit identities are derived from the authenticated Firebase UID.

## After commit

- Confirm the summary counts.
- Review imported organisations, contacts, engagements/tasks and opportunities in the Hub.
- Confirm command-chain relationships where expected.
- Confirm opportunity ownership and account-manager fields are correct.
- Retain the source workbook and import summary according to STK data-management practice.
