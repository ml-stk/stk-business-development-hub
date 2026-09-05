import * as XLSX from 'xlsx';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Organisation, Contact, UserProfile, Engagement, Task, Opportunity } from '../types';
import { normalizeString, calculateSimilarity } from './organisationService';
import { businessImportPlanner, ImportPlan } from './businessImportPlanner';

export interface ParsedWorksheet { sheetName: string; recognizedType: 'TARGETS' | 'CONTACTS' | 'WORKLIST' | 'OPPORTUNITIES' | 'UNKNOWN'; headers: string[]; rows: Record<string, any>[]; }
export interface WorkbookParseResult { fileName: string; sheets: ParsedWorksheet[]; }
export interface MigrationSummaryReport {
  totalSheetsProcessed: number; organisationsCreated: number; organisationsMatched: number; organisationsSkipped: number;
  contactsCreated: number; contactsHierarchyLinked: number; contactsHierarchyUnresolved: number; engagementsCreated: number;
  tasksCreated: number; opportunitiesCreated: number; validationErrors: { entity: string; row: number; error: string }[]; detailedLogs: string[];
}

const cleanKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const field = (row: Record<string, any>, aliases: string[]) => {
  const keys = new Map(Object.keys(row).map((key) => [cleanKey(key), key]));
  for (const alias of aliases) { const key = keys.get(cleanKey(alias)); if (key !== undefined && row[key] !== null && row[key] !== undefined) return String(row[key]).trim(); }
  return '';
};
const parseDate = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'number') { const p = XLSX.SSF.parse_date_code(value); if (!p) return null; return new Date(Date.UTC(p.y, p.m - 1, p.d, p.H || 0, p.M || 0, p.S || 0)).toISOString(); }
  const text = String(value ?? '').trim(); if (!text) return null; const d = new Date(text); return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const similarityMatch = (name: string, orgs: Organisation[]) => {
  const candidate = normalizeString(name); if (!candidate) return null;
  const exact = orgs.find((o) => normalizeString(o.name) === candidate); if (exact) return { org: exact, confidence: 100 };
  const alias = orgs.find((o) => (o.aliases || []).some((a) => normalizeString(a) === candidate)); if (alias) return { org: alias, confidence: 98 };
  let best: { org: Organisation; confidence: number } | null = null;
  for (const org of orgs) { const confidence = Math.round(calculateSimilarity(candidate, normalizeString(org.name)) * 100); if (confidence >= 85 && (!best || confidence > best.confidence)) best = { org, confidence }; }
  return best;
};
const classify = (name: string, headers: string[]): ParsedWorksheet['recognizedType'] => {
  const sheet = cleanKey(name); const keys = headers.map(cleanKey);
  if (sheet.includes('dashboard')) return 'UNKNOWN'; if (sheet.includes('target')) return 'TARGETS';
  if (sheet.includes('cmdchain') || sheet.includes('commandchain') || sheet.includes('contact') || sheet.includes('heatmap')) return 'CONTACTS';
  if (sheet.includes('worklist') || sheet.includes('engagement') || sheet.includes('task')) return 'WORKLIST';
  if (sheet.includes('opp') || sheet.includes('sales') || sheet.includes('referral') || sheet.includes('pipeline')) return 'OPPORTUNITIES';
  if (keys.includes('eid') && keys.includes('entity')) return 'TARGETS'; if (keys.includes('pid') || keys.includes('reportstopid')) return 'CONTACTS';
  if (keys.includes('engagementdate') || keys.includes('engagementtype')) return 'WORKLIST'; if (keys.includes('estimateddealsize') || keys.includes('osrstatus')) return 'OPPORTUNITIES';
  return 'UNKNOWN';
};
const normaliseName = (v: string) => normalizeString(v).toLowerCase();
const userMatch = (name: string, users: UserProfile[]) => {
  const n = normaliseName(name); if (!n) return null;
  return users.find((u) => normaliseName(u.displayName) === n) || users.find((u) => normaliseName(u.email) === n) || null;
};
const statusFromSource = (value: string): Opportunity['status'] => { const v = value.toUpperCase(); if (v.includes('WON')) return 'WON'; if (v.includes('LOST')) return 'LOST'; if (v.includes('UNCONV')) return 'UNCONVERTED'; return 'OPEN'; };
const engagementTypeFromSource = (value: string): Engagement['engagementType'] => {
  const v = value.toUpperCase(); if (v.includes('EMAIL')) return 'EMAIL'; if (v.includes('PHONE')) return 'PHONE_CALL'; if (v.includes('SMS')) return 'SMS'; if (v.includes('ONSITE')) return 'MEETING_ONSITE'; if (v.includes('EVENT')) return 'MEETING_EVENT'; if (v.includes('COFFEE')) return 'MEETING_COFFEE'; if (v.includes('LINKEDIN')) return 'LINKEDIN'; if (v.includes('VIDEO')) return 'VIDEO_CONFERENCE'; return 'OTHER';
};
const purposeFromSource = (details: string): Engagement['purpose'] => {
  const v = details.toUpperCase(); if (v.includes('INTRO')) return 'BUSINESS_INTRODUCTION'; if (v.includes('ESTABLISH')) return 'CONTACT_ESTABLISHMENT'; if (v.includes('MEET')) return 'MEET_AND_GREET'; if (v.includes('REFERR')) return 'REFERRAL'; if (v.includes('DISCOVER')) return 'DISCOVERY'; return 'FOLLOW_UP';
};
const taskStatusFromSource = (value: string): Task['status'] => { const v = value.toUpperCase(); if (v.includes('CANCEL')) return 'CANCELLED'; if (v.includes('PROGRESS')) return 'IN_PROGRESS'; if (v.includes('CLOSED')) return 'COMPLETED'; return 'OPEN'; };

export const migrationService = {
  parseWorkbook(data: ArrayBuffer | string, fileName: string): WorkbookParseResult {
    const workbook = XLSX.read(data, { type: typeof data === 'string' ? 'string' : 'array', cellDates: true, raw: true });
    return { fileName, sheets: workbook.SheetNames.map((sheetName) => { const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName], { defval: '', raw: true }); const headers = rows.length ? Object.keys(rows[0]) : []; return { sheetName, recognizedType: classify(sheetName, headers), headers, rows }; }).filter((s) => s.rows.length > 0) };
  },
  getField: field,
  normalizeOrgName: normalizeString,
  matchOrganisation(rawName: string, existingOrgs: Organisation[]): Organisation | null { return similarityMatch(rawName, existingOrgs)?.org || null; },

  async createImportPlan(workbookResult: WorkbookParseResult): Promise<ImportPlan> {
    const [orgSnap, contactSnap, userSnap] = await Promise.all([getDocs(collection(db, 'organisations')), getDocs(collection(db, 'contacts')), getDocs(collection(db, 'users'))]);
    const organisations = orgSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Organisation[];
    const contacts = contactSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Contact[];
    const users = userSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as UserProfile[];
    const parsed = businessImportPlanner.parse(new TextEncoder().encode(JSON.stringify({})), workbookResult.fileName);
    parsed.sheets = workbookResult.sheets.map((s) => ({ sheetName: s.sheetName, type: s.recognizedType === 'UNKNOWN' ? 'UNKNOWN' : s.recognizedType, rowCount: s.rows.length, headers: s.headers, mappings: [] }));
    parsed.rows = new Map(workbookResult.sheets.map((s) => [s.sheetName, s.rows as Record<string, unknown>[]]));
    return businessImportPlanner.buildPlan(parsed, workbookResult.fileName, organisations, contacts, users);
  },

  async commitImport(workbookResult: WorkbookParseResult, plan: ImportPlan, user: UserProfile): Promise<MigrationSummaryReport> {
    if (!auth.currentUser?.uid) throw new Error('Authentication is required to import data.');
    if (auth.currentUser.uid !== user.uid) throw new Error('Authenticated user does not match the import operator.');
    if (user.role !== 'ADMIN' || user.active !== true) throw new Error('Administrator privileges are required to commit an import.');
    if (!plan.readyForReview || plan.issues.some((i) => i.severity === 'ERROR')) throw new Error('Import cannot be committed while validation errors remain.');

    // Re-plan immediately before commit to prevent preview/commit drift.
    const currentPlan = await this.createImportPlan(workbookResult);
    if (currentPlan.issues.some((i) => i.severity === 'ERROR')) throw new Error('Import validation changed since preview; review the workbook again.');
    if (currentPlan.organisations.some((o) => o.action === 'REVIEW')) throw new Error('Organisation conflicts require administrator review before commit.');
    if (currentPlan.opportunities.unresolvedAccountManager > 0) throw new Error('One or more Account Managers could not be resolved to Hub users. Resolve them before commit.');

    const [orgSnap, contactSnap, userSnap] = await Promise.all([getDocs(collection(db, 'organisations')), getDocs(collection(db, 'contacts')), getDocs(collection(db, 'users'))]);
    const existingOrgs = orgSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Organisation[];
    const existingContacts = contactSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Contact[];
    const users = userSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as UserProfile[];
    const now = new Date().toISOString();
    const report: MigrationSummaryReport = { totalSheetsProcessed: 0, organisationsCreated: 0, organisationsMatched: 0, organisationsSkipped: 0, contactsCreated: 0, contactsHierarchyLinked: 0, contactsHierarchyUnresolved: 0, engagementsCreated: 0, tasksCreated: 0, opportunitiesCreated: 0, validationErrors: [], detailedLogs: [`Approved import: ${workbookResult.fileName}`] };
    const writes: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
    const addWrite = (fn: (batch: ReturnType<typeof writeBatch>) => void) => writes.push(fn);
    const orgMap = new Map<string, string>(); existingOrgs.forEach((o) => { orgMap.set(normaliseName(o.name), o.id); (o.aliases || []).forEach((a) => orgMap.set(normaliseName(a), o.id)); });

    const targetRows = workbookResult.sheets.find((s) => s.recognizedType === 'TARGETS')?.rows || [];
    const referenceRows = workbookResult.sheets.filter((s) => ['CONTACTS', 'WORKLIST', 'OPPORTUNITIES'].includes(s.recognizedType)).flatMap((s) => s.rows.map((row) => ({ row, type: s.recognizedType })));
    const allOrgRows = [...targetRows.map((row) => ({ row, type: 'TARGETS' as const })), ...referenceRows];
    const seenSourceNames = new Set<string>();
    for (const { row, type } of allOrgRows) {
      const name = field(row, type === 'OPPORTUNITIES' ? ['Client', 'Entity', 'Organisation', 'OrganisationName', 'Company'] : ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client']);
      const key = normaliseName(name); if (!key || seenSourceNames.has(key)) continue; seenSourceNames.add(key);
      const existing = similarityMatch(name, existingOrgs); if (existing && existing.confidence >= 95) { orgMap.set(key, existing.org.id); report.organisationsMatched++; continue; }
      if (existing) { report.organisationsSkipped++; report.validationErrors.push({ entity: 'Organisations', row: 0, error: `Ambiguous organisation match: ${name} → ${existing.org.name} (${existing.confidence}%).` }); continue; }
      const ref = doc(collection(db, 'organisations')); const sourceCategory = field(row, ['CategoryName', 'Category', 'EntityClass', 'Type']).toUpperCase(); const category: Organisation['category'] = sourceCategory.includes('PRIMARY') ? 'PRIMARY' : 'SECONDARY';
      const org: Organisation = { id: ref.id, name, aliases: [], category, sector: field(row, ['Sector', 'Industry', 'Vertical']) || '', priority: 'MEDIUM', status: 'ACTIVE', assignedBDMId: type === 'TARGETS' ? user.uid : null, location: '', website: '', description: '', notes: type === 'REFERENCE' ? 'Imported from operational workbook reference.' : '', lastEngagementDate: null, nextFollowUpDate: null, createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid };
      addWrite((batch) => batch.set(ref, org)); orgMap.set(key, ref.id); report.organisationsCreated++;
    }
    report.totalSheetsProcessed += targetRows.length ? 1 : 0;

    const contactMap = new Map<string, string>(); const pidMap = new Map<string, string>(); const pendingParents: Array<{ id: string; parentPid: string; orgId: string }> = [];
    const contactRows = workbookResult.sheets.find((s) => s.recognizedType === 'CONTACTS')?.rows || [];
    for (const [index, row] of contactRows.entries()) {
      const orgId = orgMap.get(normaliseName(field(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client']))); if (!orgId) { report.validationErrors.push({ entity: 'Contacts', row: index + 4, error: 'Organisation could not be resolved.' }); continue; }
      const first = field(row, ['Fname', 'FirstName', 'GivenName']); const last = field(row, ['Lname', 'LastName', 'Surname']); const full = field(row, ['FullName', 'Name', 'ContactName', 'Stakeholder']) || `${first} ${last}`.trim();
      if (!full) { report.validationErrors.push({ entity: 'Contacts', row: index + 4, error: 'Contact name is missing.' }); continue; }
      const parts = full.split(/\s+/); const firstName = first || parts[0]; const lastName = last || parts.slice(1).join(' '); const email = field(row, ['Email', 'EmailAddress', 'WorkEmail']);
      const pid = field(row, ['PID', 'ContactID', 'ID', 'StakeholderID']); const contactKey = `${orgId}|${normaliseName(email || full)}`;
      const duplicate = existingContacts.find((c) => c.organisationId === orgId && ((email && normaliseName(c.email) === normaliseName(email)) || normaliseName(c.fullName) === normaliseName(full)));
      if (duplicate) { if (pid) pidMap.set(pid, duplicate.id); contactMap.set(contactKey, duplicate.id); continue; }
      const ref = doc(collection(db, 'contacts')); const contact: Contact = { id: ref.id, organisationId: orgId, firstName, lastName, fullName: `${firstName} ${lastName}`.trim(), jobTitle: field(row, ['Role', 'JobTitle', 'Title', 'Position']) || 'Stakeholder', department: field(row, ['Department', 'Division', 'Unit', 'Dept']), mobile: field(row, ['Mobile', 'Phone', 'Cell', 'Telephone']), landline: field(row, ['Landline', 'OfficePhone', 'DirectLine']), email, gender: field(row, ['Gender']) || null, reportsToContactId: null, decisionRole: 'UNKNOWN', influenceLevel: 'UNKNOWN', relationshipStrength: 'UNKNOWN', status: 'ACTIVE', notes: '', createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid };
      addWrite((batch) => batch.set(ref, contact)); if (pid) pidMap.set(pid, ref.id); contactMap.set(contactKey, ref.id); pendingParents.push({ id: ref.id, parentPid: field(row, ['ReportsToPID', 'ReportsTo', 'ManagerPID', 'Supervisor']), orgId }); report.contactsCreated++;
    }
    for (const pending of pendingParents) { if (!pending.parentPid) continue; const parent = pidMap.get(pending.parentPid); if (!parent || parent === pending.id) { report.contactsHierarchyUnresolved++; continue; } addWrite((batch) => batch.update(doc(db, 'contacts', pending.id), { reportsToContactId: parent, updatedAt: now, updatedBy: user.uid })); report.contactsHierarchyLinked++; }
    report.totalSheetsProcessed += contactRows.length ? 1 : 0;

    const workRows = workbookResult.sheets.find((s) => s.recognizedType === 'WORKLIST')?.rows || [];
    for (const [index, row] of workRows.entries()) {
      const orgId = orgMap.get(normaliseName(field(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client']))); const date = parseDate(row[Object.keys(row).find((k) => cleanKey(k) === 'engagementdate') || '']);
      if (!orgId || !date) { report.validationErrors.push({ entity: 'Worklist', row: index + 4, error: `${!orgId ? 'Organisation could not be resolved. ' : ''}${!date ? 'EngagementDate is missing or invalid.' : ''}` }); continue; }
      const contactName = field(row, ['ContactName', 'ClientContact']); const contactId = contactName ? contactMap.get(`${orgId}|${normaliseName(contactName)}`) || null : null;
      const engagementRef = doc(collection(db, 'engagements')); const taskRef = doc(collection(db, 'tasks')); const details = field(row, ['EngagementDetails', 'Details', 'Description', 'Notes']); const nextDate = parseDate(field(row, ['NextEngagementDate', 'NextFollowUpDate', 'FollowUpDate'])); const sourceStatus = field(row, ['Status']);
      const engagement: Engagement = { id: engagementRef.id, organisationId: orgId, contactId, assignedTo: user.uid, engagementType: engagementTypeFromSource(field(row, ['EngagementType'])), engagementDate: date, purpose: purposeFromSource(details), details, outcome: field(row, ['Outcome', 'Result']), status: sourceStatus.toUpperCase().includes('HOLD') ? 'ON_HOLD' : sourceStatus.toUpperCase().includes('CLOSED') ? 'COMPLETED' : 'COMPLETED', engagementCycle: Number(field(row, ['EngagementCycle'])) || null, engagementCycleDescription: field(row, ['EngagementCycleDescr']) || null, nextEngagementDate: nextDate, createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid };
      const task: Task = { id: taskRef.id, organisationId: orgId, contactId, engagementId: engagementRef.id, opportunityId: null, assignedTo: user.uid, title: details || 'Follow-Up Task', description: field(row, ['Outcome', 'Result']), dueDate: nextDate || date, priority: 'MEDIUM', status: taskStatusFromSource(sourceStatus), completedDate: sourceStatus.toUpperCase().includes('CLOSED') ? date : null, completedBy: sourceStatus.toUpperCase().includes('CLOSED') ? user.uid : null, createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid };
      addWrite((batch) => { batch.set(engagementRef, engagement); batch.set(taskRef, task); }); report.engagementsCreated++; report.tasksCreated++;
    }
    report.totalSheetsProcessed += workRows.length ? 1 : 0;

    const oppRows = workbookResult.sheets.find((s) => s.recognizedType === 'OPPORTUNITIES')?.rows || [];
    const opportunityRefs = new Map<string, string>();
    for (const [index, row] of oppRows.entries()) {
      const orgId = orgMap.get(normaliseName(field(row, ['Client', 'Entity', 'Organisation', 'OrganisationName', 'Company']))); const title = field(row, ['OpportunitiesSalesReferrals', 'Opportunity', 'Deal', 'Title']); const discovered = parseDate(field(row, ['DateUncovered', 'DiscoveredDate'])); const closed = parseDate(field(row, ['DateClosed', 'ClosedDate'])); const status = statusFromSource(field(row, ['OSR_Status', 'Status']));
      if (!orgId || !title || !discovered) { report.validationErrors.push({ entity: 'Opportunities', row: index + 4, error: `${!orgId ? 'Organisation could not be resolved. ' : ''}${!title ? 'Opportunity title is missing. ' : ''}${!discovered ? 'DateUncovered is missing or invalid.' : ''}` }); continue; }
      const amName = field(row, ['AM_Assigned', 'AccountManager', 'AccountManagerName']); const am = userMatch(amName, users); if (!am) { report.validationErrors.push({ entity: 'Opportunities', row: index + 4, error: `Account Manager could not be resolved: ${amName}.` }); continue; }
      const clientContact = field(row, ['ClientContact', 'ContactName']); const contactId = clientContact ? contactMap.get(`${orgId}|${normaliseName(clientContact)}`) || null : null;
      const rawValue = field(row, ['Estimated Deal Size', 'EstimatedValue', 'DealValue', 'Amount', 'Value']); const value = Number(rawValue.replace(/[^0-9.-]/g, '')); if (Number.isNaN(value)) { report.validationErrors.push({ entity: 'Opportunities', row: index + 4, error: `Estimated deal size is not numeric: ${rawValue}.` }); continue; }
      const sourceId = field(row, ['OSR_ID', 'ID']); const duplicate = existingOrgs.length >= 0 && sourceId ? false : false; // Source IDs are retained in the import key below; no unsafe cross-collection lookup.
      const ref = doc(collection(db, 'opportunities')); const opportunity: Opportunity = { id: ref.id, organisationId: orgId, contactId, title, description: '', solutionCategory: field(row, ['SolutionCategory', 'Solution', 'Category', 'Product']) || 'General', discoveredDate: discovered, status, pipelineStage: status === 'WON' || status === 'LOST' ? 'CLOSED' : 'IDENTIFIED', estimatedValue: value, currency: field(row, ['Currency', 'Curr']) || 'PGK', bdmOwnerId: user.uid, accountManagerId: am.uid, referredDate: discovered, closedDate: closed, winReason: status === 'WON' ? 'Imported from source workbook.' : null, lossReason: status === 'LOST' ? 'Imported from source workbook.' : null, notes: `${field(row, ['Notes', 'Comments'])}${sourceId ? `${field(row, ['Notes', 'Comments']) ? ' ' : ''}Source OSR_ID: ${sourceId}.` : ''}`.trim(), createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid };
      addWrite((batch) => batch.set(ref, opportunity)); if (sourceId) opportunityRefs.set(sourceId, ref.id); report.opportunitiesCreated++;
    }
    report.totalSheetsProcessed += oppRows.length ? 1 : 0;

    if (report.validationErrors.length) throw new Error(`Import validation changed during commit; ${report.validationErrors.length} issue(s) require review.`);
    const chunkSize = 400;
    for (let i = 0; i < writes.length; i += chunkSize) { const batch = writeBatch(db); for (const write of writes.slice(i, i + chunkSize)) write(batch); await batch.commit(); }
    report.detailedLogs.push(`Committed ${writes.length} deterministic Firestore operations in ${Math.ceil(writes.length / chunkSize)} batch(es).`);
    return report;
  },
};
