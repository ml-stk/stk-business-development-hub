import * as XLSX from 'xlsx';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Organisation, Contact, UserProfile } from '../types';
import { normalizeString, calculateSimilarity } from './organisationService';
import { businessImportPlanner, ImportPlan } from './businessImportPlanner';

export interface ParsedWorksheet {
  sheetName: string;
  recognizedType: 'TARGETS' | 'CONTACTS' | 'WORKLIST' | 'OPPORTUNITIES' | 'UNKNOWN';
  headers: string[];
  rows: Record<string, any>[];
}

export interface WorkbookParseResult { fileName: string; sheets: ParsedWorksheet[]; }

export interface MigrationSummaryReport {
  totalSheetsProcessed: number;
  organisationsCreated: number;
  organisationsMatched: number;
  organisationsSkipped: number;
  contactsCreated: number;
  contactsHierarchyLinked: number;
  contactsHierarchyUnresolved: number;
  engagementsCreated: number;
  tasksCreated: number;
  opportunitiesCreated: number;
  validationErrors: { entity: string; row: number; error: string }[];
  detailedLogs: string[];
}

const cleanKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const field = (row: Record<string, any>, aliases: string[]) => {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const key = keys.find((candidate) => cleanKey(candidate) === cleanKey(alias));
    if (key !== undefined && row[key] !== null && row[key] !== undefined) return String(row[key]).trim();
  }
  return '';
};
const parseDate = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0)).toISOString();
  }
  const text = String(value ?? '').trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const similarityMatch = (name: string, orgs: Organisation[]) => {
  const candidate = normalizeString(name);
  if (!candidate) return null;
  const exact = orgs.find((o) => normalizeString(o.name) === candidate);
  if (exact) return { org: exact, confidence: 100 };
  const alias = orgs.find((o) => (o.aliases || []).some((a) => normalizeString(a) === candidate));
  if (alias) return { org: alias, confidence: 98 };
  let best: { org: Organisation; confidence: number } | null = null;
  for (const org of orgs) {
    const confidence = Math.round(calculateSimilarity(candidate, normalizeString(org.name)) * 100);
    if (confidence >= 85 && (!best || confidence > best.confidence)) best = { org, confidence };
  }
  return best;
};

const classify = (name: string, headers: string[]): ParsedWorksheet['recognizedType'] => {
  const sheet = cleanKey(name); const keys = headers.map(cleanKey);
  if (sheet.includes('dashboard')) return 'UNKNOWN';
  if (sheet.includes('target')) return 'TARGETS';
  if (sheet.includes('cmdchain') || sheet.includes('commandchain') || sheet.includes('contact') || sheet.includes('heatmap')) return 'CONTACTS';
  if (sheet.includes('worklist') || sheet.includes('engagement') || sheet.includes('task')) return 'WORKLIST';
  if (sheet.includes('opp') || sheet.includes('sales') || sheet.includes('referral') || sheet.includes('pipeline')) return 'OPPORTUNITIES';
  if (keys.includes('eid') && keys.includes('entity')) return 'TARGETS';
  if (keys.includes('pid') || keys.includes('reportstopid')) return 'CONTACTS';
  if (keys.includes('engagementdate') || keys.includes('engagementtype')) return 'WORKLIST';
  if (keys.includes('estimateddealsize') || keys.includes('osrstatus')) return 'OPPORTUNITIES';
  return 'UNKNOWN';
};

export const migrationService = {
  parseWorkbook(data: ArrayBuffer | string, fileName: string): WorkbookParseResult {
    const workbook = XLSX.read(data, { type: typeof data === 'string' ? 'string' : 'array', cellDates: true, raw: true });
    return {
      fileName,
      sheets: workbook.SheetNames.map((sheetName) => {
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName], { defval: '', raw: true });
        const headers = rows.length ? Object.keys(rows[0]) : [];
        return { sheetName, recognizedType: classify(sheetName, headers), headers, rows };
      }).filter((sheet) => sheet.rows.length > 0),
    };
  },

  getField: field,
  normalizeOrgName: normalizeString,
  matchOrganisation(rawName: string, existingOrgs: Organisation[]): Organisation | null { return similarityMatch(rawName, existingOrgs)?.org || null; },

  async createImportPlan(workbookResult: WorkbookParseResult): Promise<ImportPlan> {
    const [orgSnap, contactSnap, userSnap] = await Promise.all([
      getDocs(collection(db, 'organisations')),
      getDocs(collection(db, 'contacts')),
      getDocs(collection(db, 'users')),
    ]);
    const organisations = orgSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Organisation[];
    const contacts = contactSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Contact[];
    const users = userSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as UserProfile[];
    const parsed = {
      workbook: XLSX.utils.book_new(),
      sheets: workbookResult.sheets.map((s) => ({ sheetName: s.sheetName, type: s.recognizedType === 'UNKNOWN' ? 'UNKNOWN' : s.recognizedType, rowCount: s.rows.length, headers: s.headers, mappings: [] })),
      rows: new Map(workbookResult.sheets.map((s) => [s.sheetName, s.rows as Record<string, unknown>[]])),
    } as ReturnType<typeof businessImportPlanner.parse>;
    return businessImportPlanner.buildPlan(parsed, workbookResult.fileName, organisations, contacts, users);
  },

  /**
   * Commit only an already-reviewed plan. No automatic fallback organisation is permitted.
   * All document IDs are allocated before the batch is committed so relationships are deterministic.
   */
  async commitImport(workbookResult: WorkbookParseResult, plan: ImportPlan, user: UserProfile): Promise<MigrationSummaryReport> {
    if (!auth.currentUser?.uid) throw new Error('Authentication is required to import data.');
    if (auth.currentUser.uid !== user.uid) throw new Error('Authenticated user does not match the import operator.');
    if (user.role !== 'ADMIN' || user.active !== true) throw new Error('Administrator privileges are required to commit an import.');
    if (!plan.readyForReview || plan.issues.some((issue) => issue.severity === 'ERROR')) throw new Error('Import cannot be committed while validation errors remain.');

    const [orgSnap, contactSnap] = await Promise.all([getDocs(collection(db, 'organisations')), getDocs(collection(db, 'contacts'))]);
    const existingOrgs = orgSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Organisation[];
    const existingContacts = contactSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Contact[];
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    const report: MigrationSummaryReport = {
      totalSheetsProcessed: 0, organisationsCreated: 0, organisationsMatched: 0, organisationsSkipped: 0,
      contactsCreated: 0, contactsHierarchyLinked: 0, contactsHierarchyUnresolved: 0, engagementsCreated: 0,
      tasksCreated: 0, opportunitiesCreated: 0, validationErrors: [], detailedLogs: [`Approved import: ${workbookResult.fileName}`],
    };

    const orgMap = new Map<string, string>();
    existingOrgs.forEach((o) => { orgMap.set(normalizeString(o.name), o.id); (o.aliases || []).forEach((a) => orgMap.set(normalizeString(a), o.id)); });
    const targetSheet = workbookResult.sheets.find((s) => s.recognizedType === 'TARGETS');
    for (const [index, row] of (targetSheet?.rows || []).entries()) {
      const name = field(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client', 'TargetName', 'Name']);
      const sourceId = field(row, ['EID', 'ID', 'TargetID', 'OrgID']);
      if (!name) { report.validationErrors.push({ entity: 'Targets', row: index + 1, error: 'Organisation name is missing.' }); continue; }
      const existing = similarityMatch(name, existingOrgs);
      if (existing && existing.confidence >= 95) { orgMap.set(normalizeString(name), existing.org.id); report.organisationsMatched++; continue; }
      if (existing) { report.organisationsSkipped++; report.validationErrors.push({ entity: 'Targets', row: index + 1, error: `Ambiguous organisation match requires review: ${name} → ${existing.org.name} (${existing.confidence}%).` }); continue; }
      const ref = doc(collection(db, 'organisations')); const aliases = field(row, ['Aliases', 'Alias', 'Acronym']).split(/[,;]+/).map((v) => v.trim()).filter(Boolean);
      const rawStatus = field(row, ['Status']).toUpperCase();
      const status = rawStatus.includes('HOLD') ? 'ON_HOLD' : rawStatus.includes('ARCH') ? 'ARCHIVED' : rawStatus.includes('INACT') ? 'INACTIVE' : 'ACTIVE';
      const rawPriority = field(row, ['Priority', 'Tier']).toUpperCase();
      const priority = rawPriority.includes('HIGH') || rawPriority.includes('P1') ? 'HIGH' : rawPriority.includes('LOW') || rawPriority.includes('P3') ? 'LOW' : 'MEDIUM';
      const organisation: Organisation = { id: ref.id, name, aliases, category: field(row, ['Category', 'Type']).toUpperCase().includes('SEC') ? 'SECONDARY' : 'PRIMARY', sector: field(row, ['Sector', 'Industry', 'Vertical']) || 'Commercial & Enterprise', priority, status, assignedBDMId: user.uid, location: field(row, ['Location', 'City', 'Province', 'Address']) || '', website: field(row, ['Website', 'URL', 'Web']), description: field(row, ['Description', 'Profile', 'Overview']), notes: field(row, ['Notes', 'Commentary', 'StrategicObjective']), lastEngagementDate: null, nextFollowUpDate: null, createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid };
      batch.set(ref, organisation); orgMap.set(normalizeString(name), ref.id); if (sourceId) orgMap.set(normalizeString(sourceId), ref.id); report.organisationsCreated++; report.detailedLogs.push(`Created organisation: ${name}`);
    }
    report.totalSheetsProcessed += targetSheet ? 1 : 0;

    const contactMap = new Map<string, string>(); const pendingParents: Array<{ id: string; ref: string }> = [];
    const contactSheet = workbookResult.sheets.find((s) => s.recognizedType === 'CONTACTS');
    for (const [index, row] of (contactSheet?.rows || []).entries()) {
      const orgName = field(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client', 'TargetName', 'OrgID']);
      const orgId = orgMap.get(normalizeString(orgName));
      if (!orgId) { report.contactsHierarchyUnresolved++; report.validationErrors.push({ entity: 'Contacts', row: index + 1, error: `Organisation could not be resolved: ${orgName || '(blank)'}.` }); continue; }
      const first = field(row, ['Fname', 'FirstName', 'GivenName']); const last = field(row, ['Lname', 'LastName', 'Surname']); const full = field(row, ['FullName', 'Name', 'ContactName', 'Stakeholder']) || `${first} ${last}`.trim();
      if (!full || !first && !last) { report.validationErrors.push({ entity: 'Contacts', row: index + 1, error: 'Contact name is missing.' }); continue; }
      const parts = full.split(/\s+/); const firstName = first || parts[0]; const lastName = last || parts.slice(1).join(' ');
      const ref = doc(collection(db, 'contacts')); const pid = field(row, ['PID', 'ContactID', 'ID', 'StakeholderID']);
      const contact: Contact = { id: ref.id, organisationId: orgId, firstName, lastName, fullName: `${firstName} ${lastName}`.trim(), jobTitle: field(row, ['Role', 'JobTitle', 'Title', 'Position']) || 'Stakeholder', department: field(row, ['Department', 'Division', 'Unit', 'Dept']), mobile: field(row, ['Mobile', 'Phone', 'Cell', 'Telephone']), landline: field(row, ['Landline', 'OfficePhone', 'DirectLine']), email: field(row, ['Email', 'EmailAddress', 'WorkEmail']), gender: field(row, ['Gender']) || null, reportsToContactId: null, decisionRole: 'UNKNOWN', influenceLevel: 'UNKNOWN', relationshipStrength: 'UNKNOWN', status: 'ACTIVE', notes: field(row, ['Notes', 'Comments']), createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid };
      batch.set(ref, contact); contactMap.set(pid || normalizeString(full), ref.id); pendingParents.push({ id: ref.id, ref: field(row, ['ReportsToPID', 'ReportsTo', 'ManagerPID', 'Supervisor']) }); report.contactsCreated++;
    }
    for (const pending of pendingParents) {
      if (!pending.ref) continue;
      const parent = contactMap.get(pending.ref) || contactMap.get(normalizeString(pending.ref));
      if (!parent || parent === pending.id) { report.contactsHierarchyUnresolved++; continue; }
      batch.update(doc(db, 'contacts', pending.id), { reportsToContactId: parent, updatedBy: user.uid, updatedAt: now }); report.contactsHierarchyLinked++;
    }
    report.totalSheetsProcessed += contactSheet ? 1 : 0;

    const worklist = workbookResult.sheets.find((s) => s.recognizedType === 'WORKLIST');
    for (const [index, row] of (worklist?.rows || []).entries()) {
      const orgName = field(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client', 'TargetName']); const orgId = orgMap.get(normalizeString(orgName)); const date = parseDate(row[Object.keys(row).find((k) => cleanKey(k) === 'engagementdate') || '']);
      if (!orgId || !date) { report.validationErrors.push({ entity: 'Worklist', row: index + 1, error: `${!orgId ? 'Organisation could not be resolved. ' : ''}${!date ? 'EngagementDate is missing or invalid.' : ''}` }); continue; }
      const engagementRef = doc(collection(db, 'engagements')); const taskRef = doc(collection(db, 'tasks')); const details = field(row, ['EngagementDetails', 'Details', 'Description', 'Notes']);
      batch.set(engagementRef, { id: engagementRef.id, organisationId: orgId, contactId: null, assignedTo: user.uid, engagementType: 'OTHER', engagementDate: date, purpose: 'FOLLOW_UP', details, outcome: field(row, ['Outcome', 'Result']), status: 'COMPLETED', engagementCycle: null, engagementCycleDescription: null, nextEngagementDate: parseDate(field(row, ['NextEngagementDate', 'NextFollowUpDate', 'FollowUpDate'])), createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid });
      batch.set(taskRef, { id: taskRef.id, organisationId: orgId, contactId: null, engagementId: engagementRef.id, opportunityId: null, assignedTo: user.uid, title: field(row, ['Action', 'Task', 'Title', 'Subject']) || 'Follow-Up Task', description: details, dueDate: parseDate(field(row, ['NextEngagementDate', 'NextFollowUpDate', 'FollowUpDate'])) || date, priority: 'MEDIUM', status: 'OPEN', completedDate: null, completedBy: null, createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid });
      report.engagementsCreated++; report.tasksCreated++;
    }
    report.totalSheetsProcessed += worklist ? 1 : 0;

    const oppSheet = workbookResult.sheets.find((s) => s.recognizedType === 'OPPORTUNITIES');
    for (const [index, row] of (oppSheet?.rows || []).entries()) {
      const orgName = field(row, ['Client', 'Entity', 'Organisation', 'OrganisationName', 'Company']); const orgId = orgMap.get(normalizeString(orgName)); const title = field(row, ['OpportunitiesSalesReferrals', 'Opportunity', 'Deal', 'Title']);
      if (!orgId || !title) { report.validationErrors.push({ entity: 'Opportunities', row: index + 1, error: `${!orgId ? 'Organisation could not be resolved. ' : ''}${!title ? 'Opportunity title is missing.' : ''}` }); continue; }
      const ref = doc(collection(db, 'opportunities')); const rawValue = field(row, ['Estimated Deal Size', 'EstimatedValue', 'DealValue', 'Amount', 'Value']); const value = Number(rawValue.replace(/[^0-9.-]/g, '')) || 0; const statusRaw = field(row, ['OSR_Status', 'Status']).toUpperCase(); const status = statusRaw.includes('WON') ? 'WON' : statusRaw.includes('LOST') ? 'LOST' : statusRaw.includes('UNCONV') ? 'UNCONVERTED' : 'OPEN';
      batch.set(ref, { id: ref.id, organisationId: orgId, contactId: null, title, description: field(row, ['Description', 'Scope', 'Overview']), solutionCategory: field(row, ['SolutionCategory', 'Solution', 'Category', 'Product']) || 'General', discoveredDate: parseDate(field(row, ['DateUncovered', 'DiscoveredDate'])) || now, status, pipelineStage: status === 'WON' || status === 'LOST' ? 'CLOSED' : 'IDENTIFIED', estimatedValue: value, currency: field(row, ['Currency', 'Curr']) || 'PGK', bdmOwnerId: user.uid, accountManagerId: null, referredDate: null, closedDate: parseDate(field(row, ['DateClosed', 'ClosedDate'])), winReason: status === 'WON' ? 'Imported historical record' : null, lossReason: status === 'LOST' ? 'Imported historical record' : null, notes: field(row, ['Notes', 'Comments']), createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid });
      report.opportunitiesCreated++;
    }
    report.totalSheetsProcessed += oppSheet ? 1 : 0;

    if (report.validationErrors.length) throw new Error(`Import validation changed during commit; ${report.validationErrors.length} issue(s) require review.`);
    await batch.commit();
    report.detailedLogs.push('Deterministic Firestore batch committed successfully.');
    return report;
  },
};
