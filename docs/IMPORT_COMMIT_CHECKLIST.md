# Controlled Business Data Import Checklist

## Before commit

- Confirm the workbook is the intended source file.
- Confirm worksheet classifications and ignored reporting sheets.
- Review all ERROR findings; imports with errors must not be committed.
- Review WARNING findings, especially organisation similarity, reporting relationships and account-manager resolution.
- Confirm the importing account is an active `ADMIN` user.
- Confirm no production changes are expected outside the imported records.

## Commit behaviour

- Upload and analysis are read-only.
- Organisation matches are accepted only at high confidence.
- Ambiguous organisation matches are not silently assigned.
- Organisations referenced by operational sheets but absent from Targets are proposed as reference organisations rather than dropped.
- Contacts without a resolvable organisation are not created.
- Reporting relationships are linked only after contact IDs are allocated.
- Missing/invalid source dates are not replaced with the current date.
- Account Manager names must resolve to active Hub users before commit.
- Existing contacts and opportunities are checked for obvious duplicates before creation.
- Firestore writes are deterministic and chunked below the platform batch limit.
- Audit identities are derived from the authenticated Firebase UID.

## After commit

- Confirm the summary counts.
- Review imported organisations, contacts, engagements/tasks and opportunities in the Hub.
- Confirm command-chain relationships where expected.
- Confirm opportunity ownership and account-manager fields are correct.
- Confirm no unexpected duplicate organisation variants were introduced.
- Retain the source workbook and import summary according to STK data-management practice.
