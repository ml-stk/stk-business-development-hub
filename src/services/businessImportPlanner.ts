import * as XLSX from 'xlsx';
import { Contact, Organisation, UserProfile } from '../types';
import { calculateSimilarity, normalizeString } from './organisationService';

export type ImportSheetType = 'TARGETS' | 'CONTACTS' | 'WORKLIST' | 'OPPORTUNITIES' | 'IGNORED' | 'UNKNOWN';
export type MappingConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ImportIssue {
  sheet: string;
  row: number;
  severity: 'ERROR' | 'WARNING';
  message: string;
}

export interface ImportMapping {
  source: string;
  target: string;
  confidence: MappingConfidence;
}

export interface ImportSheetPlan {
  sheetName: string;
  type: ImportSheetType;
  rowCount: number;
  headers: string[];
  mappings: ImportMapping[];
}

export interface ImportOrganisationCandidate {
  sourceRow: number;
  sourceId: string;
  sourceName: string;
  matchedOrganisationId: string | null;
  matchedOrganisationName: string | null;
  confidence: number;
  action: 'CREATE' | 'MATCH' | 'REVIEW' | 'SKIP';
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

const cleanKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const normalise = (value: unknown): string => String(value ?? '').trim();

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

const findField = (row: Record<string, unknown>, aliases: string[]): string => {
  const fields = new Map(Object.keys(row).map((key) => [cleanKey(key), key]));
  for (const alias of aliases) {
    const key = fields.get(cleanKey(alias));
    if (key !== undefined) return normalise(row[key]);
  }
  return '';
};

const classifySheet = (name: string, headers: string[]): ImportSheetType => {
  const sheet = cleanKey(name);
  const keys = headers.map(cleanKey);

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

const mappingFor = (headers: string[], type: ImportSheetType): ImportMapping[] => {
  const targetAliases: Record<string, string[]> = {
    organisationName: ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client', 'TargetName'],
    sourceId: ['EID', 'PID', 'SeqUpdateID', 'OSR_ID', 'ID'],
    category: ['Category', 'CategoryName', 'Type'],
    sector: ['Sector', 'Industry', 'Vertical'],
    firstName: ['Fname', 'FirstName', 'GivenName'],
    lastName: ['Lname', 'LastName', 'Surname'],
    role: ['Role', 'JobTitle', 'Title', 'Position'],
    reportsTo: ['ReportsToPID', 'ReportsTo', 'ManagerPID', 'Supervisor'],
    email: ['Email', 'EmailAddress', 'WorkEmail'],
    mobile: ['Mobile', 'Phone', 'Cell'],
    landline: ['Landline', 'OfficePhone', 'DirectLine'],
    engagementType: ['EngagementType'],
    engagementDate: ['EngagementDate', 'Date'],
    details: ['EngagementDetails', 'Details', 'Description', 'Notes'],
    outcome: ['Outcome', 'Result'],
    status: ['Status', 'OSR_Status'],
    nextEngagementDate: ['NextEngagementDate', 'NextFollowUpDate', 'FollowUpDate'],
    opportunity: ['OpportunitiesSalesReferrals', 'Opportunity', 'Deal', 'Title'],
    discoveredDate: ['DateUncovered', 'DiscoveredDate'],
    closedDate: ['DateClosed', 'ClosedDate'],
    clientContact: ['ClientContact', 'ContactName'],
    accountManager: ['AM_Assigned', 'AccountManager', 'AccountManagerName'],
    estimatedValue: ['Estimated Deal Size', 'EstimatedValue', 'DealValue', 'Amount', 'Value'],
  };

  const mappings: ImportMapping[] = [];
  for (const header of headers) {
    const key = cleanKey(header);
    const target = Object.entries(targetAliases).find(([, aliases]) => aliases.some((alias) => cleanKey(alias) === key));
    if (!target) continue;
    mappings.push({ source: header, target: target[0], confidence: target[1][0] === header ? 'HIGH' : 'MEDIUM' });
  }

  if (type === 'TARGETS' && mappings.some((m) => m.target === 'organisationName')) {
    return mappings;
  }
  return mappings;
};

const matchOrganisation = (rawName: string, organisations: Organisation[]) => {
  const candidate = normalizeString(rawName);
  if (!candidate) return null;

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
  const candidate = normalizeString(name);
  if (!candidate) return null;
  return users.find((user) => normalizeString(user.displayName) === candidate) ||
    users.find((user) => normalizeString(user.displayName).includes(candidate) || candidate.includes(normalizeString(user.displayName))) || null;
};

export const businessImportPlanner = {
  parse(data: ArrayBuffer | Uint8Array, fileName: string): { workbook: XLSX.WorkBook; sheets: ImportSheetPlan[]; rows: Map<string, Record<string, unknown>[]> } {
    const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: true });
    const sheets: ImportSheetPlan[] = [];
    const rows = new Map<string, Record<string, unknown>[]>();

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '', raw: true });
      const headers = sheetRows.length ? Object.keys(sheetRows[0]) : [];
      const type = classifySheet(sheetName, headers);
      rows.set(sheetName, sheetRows);
      sheets.push({ sheetName, type, rowCount: sheetRows.length, headers, mappings: mappingFor(headers, type) });
    }

    return { workbook, sheets, rows };
  },

  buildPlan(
    parsed: ReturnType<typeof businessImportPlanner.parse>,
    fileName: string,
    existingOrganisations: Organisation[],
    existingContacts: Contact[],
    users: UserProfile[]
  ): ImportPlan {
    const issues: ImportIssue[] = [];
    const organisations: ImportOrganisationCandidate[] = [];

    const targets = parsed.sheets.find((sheet) => sheet.type === 'TARGETS');
    const targetRows = targets ? parsed.rows.get(targets.sheetName) || [] : [];

    targetRows.forEach((row, index) => {
      const sourceName = findField(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client', 'TargetName']);
      const sourceId = findField(row, ['EID', 'ID', 'TargetID', 'OrgID']);
      if (!sourceName) {
        issues.push({ sheet: targets?.sheetName || 'Targets', row: index + 4, severity: 'ERROR', message: 'Organisation name is missing.' });
        organisations.push({ sourceRow: index + 4, sourceId, sourceName: '', matchedOrganisationId: null, matchedOrganisationName: null, confidence: 0, action: 'SKIP' });
        return;
      }

      const match = matchOrganisation(sourceName, existingOrganisations);
      const action = !match ? 'CREATE' : match.confidence >= 95 ? 'MATCH' : 'REVIEW';
      if (action === 'REVIEW') {
        issues.push({ sheet: targets?.sheetName || 'Targets', row: index + 4, severity: 'WARNING', message: `Possible organisation match: "${sourceName}" → "${match?.org.name}" (${match?.confidence}% confidence).` });
      }
      organisations.push({ sourceRow: index + 4, sourceId, sourceName, matchedOrganisationId: match?.org.id || null, matchedOrganisationName: match?.org.name || null, confidence: match?.confidence || 0, action });
    });

    const contactsSheet = parsed.sheets.find((sheet) => sheet.type === 'CONTACTS');
    const contactRows = contactsSheet ? parsed.rows.get(contactsSheet.sheetName) || [] : [];
    let contactResolvable = 0;
    let contactUnresolved = 0;
    let hierarchyResolvable = 0;
    contactRows.forEach((row, index) => {
      const orgName = findField(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client']);
      const orgMatch = matchOrganisation(orgName, existingOrganisations);
      if (orgMatch) contactResolvable++; else {
        contactUnresolved++;
        issues.push({ sheet: contactsSheet?.sheetName || 'Contacts', row: index + 4, severity: 'ERROR', message: `Contact organisation could not be resolved: "${orgName || '(blank)'}".` });
      }
      const parentPid = findField(row, ['ReportsToPID', 'ReportsTo', 'ManagerPID', 'Supervisor']);
      if (!parentPid || contactRows.some((candidate) => findField(candidate, ['PID', 'ContactID', 'ID']) === parentPid)) hierarchyResolvable++;
      else issues.push({ sheet: contactsSheet?.sheetName || 'Contacts', row: index + 4, severity: 'WARNING', message: `Reporting manager PID "${parentPid}" could not be resolved within the workbook.` });
    });

    const worklistSheet = parsed.sheets.find((sheet) => sheet.type === 'WORKLIST');
    const worklistRows = worklistSheet ? parsed.rows.get(worklistSheet.sheetName) || [] : [];
    let engagementResolvable = 0;
    let invalidDates = 0;
    worklistRows.forEach((row, index) => {
      const orgName = findField(row, ['Entity', 'Organisation', 'OrganisationName', 'Company', 'Client']);
      if (matchOrganisation(orgName, existingOrganisations)) engagementResolvable++;
      else issues.push({ sheet: worklistSheet?.sheetName || 'Worklist', row: index + 4, severity: 'ERROR', message: `Worklist organisation could not be resolved: "${orgName || '(blank)'}".` });
      const date = dateValue(row[Object.keys(row).find((key) => cleanKey(key) === 'engagementdate') || '']);
      if (!date) {
        invalidDates++;
        issues.push({ sheet: worklistSheet?.sheetName || 'Worklist', row: index + 4, severity: 'ERROR', message: 'EngagementDate is missing or invalid.' });
      }
    });

    const oppSheet = parsed.sheets.find((sheet) => sheet.type === 'OPPORTUNITIES');
    const oppRows = oppSheet ? parsed.rows.get(oppSheet.sheetName) || [] : [];
    let opportunityResolvable = 0;
    let unresolvedAccountManager = 0;
    let invalidValue = 0;
    oppRows.forEach((row, index) => {
      const client = findField(row, ['Client', 'Entity', 'Organisation', 'OrganisationName', 'Company']);
      if (matchOrganisation(client, existingOrganisations)) opportunityResolvable++;
      else issues.push({ sheet: oppSheet?.sheetName || 'Opportunities', row: index + 4, severity: 'ERROR', message: `Opportunity organisation could not be resolved: "${client || '(blank)'}".` });

      const am = findField(row, ['AM_Assigned', 'AccountManager', 'AccountManagerName']);
      if (am && !matchUser(am, users)) {
        unresolvedAccountManager++;
        issues.push({ sheet: oppSheet?.sheetName || 'Opportunities', row: index + 4, severity: 'WARNING', message: `Account Manager "${am}" does not match a Hub user.` });
      }
      const rawValue = findField(row, ['Estimated Deal Size', 'EstimatedValue', 'DealValue', 'Amount', 'Value']);
      if (rawValue && Number.isNaN(Number(rawValue.replace(/[^0-9.-]/g, '')))) {
        invalidValue++;
        issues.push({ sheet: oppSheet?.sheetName || 'Opportunities', row: index + 4, severity: 'ERROR', message: `Estimated deal size is not numeric: "${rawValue}".` });
      }
    });

    const businessSheets = parsed.sheets.filter((sheet) => ['TARGETS', 'CONTACTS', 'WORKLIST', 'OPPORTUNITIES'].includes(sheet.type));
    const unknownSheets = parsed.sheets.filter((sheet) => sheet.type === 'UNKNOWN');
    unknownSheets.forEach((sheet) => issues.push({ sheet: sheet.sheetName, row: 1, severity: 'WARNING', message: 'Worksheet was not recognised and will not be imported.' }));

    return {
      fileName,
      sheets: parsed.sheets,
      organisations,
      contacts: { total: contactRows.length, resolvable: contactResolvable, unresolvedOrganisation: contactUnresolved, hierarchyResolvable },
      engagements: { total: worklistRows.length, resolvableOrganisation: engagementResolvable, invalidDate: invalidDates },
      opportunities: { total: oppRows.length, resolvableOrganisation: opportunityResolvable, unresolvedAccountManager, invalidValue },
      issues,
      readyForReview: businessSheets.length > 0 && !issues.some((issue) => issue.severity === 'ERROR'),
    };
  },
};
