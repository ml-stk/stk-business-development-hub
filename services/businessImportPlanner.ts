import * as XLSX from 'xlsx';
import { Contact, Organisation, UserProfile } from '../types';
import { calculateSimilarity, normalizeString } from './organisationService';

export type ImportSheetType = 'TARGETS' | 'CONTACTS' | 'WORKLIST' | 'OPPORTUNITIES' | 'IGNORED' | 'UNKNOWN';
export type MappingConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export interface ImportIssue { sheet: string; row: number; severity: 'ERROR' | 'WARNING'; message: string; }
export interface ImportMapping { source: string; target: string; confidence: MappingConfidence; }
export interface ImportSheetPlan { sheetName: string; type: ImportSheetType; rowCount: number; headers: string[]; mappings: ImportMapping[]; }
export interface ImportOrganisationCandidate {
  sourceRow: number;
  sourceId: string;
  sourceName: string;
  matchedOrganisationId: string | null;
  matchedOrganisationName: string | null;
  confidence: number;
  action: 'CREATE' | 'MATCH' | 'REVIEW' | 'SKIP';
  source: 'TARGETS' | 'REFERENCE';
  inferredCategory?: 'PRIMARY' | 'SECONDARY';
}
export interface ParsedImportWorkbook {
  workbook: XLSX.WorkBook;
  sheets: ImportSheetPlan[];
  rows: Map<string, Record<string, unknown>[]>;
}
export interface ImportPlan {
  fileName: string;
  sheets: ImportSheetPlan[];
  organisations: ImportOrganisationCandidate[];
  contacts: { total: number; resolvable: number; unresolvedOrganisation: number; hierarchyResolvable: number };
  engagements: { total: number; resolvableOrganisation: number; invalidDate: number };
  opportunities: { total: number; resolvableOrganisation: number; unresolvedAccountManager: number; invalidValue: number };
  issues: ImportIssue[];
  readyForReview: boolean;
}

const cleanKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const normalise = (value: unknown): string => String(value ?? '').trim();
const field = (row: Record<string, unknown>, aliases: string[]): string => {
  const keys = new Map(Object.keys(row).map((key) => [cleanKey(key), key]));
  for (const alias of aliases) {
    const key = keys.get(cleanKey(alias));
    if (key !== undefined) return normalise(row[key]);
  }
  return '';
};
const dateValue = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0));
  }
  const text = normalise(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const classifySheet = (name: string, headers: string[]): ImportSheetType => {
  const sheet = cleanKey(name); const keys = headers.map(cleanKey);
  if (sheet.includes('dashboard')) return 'IGNORED';
  if (sheet.includes('target')) return 'TARGETS';
  if (sheet.includes('cmdchain') || sheet.includes('commandchain') || sheet.includes('contact') || sheet.includes('heatmap')) return 'CONTACTS';
  if (sheet.includes('worklist') || sheet.includes('engagement') || sheet.includes('task')) return 'WORKLIST';
  if (sheet.includes('opportunities') || sheet.includes('sales') || sheet.includes('referral') || sheet.includes('pipeline')) return 'OPPORTUNITIES';
  if (keys.includes('reportstopid') || keys.includes('pid')) return 'CONTACTS';
  if (keys.includes('engagementtype') || keys.includes('engagementdate')) return 'WORKLIST';
  if (keys.includes('estimateddealsize') || keys.includes('osrstatus')) return 'OPPORTUNITIES';
  if (keys.includes('eid') && keys.includes('entity')) return 'TARGETS';
  return 'UNKNOWN';
};

const mappingFor = (headers: string[]): ImportMapping[] => {
  const aliases: Record<string, string[]> = {
    organisationName: ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client', 'TargetName'],
    sourceId: ['EID', 'PID', 'SeqUpdateID', 'OSR_ID', 'ID'], category: ['Category', 'CategoryName', 'Type'], sector: ['Sector', 'Industry', 'Vertical'],
    firstName: ['Fname', 'FirstName', 'GivenName'], lastName: ['Lname', 'LastName', 'Surname'], role: ['Role', 'JobTitle', 'Title', 'Position'],
    reportsTo: ['ReportsToPID', 'ReportsTo', 'ManagerPID', 'Supervisor'], email: ['Email', 'EmailAddress', 'WorkEmail'], mobile: ['Mobile', 'Phone', 'Cell'], landline: ['Landline', 'OfficePhone', 'DirectLine'],
    engagementType: ['EngagementType'], engagementDate: ['EngagementDate', 'Date'], details: ['EngagementDetails', 'Details', 'Description', 'Notes'], outcome: ['Outcome', 'Result'], status: ['Status', 'OSR_Status'], nextEngagementDate: ['NextEngagementDate', 'NextFollowUpDate', 'FollowUpDate'],
    opportunity: ['OpportunitiesSalesReferrals', 'Opportunity', 'Deal', 'Title'], discoveredDate: ['DateUncovered', 'DiscoveredDate'], closedDate: ['DateClosed', 'ClosedDate'], clientContact: ['ClientContact', 'ContactName'], accountManager: ['AM_Assigned', 'AccountManager', 'AccountManagerName'], estimatedValue: ['Estimated Deal Size', 'EstimatedValue', 'DealValue', 'Amount', 'Value'],
  };
  return headers.flatMap((header) => {
    const target = Object.entries(aliases).find(([, values]) => values.some((value) => cleanKey(value) === cleanKey(header)));
    return target ? [{ source: header, target: target[0], confidence: cleanKey(target[1][0]) === cleanKey(header) ? 'HIGH' : 'MEDIUM' } as ImportMapping] : [];
  });
};

const matchOrganisation = (rawName: string, organisations: Organisation[]) => {
  const candidate = normalizeString(rawName); if (!candidate) return null;
  const exact = organisations.find((org) => normalizeString(org.name) === candidate);
  if (exact) return { org: exact, confidence: 100 };
  const alias = organisations.find((org) => (org.aliases || []).some((value) => normalizeString(value) === candidate));
  if (alias) return { org: alias, confidence: 98 };
  let best: { org: Organisation; confidence: number } | null = null;
  for (const org of organisations) {
    const confidence = Math.round(calculateSimilarity(candidate, normalizeString(org.name)) * 100);
    if (confidence >= 85 && (!best || confidence > best.confidence)) best = { org, confidence };
  }
  return best;
};

const matchUser = (name: string, users: UserProfile[]): UserProfile | null => {
  const candidate = normalizeString(name); if (!candidate) return null;
  const exact = users.find((user) => normalizeString(user.displayName) === candidate);
  if (exact) return exact;
  const emailLocal = candidate.toLowerCase().replace(/\s+/g, '.');
  return users.find((user) => normalizeString(user.email).toLowerCase() === candidate.toLowerCase()) ||
    users.find((user) => normalizeString(user.displayName).toLowerCase() === emailLocal) || null;
};

const inferredCategory = (row: Record<string, unknown>): 'PRIMARY' | 'SECONDARY' => {
  const value = field(row, ['CategoryName', 'Category', 'EntityClass', 'Type']).toUpperCase();
  return value.includes('PRIMARY') ? 'PRIMARY' : 'SECONDARY';
};

export const businessImportPlanner = {
  parse(data: ArrayBuffer | Uint8Array, fileName: string): ParsedImportWorkbook {
    const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: true });
    const sheets: ImportSheetPlan[] = []; const rows = new Map<string, Record<string, unknown>[]>();
    for (const sheetName of workbook.SheetNames) {
      const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '', raw: true });
      const headers = sheetRows.length ? Object.keys(sheetRows[0]) : [];
      const type = classifySheet(sheetName, headers); rows.set(sheetName, sheetRows);
      sheets.push({ sheetName, type, rowCount: sheetRows.length, headers, mappings: mappingFor(headers) });
    }
    return { workbook, sheets, rows };
  },

  buildPlan(parsed: ParsedImportWorkbook, fileName: string, existingOrganisations: Organisation[], existingContacts: Contact[], users: UserProfile[]): ImportPlan {
    const issues: ImportIssue[] = [];
    const organisations: ImportOrganisationCandidate[] = [];
    const knownByName = new Map<string, Organisation>();
    existingOrganisations.forEach((org) => { knownByName.set(normalizeString(org.name), org); (org.aliases || []).forEach((alias) => knownByName.set(normalizeString(alias), org)); });
    const plannedNames = new Set<string>();

    const addOrganisationCandidate = (name: string, row: number, sourceId: string, source: 'TARGETS' | 'REFERENCE', category: 'PRIMARY' | 'SECONDARY') => {
      const sourceName = normalise(name); if (!sourceName) return;
      const key = normalizeString(sourceName); if (plannedNames.has(key)) return;
      plannedNames.add(key);
      const match = matchOrganisation(sourceName, existingOrganisations);
      const action = !match ? 'CREATE' : match.confidence >= 95 ? 'MATCH' : 'REVIEW';
      if (action === 'REVIEW') issues.push({ sheet: source, row, severity: 'WARNING', message: `Possible organisation match: "${sourceName}" → "${match!.org.name}" (${match!.confidence}% confidence).` });
      organisations.push({ sourceRow: row, sourceId, sourceName, matchedOrganisationId: match?.org.id || null, matchedOrganisationName: match?.org.name || null, confidence: match?.confidence || 0, action, source, inferredCategory: category });
    };

    const targetSheet = parsed.sheets.find((s) => s.type === 'TARGETS');
    (targetSheet ? parsed.rows.get(targetSheet.sheetName) || [] : []).forEach((row, i) => addOrganisationCandidate(field(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client', 'TargetName']), i + 4, field(row, ['EID', 'ID', 'TargetID', 'OrgID']), 'TARGETS', inferredCategory(row)));

    // Preserve organisations referenced by operational sheets even when they are not in Targets.
    for (const sheet of parsed.sheets.filter((s) => ['CONTACTS', 'WORKLIST', 'OPPORTUNITIES'].includes(s.type))) {
      for (const [i, row] of (parsed.rows.get(sheet.sheetName) || []).entries()) {
        const name = field(row, sheet.type === 'OPPORTUNITIES' ? ['Client', 'Entity', 'Organisation', 'OrganisationName', 'Company'] : ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client']);
        if (!name || knownByName.has(normalizeString(name)) || plannedNames.has(normalizeString(name))) continue;
        addOrganisationCandidate(name, i + 4, '', 'REFERENCE', inferredCategory(row));
      }
    }

    const allVirtualOrgs: Organisation[] = [...existingOrganisations];
    for (const candidate of organisations.filter((c) => c.action === 'CREATE')) {
      allVirtualOrgs.push({ id: `planned:${candidate.sourceName}`, name: candidate.sourceName, aliases: [], category: candidate.inferredCategory || 'SECONDARY', sector: '', priority: 'MEDIUM', status: 'ACTIVE', assignedBDMId: null, location: '', website: '', description: '', notes: '', lastEngagementDate: null, nextFollowUpDate: null, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '' });
    }
    const resolveOrg = (name: string) => matchOrganisation(name, allVirtualOrgs);

    const contactSheet = parsed.sheets.find((s) => s.type === 'CONTACTS'); const contactRows = contactSheet ? parsed.rows.get(contactSheet.sheetName) || [] : [];
    let contactResolvable = 0, contactUnresolved = 0, hierarchyResolvable = 0;
    const pidSet = new Set(contactRows.map((row) => field(row, ['PID', 'ContactID', 'ID', 'StakeholderID'])).filter(Boolean));
    contactRows.forEach((row, i) => {
      const orgName = field(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client']);
      if (resolveOrg(orgName)) contactResolvable++; else { contactUnresolved++; issues.push({ sheet: contactSheet!.sheetName, row: i + 4, severity: 'ERROR', message: `Contact organisation could not be resolved: "${orgName || '(blank)'}".` }); }
      const parent = field(row, ['ReportsToPID', 'ReportsTo', 'ManagerPID', 'Supervisor']);
      if (!parent || pidSet.has(parent)) hierarchyResolvable++; else issues.push({ sheet: contactSheet!.sheetName, row: i + 4, severity: 'WARNING', message: `Reporting manager PID "${parent}" could not be resolved within the workbook.` });
    });

    const workSheet = parsed.sheets.find((s) => s.type === 'WORKLIST'); const workRows = workSheet ? parsed.rows.get(workSheet.sheetName) || [] : [];
    let engagementResolvable = 0, invalidDates = 0;
    workRows.forEach((row, i) => {
      const orgName = field(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client']);
      if (resolveOrg(orgName)) engagementResolvable++; else issues.push({ sheet: workSheet!.sheetName, row: i + 4, severity: 'ERROR', message: `Worklist organisation could not be resolved: "${orgName || '(blank)'}".` });
      const date = dateValue(row[Object.keys(row).find((key) => cleanKey(key) === 'engagementdate') || '']);
      if (!date) { invalidDates++; issues.push({ sheet: workSheet!.sheetName, row: i + 4, severity: 'ERROR', message: 'EngagementDate is missing or invalid.' }); }
    });

    const oppSheet = parsed.sheets.find((s) => s.type === 'OPPORTUNITIES'); const oppRows = oppSheet ? parsed.rows.get(oppSheet.sheetName) || [] : [];
    let opportunityResolvable = 0, unresolvedAccountManager = 0, invalidValue = 0;
    oppRows.forEach((row, i) => {
      const client = field(row, ['Client', 'Entity', 'Organisation', 'OrganisationName', 'Company']);
      if (resolveOrg(client)) opportunityResolvable++; else issues.push({ sheet: oppSheet!.sheetName, row: i + 4, severity: 'ERROR', message: `Opportunity organisation could not be resolved: "${client || '(blank)'}".` });
      const am = field(row, ['AM_Assigned', 'AccountManager', 'AccountManagerName']);
      if (am && !matchUser(am, users)) { unresolvedAccountManager++; issues.push({ sheet: oppSheet!.sheetName, row: i + 4, severity: 'WARNING', message: `Account Manager "${am}" does not match an active Hub user and will require administrator review.` }); }
      const rawValue = field(row, ['Estimated Deal Size', 'EstimatedValue', 'DealValue', 'Amount', 'Value']);
      if (rawValue && Number.isNaN(Number(rawValue.replace(/[^0-9.-]/g, '')))) { invalidValue++; issues.push({ sheet: oppSheet!.sheetName, row: i + 4, severity: 'ERROR', message: `Estimated deal size is not numeric: "${rawValue}".` }); }
    });

    const unknownSheets = parsed.sheets.filter((s) => s.type === 'UNKNOWN');
    unknownSheets.forEach((sheet) => issues.push({ sheet: sheet.sheetName, row: 1, severity: 'WARNING', message: 'Worksheet was not recognised and will not be imported.' }));
    const businessSheets = parsed.sheets.filter((s) => ['TARGETS', 'CONTACTS', 'WORKLIST', 'OPPORTUNITIES'].includes(s.type));
    return { fileName, sheets: parsed.sheets, organisations, contacts: { total: contactRows.length, resolvable: contactResolvable, unresolvedOrganisation: contactUnresolved, hierarchyResolvable }, engagements: { total: workRows.length, resolvableOrganisation: engagementResolvable, invalidDate: invalidDates }, opportunities: { total: oppRows.length, resolvableOrganisation: opportunityResolvable, unresolvedAccountManager, invalidValue }, issues, readyForReview: businessSheets.length > 0 && !issues.some((issue) => issue.severity === 'ERROR') };
  },
};
