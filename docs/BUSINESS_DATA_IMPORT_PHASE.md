# Business Data Import Phase

## Objective

Provide an administrator-only Excel workbook ingestion workflow that can analyse existing STK business data, map it to the Hub data model, identify data-quality and duplicate risks, preview the proposed changes, and only then commit approved records to Firestore.

## Production safety

- Development is isolated on `feature/business-data-import`.
- `main` remains the operational production branch.
- Workbook parsing must be read-only.
- No Firestore writes occur during upload, parsing, mapping, validation, or preview.
- Firestore writes occur only after explicit administrator confirmation.
- Existing records are not silently overwritten.
- Audit identities must come from the authenticated Firebase user, never workbook values.
- Ambiguous entity matches require review rather than automatic assignment.
- Presentation/calculated worksheets are ignored for import.

## First acceptance workbook

`BDM-Pom-MiningDepTec-Targets-N-CmdChainHeatMap_Latest Version.xlsx`

Expected business-data worksheets:

| Worksheet | Hub entity | Source characteristics |
|---|---|---|
| Targets | Organisations | EID, Entity, Category, CategoryName, Sector |
| CmdChainHeatMap | Contacts | PID, names, role, Entity, ReportsToPID, phones, email, gender |
| Worklist | Engagements / Tasks | SeqUpdateID, Entity, engagement type/date/details/outcome/status/next engagement |
| Opportunities-SalesReferrals | Opportunities | OSR_ID, Client, opportunity/referral, dates, status, client contact, AM, estimated deal size |

The following worksheets are reporting/presentation outputs and must not be imported:

- Dashboard Annual
- Dashboard
- Dashboard2
- Dashboard3
- Dashboard4

## Required import pipeline

```text
Workbook
  -> Workbook analysis
  -> Sheet classification
  -> Column/field mapping
  -> Entity resolution
  -> Validation
  -> Duplicate/conflict review
  -> Import preview
  -> Administrator approval
  -> Deterministic Firestore commit
  -> Import audit record
```

## Entity resolution requirements

### Organisations

Match in this order:

1. Stable source identifier where previously imported and recorded.
2. Normalised exact organisation name.
3. Existing alias.
4. High-confidence similarity match.
5. Otherwise create a new organisation candidate.

Never fall back to an arbitrary organisation when the source organisation cannot be resolved.

Known source-quality examples include trailing whitespace and probable spelling variants such as `Climate Chanage Authority`.

### Contacts

- Resolve the organisation before creating a contact.
- Preserve source PID as an external/source identifier in the import record or supported metadata.
- Build reporting relationships in a second pass after all contacts have been resolved.
- Reject self-references and circular reporting chains.
- Do not attach a contact to the first available organisation as a fallback.

### Worklist

Map source fields explicitly:

- `Entity` -> organisation
- `EngagementType` -> Hub engagement type
- `EngagementDate` -> engagement date
- `EngagementDetails` -> details/purpose as appropriate
- `Outcome` -> outcome
- `Status` -> engagement status
- `NextEngagementDate` -> follow-up/task due date

Do not manufacture a current date when a source date is missing. Missing required relationship/date data must be reported for review.

### Opportunities

Map:

- `Client` -> organisation
- `OpportunitiesSalesReferrals` -> title/description
- `DateUncovered` -> discovered date
- `OSR_Status` -> opportunity status
- `DateClosed` -> closed date
- `ClientContact` -> contact where resolvable
- `AM_Assigned` -> account manager where resolvable against the Hub user directory
- `Estimated Deal Size` -> estimated value

Do not automatically assign all imported opportunities to the administrator performing the import when a source owner is supplied but unresolved. Flag the owner for review.

## Import UX

1. Upload workbook.
2. Show workbook and worksheet analysis.
3. Show proposed mappings and confidence.
4. Show validation findings and duplicate candidates.
5. Show import preview with new/matched/skipped/conflict counts.
6. Require explicit administrator confirmation.
7. Execute import.
8. Show immutable import summary and errors.

## Initial acceptance criteria

The acceptance workbook must produce:

- 4 recognised business-data sheets.
- 5 dashboard/reporting sheets excluded from import.
- No arbitrary organisation fallback.
- No automatic Firestore writes during parsing/preview.
- Organisation references resolved consistently across all source sheets.
- Contact command-chain relationships resolved by PID where possible.
- Unresolved command-chain relationships reported.
- Source dates preserved rather than replaced with today's date.
- Source opportunity/account-manager relationships resolved or flagged.
- Import preview available before commit.
- Existing production `main` unchanged until a reviewed pull request is merged.
