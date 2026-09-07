import * as XLSX from 'xlsx';
import { collection, doc, getDocs, writeBatch, WriteBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Contact, Organisation, UserProfile } from '../types';
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

type BatchOperation = (batch: WriteBatch) => void;
const IMPORT_SOURCE = 'BDM Workbook Import';

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

const normalizeLookup = (value: unknown) => normalizeString(String(value ?? ''));
const normalizePhone = (value: unknown) => String(value ?? '').replace(/\D/g, '');

const matchUser = (rawName: string, users: UserProfile[]): UserProfile | null => {
  const candidate = normalizeLookup(rawName);
  if (!candidate) return null;
  return users.find((user) => normalizeLookup(user.displayName) === candidate) ||
    users.find((user) => normalizeLookup(user.email) === candidate) ||
    users.find((user) => normalizeLookup(user.displayName).includes(candidate) || candidate.includes(normalizeLookup(user.displayName))) || null;
};

const matchContact = (rawReference: string, organisationId: string, contacts: Contact[]): Contact | null => {
  const candidate = normalizeLookup(rawReference);
  if (!candidate) return null;
  const scoped = contacts.filter((contact) => contact.organisationId === organisationId);
  return scoped.find((contact) => normalizeLookup(contact.sourceId) === candidate) ||
    scoped.find((contact) => normalizeLookup(contact.email) === candidate) ||
    scoped.find((contact) => normalizeLookup(contact.fullName) === candidate) ||
    scoped.find((contact) => normalizePhone(contact.mobile) === normalizePhone(rawReference) && normalizePhone(rawReference) !== '') ||
    scoped.find((contact) => normalizePhone(contact.landline) === normalizePhone(rawReference) && normalizePhone(rawReference) !== '') ||
    scoped.find((contact) => normalizeLookup(contact.fullName).includes(candidate) || candidate.includes(normalizeLookup(contact.fullName))) || null;
};

const mapEngagementType = (value: string) => {
  const key = cleanKey(value);
  if (key.includes('email')) return 'EMAIL' as const;
  if (key.includes('phone') || key.includes('call') || key.includes('telephone')) return 'PHONE_CALL' as const;
  if (key.includes('sms') || key.includes('text')) return 'SMS' as const;
  if (key.includes('linkedin')) return 'LINKEDIN' as const;
  if (key.includes('video') || key.includes('teams') || key.includes('zoom') || key.includes('webex')) return 'VIDEO_CONFERENCE' as const;
  if (key.includes('event')) return 'MEETING_EVENT' as const;
  if (key.includes('coffee')) return 'MEETING_COFFEE' as const;
  if (key.includes('meeting') || key.includes('visit') || key.includes('onsite') || key.includes('face')) return 'MEETING_ONSITE' as const;
  return 'OTHER' as const;
};

const mapEngagementPurpose = (value: string) => {
  const key = cleanKey(value);
  if (key.includes('intro')) return 'BUSINESS_INTRODUCTION' as const;
  if (key.includes('establish') || key.includes('contact')) return 'CONTACT_ESTABLISHMENT' as const;
  if (key.includes('meet') || key.includes('greet')) return 'MEET_AND_GREET' as const;
  if (key.includes('referr')) return 'REFERRAL' as const;
  if (key.includes('discover')) return 'DISCOVERY' as const;
  if (key.includes('opportun')) return 'OPPORTUNITY_DISCUSSION' as const;
  if (key.includes('proposal')) return 'PROPOSAL_DISCUSSION' as const;
  return 'FOLLOW_UP' as const;
};

const mapEngagementStatus = (value: string) => {
  const key = cleanKey(value);
  if (key.includes('hold') || key.includes('pending')) return 'ON_HOLD' as const;
  if (key.includes('progress')) return 'IN_PROGRESS' as const;
  if (key.includes('open') || key.includes('active')) return 'OPEN' as const;
  if (key.includes('closed')) return 'CLOSED' as const;
  return 'COMPLETED' as const;
};

const mapTaskStatus = (value: string, engagementStatus: string) => {
  const key = cleanKey(value);
  if (key.includes('cancel')) return 'CANCELLED' as const;
  if (key.includes('progress')) return 'IN_PROGRESS' as const;
  if (key.includes('complete') || key.includes('done') || engagementStatus === 'COMPLETED' || engagementStatus === 'CLOSED') return 'COMPLETED' as const;
  return 'OPEN' as const;
};

const mapPriority = (value: string) => {
  const key = cleanKey(value);
  if (key.includes('high') || key.includes('urgent') || key.includes('p1')) return 'HIGH' as const;
  if (key.includes('low') || key.includes('p3')) return 'LOW' as const;
  return 'MEDIUM' as const;
};

const mapOpportunityStatus = (value: string) => {
  const key = cleanKey(value);
  if (key.includes('won')) return 'WON' as const;
  if (key.includes('lost')) return 'LOST' as const;
  if (key.includes('unconvert')) return 'UNCONVERTED' as const;
  return 'OPEN' as const;
};

const commitOperations = async (operations: BatchOperation[]) => {
  const chunkSize = 450;
  for (let start = 0; start < operations.length; start += chunkSize) {
    const batch = writeBatch(db);
    operations.slice(start, start + chunkSize).forEach((operation) => operation(batch));
    await batch.commit();
  }
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

  async commitImport(workbookResult: WorkbookParseResult, plan: ImportPlan, user: UserProfile): Promise<MigrationSummaryReport> {
    if (!auth.currentUser?.uid) throw new Error('Authentication is required to import data.');
    if (auth.currentUser.uid !== user.uid) throw new Error('Authenticated user does not match the import operator.');
    if (user.role !== 'ADMIN' || user.active !== true) throw new Error('Administrator privileges are required to commit an import.');
    if (!plan.readyForReview || plan.issues.some((issue) => issue.severity === 'ERROR')) throw new Error('Import cannot be committed while validation errors remain.');

    const [orgSnap, contactSnap, userSnap] = await Promise.all([
      getDocs(collection(db, 'organisations')),
      getDocs(collection(db, 'contacts')),
      getDocs(collection(db, 'users')),
    ]);
    const existingOrgs = orgSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Organisation[];
    const existingContacts = contactSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Contact[];
    const users = userSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as UserProfile[];
    const now = new Date().toISOString();
    const operations: BatchOperation[] = [];
    const report: MigrationSummaryReport = {
      totalSheetsProcessed: 0, organisationsCreated: 0, organisationsMatched: 0, organisationsSkipped: 0,
      contactsCreated: 0, contactsHierarchyLinked: 0, contactsHierarchyUnresolved: 0, engagementsCreated: 0,
      tasksCreated: 0, opportunitiesCreated: 0, validationErrors: [], detailedLogs: [`Approved import: ${workbookResult.fileName}`],
    };

    const orgMap = new Map<string, string>();
    existingOrgs.forEach((org) => {
      orgMap.set(normalizeLookup(org.name), org.id);
      (org.aliases || []).forEach((alias) => orgMap.set(normalizeLookup(alias), org.id));
      if (org.sourceId) orgMap.set(normalizeLookup(org.sourceId), org.id);
    });

    const targetSheet = workbookResult.sheets.find((sheet) => sheet.recognizedType === 'TARGETS');
    for (const [index, row] of (targetSheet?.rows || []).entries()) {
      const name = field(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client', 'TargetName', 'Name']);
      const sourceId = field(row, ['EID', 'ID', 'TargetID', 'OrgID']);
      if (!name) { report.validationErrors.push({ entity: 'Targets', row: index + 1, error: 'Organisation name is missing.' }); continue; }
      const existing = similarityMatch(name, existingOrgs);
      if (existing && existing.confidence >= 95) {
        orgMap.set(normalizeLookup(name), existing.org.id);
        if (sourceId) orgMap.set(normalizeLookup(sourceId), existing.org.id);
        report.organisationsMatched++;
        continue;
      }
      if (existing) {
        report.organisationsSkipped++;
        report.validationErrors.push({ entity: 'Targets', row: index + 1, error: `Ambiguous organisation match requires review: ${name} → ${existing.org.name} (${existing.confidence}%).` });
        continue;
      }
      const ref = doc(collection(db, 'organisations'));
      const aliases = field(row, ['Aliases', 'Alias', 'Acronym']).split(/[,;]+/).map((value) => value.trim()).filter(Boolean);
      const rawStatus = field(row, ['Status']).toUpperCase();
      const status = rawStatus.includes('HOLD') ? 'ON_HOLD' : rawStatus.includes('ARCH') ? 'ARCHIVED' : rawStatus.includes('INACT') ? 'INACTIVE' : 'ACTIVE';
      const rawPriority = field(row, ['Priority', 'Tier']).toUpperCase();
      const priority = rawPriority.includes('HIGH') || rawPriority.includes('P1') ? 'HIGH' : rawPriority.includes('LOW') || rawPriority.includes('P3') ? 'LOW' : 'MEDIUM';
      const organisation: Organisation = {
        id: ref.id, name, aliases,
        category: field(row, ['Category', 'Type']).toUpperCase().includes('SEC') ? 'SECONDARY' : 'PRIMARY',
        sector: field(row, ['Sector', 'Industry', 'Vertical']) || 'Commercial & Enterprise', priority, status,
        assignedBDMId: user.uid, location: field(row, ['Location', 'City', 'Province', 'Address']) || '',
        website: field(row, ['Website', 'URL', 'Web']), description: field(row, ['Description', 'Profile', 'Overview']),
        notes: field(row, ['Notes', 'Commentary', 'StrategicObjective']), lastEngagementDate: null, nextFollowUpDate: null,
        createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid,
        sourceSystem: IMPORT_SOURCE, sourceId: sourceId || null,
      };
      operations.push((batch) => batch.set(ref, organisation));
      orgMap.set(normalizeLookup(name), ref.id); if (sourceId) orgMap.set(normalizeLookup(sourceId), ref.id);
      report.organisationsCreated++; report.detailedLogs.push(`Created organisation: ${name}`);
    }
    report.totalSheetsProcessed += targetSheet ? 1 : 0;

    const importedContacts: Contact[] = [];
    const contactLookup = new Map<string, string>();
    const pendingParents: Array<{ id: string; ref: string }> = [];
    const contactSheet = workbookResult.sheets.find((sheet) => sheet.recognizedType === 'CONTACTS');
    for (const [index, row] of (contactSheet?.rows || []).entries()) {
      const orgName = field(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client', 'TargetName', 'OrgID']);
      const orgId = orgMap.get(normalizeLookup(orgName));
      if (!orgId) { report.contactsHierarchyUnresolved++; report.validationErrors.push({ entity: 'Contacts', row: index + 1, error: `Organisation could not be resolved: ${orgName || '(blank)'}.` }); continue; }
      const first = field(row, ['Fname', 'FirstName', 'GivenName']);
      const last = field(row, ['Lname', 'LastName', 'Surname']);
      const full = field(row, ['FullName', 'Name', 'ContactName', 'Stakeholder']) || `${first} ${last}`.trim();
      if (!full || (!first && !last)) { report.validationErrors.push({ entity: 'Contacts', row: index + 1, error: 'Contact name is missing.' }); continue; }
      const parts = full.split(/\s+/); const firstName = first || parts[0]; const lastName = last || parts.slice(1).join(' ');
      const ref = doc(collection(db, 'contacts')); const pid = field(row, ['PID', 'ContactID', 'ID', 'StakeholderID']);
      const contact: Contact = {
        id: ref.id, organisationId: orgId, firstName, lastName, fullName: `${firstName} ${lastName}`.trim(),
        jobTitle: field(row, ['Role', 'JobTitle', 'Title', 'Position']) || 'Stakeholder',
        department: field(row, ['Department', 'Division', 'Unit', 'Dept']), mobile: field(row, ['Mobile', 'Phone', 'Cell', 'Telephone']),
        landline: field(row, ['Landline', 'OfficePhone', 'DirectLine']), email: field(row, ['Email', 'EmailAddress', 'WorkEmail']),
        gender: field(row, ['Gender']) || null, reportsToContactId: null, decisionRole: 'UNKNOWN', influenceLevel: 'UNKNOWN',
        relationshipStrength: 'UNKNOWN', status: 'ACTIVE', notes: field(row, ['Notes', 'Comments']), createdAt: now,
        createdBy: user.uid, updatedAt: now, updatedBy: user.uid, sourceSystem: IMPORT_SOURCE, sourceId: pid || null,
      };
      operations.push((batch) => batch.set(ref, contact)); importedContacts.push(contact);
      [pid, contact.email, contact.fullName, contact.mobile].map(normalizeLookup).filter(Boolean).forEach((key) => contactLookup.set(key, ref.id));
      pendingParents.push({ id: ref.id, ref: field(row, ['ReportsToPID', 'ReportsTo', 'ManagerPID', 'Supervisor']) }); report.contactsCreated++;
    }

    for (const pending of pendingParents) {
      if (!pending.ref) continue;
      const parentId = contactLookup.get(normalizeLookup(pending.ref));
      if (!parentId || parentId === pending.id) { report.contactsHierarchyUnresolved++; continue; }
      operations.push((batch) => batch.update(doc(db, 'contacts', pending.id), { reportsToContactId: parentId, updatedBy: user.uid, updatedAt: now }));
      report.contactsHierarchyLinked++;
    }
    report.totalSheetsProcessed += contactSheet ? 1 : 0;

    const allContacts = [...existingContacts, ...importedContacts];
    const worklist = workbookResult.sheets.find((sheet) => sheet.recognizedType === 'WORKLIST');
    for (const [index, row] of (worklist?.rows || []).entries()) {
      const orgName = field(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client', 'TargetName']);
      const orgId = orgMap.get(normalizeLookup(orgName));
      const date = parseDate(row[Object.keys(row).find((key) => cleanKey(key) === 'engagementdate') || '']);
      if (!orgId || !date) { report.validationErrors.push({ entity: 'Worklist', row: index + 1, error: `${!orgId ? 'Organisation could not be resolved. ' : ''}${!date ? 'EngagementDate is missing or invalid.' : ''}` }); continue; }
      const contactReference = field(row, ['PID', 'ContactID', 'ClientContactID', 'ClientContact', 'ContactName', 'Stakeholder']);
      let contactId = contactLookup.get(normalizeLookup(contactReference)) || null;
      if (!contactId && contactReference) contactId = matchContact(contactReference, orgId, allContacts)?.id || null;
      if (contactReference && !contactId) report.detailedLogs.push(`Worklist row ${index + 1}: contact could not be matched for ${contactReference}; imported without contact link.`);

      const engagementType = mapEngagementType(field(row, ['EngagementType', 'InteractionType', 'ActivityType', 'Type']));
      const engagementPurpose = mapEngagementPurpose(field(row, ['Purpose', 'EngagementPurpose', 'Objective']));
      const engagementStatus = mapEngagementStatus(field(row, ['EngagementStatus', 'Status', 'OutcomeStatus']));
      const nextDate = parseDate(field(row, ['NextEngagementDate', 'NextFollowUpDate', 'FollowUpDate']));
      const details = field(row, ['EngagementDetails', 'Details', 'Description', 'Notes']);
      const outcome = field(row, ['Outcome', 'Result']);
      const engagementSourceId = field(row, ['SeqUpdateID', 'EngagementID', 'ActivityID', 'ID']);
      const engagementRef = doc(collection(db, 'engagements')); const taskRef = doc(collection(db, 'tasks'));
      const taskSourceId = field(row, ['TaskID', 'SeqUpdateID', 'ID']) || engagementSourceId;
      const taskStatus = mapTaskStatus(field(row, ['TaskStatus', 'ActionStatus', 'Status']), engagementStatus);
      const completedDate = taskStatus === 'COMPLETED' ? date : null;

      operations.push((batch) => batch.set(engagementRef, {
        id: engagementRef.id, organisationId: orgId, contactId, assignedTo: user.uid, engagementType, engagementDate: date,
        purpose: engagementPurpose, details, outcome, status: engagementStatus, engagementCycle: null, engagementCycleDescription: null,
        nextEngagementDate: nextDate, createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid,
        sourceSystem: IMPORT_SOURCE, sourceId: engagementSourceId || null,
      }));
      operations.push((batch) => batch.set(taskRef, {
        id: taskRef.id, organisationId: orgId, contactId, engagementId: engagementRef.id, opportunityId: null, assignedTo: user.uid,
        title: field(row, ['Action', 'Task', 'Title', 'Subject']) || 'Follow-Up Task', description: details,
        dueDate: nextDate || date, priority: mapPriority(field(row, ['Priority', 'TaskPriority', 'Urgency'])), status: taskStatus,
        completedDate, completedBy: taskStatus === 'COMPLETED' ? user.uid : null, createdAt: now, createdBy: user.uid,
        updatedAt: now, updatedBy: user.uid, sourceSystem: IMPORT_SOURCE, sourceId: taskSourceId || null,
      }));
      report.engagementsCreated++; report.tasksCreated++;
    }
    report.totalSheetsProcessed += worklist ? 1 : 0;

    const oppSheet = workbookResult.sheets.find((sheet) => sheet.recognizedType === 'OPPORTUNITIES');
    for (const [index, row] of (oppSheet?.rows || []).entries()) {
      const orgName = field(row, ['Client', 'Entity', 'Organisation', 'OrganisationName', 'Company']);
      const orgId = orgMap.get(normalizeLookup(orgName));
      const title = field(row, ['OpportunitiesSalesReferrals', 'Opportunity', 'Deal', 'Title']);
      if (!orgId || !title) { report.validationErrors.push({ entity: 'Opportunities', row: index + 1, error: `${!orgId ? 'Organisation could not be resolved. ' : ''}${!title ? 'Opportunity title is missing.' : ''}` }); continue; }

      const contactReference = field(row, ['ClientContactID', 'ClientContact', 'ContactName', 'PID', 'Contact']);
      let contactId = contactLookup.get(normalizeLookup(contactReference)) || null;
      if (!contactId && contactReference) contactId = matchContact(contactReference, orgId, allContacts)?.id || null;
      if (contactReference && !contactId) report.detailedLogs.push(`Opportunity row ${index + 1}: client contact could not be matched for ${contactReference}; imported without contact link.`);

      const accountManagerName = field(row, ['AM_Assigned', 'AccountManager', 'AccountManagerName']);
      const accountManager = matchUser(accountManagerName, users);
      if (accountManagerName && !accountManager) report.detailedLogs.push(`Opportunity row ${index + 1}: account manager could not be matched for ${accountManagerName}; imported without account manager assignment.`);
      const bdmOwnerName = field(row, ['BDM_Assigned', 'BDM', 'BDMOwner', 'BDMOwnerName']);
      const bdmOwner = matchUser(bdmOwnerName, users);
      const bdmOwnerId = bdmOwner?.uid || user.uid;
      const sourceId = field(row, ['OSR_ID', 'OpportunityID', 'SalesRefID', 'ID']);
      const ref = doc(collection(db, 'opportunities'));
      const rawValue = field(row, ['Estimated Deal Size', 'EstimatedValue', 'DealValue', 'Amount', 'Value']);
      const value = Number(rawValue.replace(/[^0-9.-]/g, '')) || 0;
      const status = mapOpportunityStatus(field(row, ['OSR_Status', 'Status']));
      const closedDate = parseDate(field(row, ['DateClosed', 'ClosedDate']));
      operations.push((batch) => batch.set(ref, {
        id: ref.id, organisationId: orgId, contactId, title,
        description: field(row, ['Description', 'Scope', 'Overview']),
        solutionCategory: field(row, ['SolutionCategory', 'Solution', 'Category', 'Product']) || 'General',
        discoveredDate: parseDate(field(row, ['DateUncovered', 'DiscoveredDate'])) || now, status,
        pipelineStage: status === 'WON' || status === 'LOST' ? 'CLOSED' : 'IDENTIFIED', estimatedValue: value,
        currency: field(row, ['Currency', 'Curr']) || 'PGK', bdmOwnerId, accountManagerId: accountManager?.uid || null,
        referredDate: parseDate(field(row, ['DateReferred', 'ReferredDate'])), closedDate: status === 'WON' || status === 'LOST' ? closedDate || now : null,
        winReason: status === 'WON' ? field(row, ['WinReason', 'Reason']) || 'Imported historical record' : null,
        lossReason: status === 'LOST' ? field(row, ['LossReason', 'Reason']) || 'Imported historical record' : null,
        notes: field(row, ['Notes', 'Comments']), createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid,
        sourceSystem: IMPORT_SOURCE, sourceId: sourceId || null,
      }));
      report.opportunitiesCreated++;
    }
    report.totalSheetsProcessed += oppSheet ? 1 : 0;

    if (report.validationErrors.length) throw new Error(`Import validation changed during commit; ${report.validationErrors.length} issue(s) require review.`);
    await commitOperations(operations);
    report.detailedLogs.push(`Committed ${operations.length} Firestore writes in safe batches of 450.`);
    return report;
  },
};
