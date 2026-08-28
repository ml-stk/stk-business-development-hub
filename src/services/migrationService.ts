import * as XLSX from 'xlsx';
import { Organisation, Contact, Engagement, Opportunity, Task } from '../types';
import { organisationService, calculateSimilarity, normalizeString } from './organisationService';
import { contactService } from './contactService';
import { engagementService } from './engagementService';
import { opportunityService } from './opportunityService';
import { taskService } from './taskService';

export interface ParsedWorksheet {
  sheetName: string;
  recognizedType: 'TARGETS' | 'CONTACTS' | 'WORKLIST' | 'OPPORTUNITIES' | 'UNKNOWN';
  headers: string[];
  rows: Record<string, any>[];
}

export interface WorkbookParseResult {
  fileName: string;
  sheets: ParsedWorksheet[];
}

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

export const migrationService = {
  /**
   * Parse XLSX Workbook or CSV from ArrayBuffer or raw text
   */
  parseWorkbook(data: ArrayBuffer | string, fileName: string): WorkbookParseResult {
    let workbook: XLSX.WorkBook;

    if (typeof data === 'string') {
      workbook = XLSX.read(data, { type: 'string' });
    } else {
      workbook = XLSX.read(data, { type: 'array' });
    }

    const sheets: ParsedWorksheet[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: '',
        raw: false,
      });

      if (jsonRows.length === 0) return;

      const headers = Object.keys(jsonRows[0] || {});
      const normSheet = sheetName.toLowerCase().replace(/[^a-z0-9]/g, '');

      let recognizedType: ParsedWorksheet['recognizedType'] = 'UNKNOWN';

      if (
        normSheet.includes('target') ||
        normSheet.includes('organisation') ||
        normSheet.includes('org') ||
        headers.some((h) => /org|target|company|client/i.test(h) && /category|sector|priority/i.test(h))
      ) {
        recognizedType = 'TARGETS';
      } else if (
        normSheet.includes('cmdchain') ||
        normSheet.includes('commandchain') ||
        normSheet.includes('contact') ||
        normSheet.includes('stakeholder') ||
        normSheet.includes('heatmap') ||
        headers.some((h) => /reportsto|decisionrole|influence/i.test(h))
      ) {
        recognizedType = 'CONTACTS';
      } else if (
        normSheet.includes('worklist') ||
        normSheet.includes('task') ||
        normSheet.includes('engagement') ||
        headers.some((h) => /duedate|engagementtype|purpose|action/i.test(h))
      ) {
        recognizedType = 'WORKLIST';
      } else if (
        normSheet.includes('opp') ||
        normSheet.includes('sales') ||
        normSheet.includes('referral') ||
        normSheet.includes('deal') ||
        headers.some((h) => /estimatedvalue|pipelinestage|solution/i.test(h))
      ) {
        recognizedType = 'OPPORTUNITIES';
      }

      sheets.push({
        sheetName,
        recognizedType,
        headers,
        rows: jsonRows,
      });
    });

    return { fileName, sheets };
  },

  /**
   * Helper to find matching string key case-insensitively
   */
  getField(row: Record<string, any>, possibleKeys: string[]): string {
    const rowKeys = Object.keys(row);
    for (const target of possibleKeys) {
      const match = rowKeys.find(
        (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === target.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      if (match && row[match] !== undefined && row[match] !== null) {
        return String(row[match]).trim();
      }
    }
    return '';
  },

  /**
   * Normalize an Organisation name for matching
   */
  normalizeOrgName(name: string): string {
    return normalizeString(name);
  },

  /**
   * Match an Organisation by Exact name, Canonical Alias, or High Similarity
   */
  matchOrganisation(rawName: string, existingOrgs: Organisation[]): Organisation | null {
    if (!rawName) return null;
    const cleanRaw = this.normalizeOrgName(rawName);

    // Exact name match
    const exact = existingOrgs.find((o) => this.normalizeOrgName(o.name) === cleanRaw);
    if (exact) return exact;

    // Alias match
    const aliasMatch = existingOrgs.find((o) =>
      o.aliases.some((alias) => this.normalizeOrgName(alias) === cleanRaw)
    );
    if (aliasMatch) return aliasMatch;

    // High similarity match (>= 85%)
    let bestMatch: Organisation | null = null;
    let highestSim = 0;
    for (const org of existingOrgs) {
      const sim = calculateSimilarity(cleanRaw, this.normalizeOrgName(org.name));
      if (sim >= 85 && sim > highestSim) {
        highestSim = sim;
        bestMatch = org;
      }
    }

    return bestMatch;
  },

  /**
   * Execute Full 13-Step Automated Workbook Migration Workflow
   */
  async executeMigration(
    workbookResult: WorkbookParseResult,
    userId: string,
    userName: string
  ): Promise<MigrationSummaryReport> {
    const report: MigrationSummaryReport = {
      totalSheetsProcessed: 0,
      organisationsCreated: 0,
      organisationsMatched: 0,
      organisationsSkipped: 0,
      contactsCreated: 0,
      contactsHierarchyLinked: 0,
      contactsHierarchyUnresolved: 0,
      engagementsCreated: 0,
      tasksCreated: 0,
      opportunitiesCreated: 0,
      validationErrors: [],
      detailedLogs: [],
    };

    report.detailedLogs.push(`Starting migration for workbook: ${workbookResult.fileName}`);

    // Load existing database entities
    let existingOrgs = await organisationService.getAll();
    let existingContacts = await contactService.getAll();

    // In-memory maps for linking during import
    // Map: legacyOrgNameOrId -> canonical OrgId
    const orgIdMap = new Map<string, string>();
    // Map: legacyContactPidOrName -> new ContactId
    const contactIdMap = new Map<string, string>();
    // Map: new ContactId -> legacy ReportsTo PID / Name
    const contactReportsToPending = new Map<string, string>();

    // Index existing orgs into map
    existingOrgs.forEach((o) => {
      orgIdMap.set(o.id, o.id);
      orgIdMap.set(this.normalizeOrgName(o.name), o.id);
      o.aliases.forEach((a) => orgIdMap.set(this.normalizeOrgName(a), o.id));
    });

    // ----------------------------------------------------
    // STEP 1 & 2: Process TARGETS Worksheet (Organisations)
    // ----------------------------------------------------
    const targetsSheet = workbookResult.sheets.find((s) => s.recognizedType === 'TARGETS');
    if (targetsSheet) {
      report.totalSheetsProcessed++;
      report.detailedLogs.push(`Processing Targets Sheet "${targetsSheet.sheetName}" with ${targetsSheet.rows.length} rows...`);

      for (let i = 0; i < targetsSheet.rows.length; i++) {
        const row = targetsSheet.rows[i];
        const rawName = this.getField(row, ['Name', 'OrganisationName', 'Organisation', 'TargetName', 'Company']);
        const legacyId = this.getField(row, ['ID', 'TargetID', 'OrgID', 'PID', 'Code']);

        if (!rawName) {
          report.validationErrors.push({
            entity: 'Targets',
            row: i + 1,
            error: 'Organisation Name is missing.',
          });
          continue;
        }

        // Check if organisation already exists
        const matched = this.matchOrganisation(rawName, existingOrgs);
        if (matched) {
          report.organisationsMatched++;
          orgIdMap.set(this.normalizeOrgName(rawName), matched.id);
          if (legacyId) orgIdMap.set(legacyId, matched.id);
          report.detailedLogs.push(`Row ${i + 1}: Matched "${rawName}" to existing target "${matched.name}".`);
          continue;
        }

        // Create new organisation
        const categoryRaw = this.getField(row, ['Category', 'Type']).toUpperCase();
        const category = categoryRaw.includes('SEC') ? 'SECONDARY' : 'PRIMARY';

        const priorityRaw = this.getField(row, ['Priority', 'Tier']).toUpperCase();
        const priority = priorityRaw.includes('HIGH') || priorityRaw.includes('P1')
          ? 'HIGH'
          : priorityRaw.includes('LOW') || priorityRaw.includes('P3')
          ? 'LOW'
          : 'MEDIUM';

        const statusRaw = this.getField(row, ['Status']).toUpperCase();
        const status = statusRaw.includes('HOLD')
          ? 'ON_HOLD'
          : statusRaw.includes('INACT') || statusRaw.includes('ARCH')
          ? 'INACTIVE'
          : 'ACTIVE';

        const sector = this.getField(row, ['Sector', 'Industry', 'Vertical']) || 'Commercial & Enterprise';
        const rawAliases = this.getField(row, ['Aliases', 'Alias', 'ShortName', 'Acronym']);
        const aliases = rawAliases
          ? rawAliases.split(/[,;]+/).map((a) => a.trim()).filter(Boolean)
          : [];
        const location = this.getField(row, ['Location', 'City', 'Province', 'Address']) || 'Papua New Guinea';
        const website = this.getField(row, ['Website', 'URL', 'Web']);
        const description = this.getField(row, ['Description', 'Profile', 'Overview']);
        const notes = this.getField(row, ['Notes', 'Commentary', 'StrategicObjective']);

        try {
          const createdOrg = await organisationService.create({
            name: rawName,
            category,
            sector,
            priority,
            status,
            aliases,
            location,
            website,
            description,
            notes,
            assignedBDMId: userId,
            lastEngagementDate: null,
            nextFollowUpDate: null,
            createdBy: userId,
            updatedBy: userId,
            createdByName: userName,
            updatedByName: userName,
          });

          existingOrgs.push(createdOrg);
          orgIdMap.set(this.normalizeOrgName(rawName), createdOrg.id);
          if (legacyId) orgIdMap.set(legacyId, createdOrg.id);
          report.organisationsCreated++;
          report.detailedLogs.push(`Row ${i + 1}: Created new organisation "${rawName}" (ID: ${createdOrg.id}).`);
        } catch (err: any) {
          report.validationErrors.push({
            entity: 'Targets',
            row: i + 1,
            error: `Failed to write organisation: ${err.message}`,
          });
        }
      }
    }

    // ----------------------------------------------------
    // STEP 3 & 4: Process CONTACTS Worksheet (CmdChainHeatMap)
    // ----------------------------------------------------
    const contactsSheet = workbookResult.sheets.find((s) => s.recognizedType === 'CONTACTS');
    if (contactsSheet) {
      report.totalSheetsProcessed++;
      report.detailedLogs.push(`Processing Contacts Sheet "${contactsSheet.sheetName}" with ${contactsSheet.rows.length} rows...`);

      // PASS 1: Create Contact records
      for (let i = 0; i < contactsSheet.rows.length; i++) {
        const row = contactsSheet.rows[i];
        const fullName = this.getField(row, ['FullName', 'Name', 'ContactName', 'Contact', 'Stakeholder']);
        const firstName = this.getField(row, ['FirstName', 'GivenName']);
        const lastName = this.getField(row, ['LastName', 'Surname', 'FamilyName']);
        const legacyPid = this.getField(row, ['PID', 'ContactID', 'ID', 'StakeholderID', 'Code']);
        const legacyReportsTo = this.getField(row, ['ReportsToPID', 'ReportsTo', 'ManagerPID', 'ReportsToName', 'Supervisor']);

        const orgNameOrId = this.getField(row, ['OrganisationName', 'Organisation', 'TargetName', 'Company', 'OrgID', 'TargetID']);
        let targetOrgId = '';

        if (orgNameOrId) {
          targetOrgId = orgIdMap.get(orgNameOrId) || orgIdMap.get(this.normalizeOrgName(orgNameOrId)) || '';
          if (!targetOrgId) {
            const match = this.matchOrganisation(orgNameOrId, existingOrgs);
            if (match) targetOrgId = match.id;
          }
        }

        if (!targetOrgId && existingOrgs.length > 0) {
          targetOrgId = existingOrgs[0].id;
        }

        if (!fullName && !firstName) {
          report.validationErrors.push({
            entity: 'Contacts',
            row: i + 1,
            error: 'Contact FullName / FirstName is required.',
          });
          continue;
        }

        const computedFullName = fullName || `${firstName} ${lastName}`.trim();
        const parts = computedFullName.split(' ');
        const finalFirstName = firstName || parts[0] || 'Stakeholder';
        const finalLastName = lastName || parts.slice(1).join(' ') || '';

        const jobTitle = this.getField(row, ['JobTitle', 'Title', 'Role', 'Position']) || 'Stakeholder';
        const department = this.getField(row, ['Department', 'Division', 'Unit', 'Dept']) || 'Executive';
        const email = this.getField(row, ['Email', 'EmailAddress', 'WorkEmail']);
        const mobile = this.getField(row, ['Mobile', 'Phone', 'Cell', 'Telephone']);
        const landline = this.getField(row, ['Landline', 'OfficePhone', 'DirectLine']);

        const decisionRoleRaw = this.getField(row, ['DecisionRole', 'RoleInDecision', 'InfluenceType']).toUpperCase();
        const decisionRole = decisionRoleRaw.includes('DECISION') || decisionRoleRaw.includes('MAKER')
          ? 'DECISION_MAKER'
          : decisionRoleRaw.includes('TECH')
          ? 'TECHNICAL_EVALUATOR'
          : decisionRoleRaw.includes('PROC') || decisionRoleRaw.includes('BUY')
          ? 'PROCUREMENT'
          : decisionRoleRaw.includes('GATE')
          ? 'GATEKEEPER'
          : decisionRoleRaw.includes('USER')
          ? 'USER'
          : 'INFLUENCER';

        const influenceRaw = this.getField(row, ['InfluenceLevel', 'Influence', 'Power']).toUpperCase();
        const influenceLevel = influenceRaw.includes('HIGH') || influenceRaw.includes('H')
          ? 'HIGH'
          : influenceRaw.includes('LOW') || influenceRaw.includes('L')
          ? 'LOW'
          : 'MEDIUM';

        const relationRaw = this.getField(row, ['RelationshipStrength', 'Relationship', 'Sentiment']).toUpperCase();
        const relationshipStrength = relationRaw.includes('STRONG')
          ? 'STRONG'
          : relationRaw.includes('WEAK')
          ? 'WEAK'
          : relationRaw.includes('NEW')
          ? 'NEW'
          : 'MODERATE';

        try {
          const createdContact = await contactService.create({
            organisationId: targetOrgId,
            firstName: finalFirstName,
            lastName: finalLastName,
            jobTitle,
            department,
            email,
            mobile,
            landline,
            gender: null,
            decisionRole,
            influenceLevel,
            relationshipStrength,
            status: 'ACTIVE',
            reportsToContactId: null, // Linked in pass 2
            notes: this.getField(row, ['Notes', 'Comments']),
            createdBy: userId,
            updatedBy: userId,
            createdByName: userName,
            updatedByName: userName,
          });

          existingContacts.push(createdContact);
          report.contactsCreated++;

          if (legacyPid) contactIdMap.set(legacyPid, createdContact.id);
          contactIdMap.set(computedFullName.toLowerCase(), createdContact.id);

          if (legacyReportsTo) {
            contactReportsToPending.set(createdContact.id, legacyReportsTo);
          }

          report.detailedLogs.push(`Row ${i + 1}: Created contact "${computedFullName}" for org ${targetOrgId}.`);
        } catch (err: any) {
          report.validationErrors.push({
            entity: 'Contacts',
            row: i + 1,
            error: `Failed to create contact: ${err.message}`,
          });
        }
      }

      // PASS 2: Resolve ReportsTo Hierarchy
      report.detailedLogs.push(`Resolving command chain hierarchy for ${contactReportsToPending.size} contacts...`);
      for (const [contactId, legacyParentRef] of contactReportsToPending.entries()) {
        const parentContactId =
          contactIdMap.get(legacyParentRef) ||
          contactIdMap.get(legacyParentRef.toLowerCase()) ||
          existingContacts.find((c) => c.fullName.toLowerCase() === legacyParentRef.toLowerCase())?.id;

        if (parentContactId && parentContactId !== contactId) {
          try {
            await contactService.update(contactId, { reportsToContactId: parentContactId });
            report.contactsHierarchyLinked++;
          } catch (e) {
            report.contactsHierarchyUnresolved++;
          }
        } else {
          report.contactsHierarchyUnresolved++;
          report.detailedLogs.push(`Could not resolve supervisor reference "${legacyParentRef}" for contact ID ${contactId}.`);
        }
      }
    }

    // ----------------------------------------------------
    // STEP 5 & 6: Process WORKLIST Worksheet (Engagements & Tasks)
    // ----------------------------------------------------
    const worklistSheet = workbookResult.sheets.find((s) => s.recognizedType === 'WORKLIST');
    if (worklistSheet) {
      report.totalSheetsProcessed++;
      report.detailedLogs.push(`Processing Worklist Sheet "${worklistSheet.sheetName}" with ${worklistSheet.rows.length} rows...`);

      for (let i = 0; i < worklistSheet.rows.length; i++) {
        const row = worklistSheet.rows[i];
        const orgNameOrId = this.getField(row, ['OrganisationName', 'Organisation', 'TargetName', 'Company', 'OrgID']);
        let targetOrgId = orgNameOrId ? orgIdMap.get(orgNameOrId) || orgIdMap.get(this.normalizeOrgName(orgNameOrId)) || '' : '';

        if (!targetOrgId && existingOrgs.length > 0) {
          const match = this.matchOrganisation(orgNameOrId, existingOrgs);
          targetOrgId = match ? match.id : existingOrgs[0].id;
        }

        const title = this.getField(row, ['Title', 'Task', 'Subject', 'ActionItem', 'Engagement', 'Activity']) || 'Follow-Up Task';
        const dateRaw = this.getField(row, ['Date', 'EngagementDate', 'DueDate', 'FollowUpDate', 'Schedule']);
        const validDate = dateRaw && !isNaN(Date.parse(dateRaw)) ? new Date(dateRaw).toISOString() : new Date().toISOString();
        const details = this.getField(row, ['Details', 'Description', 'Notes', 'Minutes']) || title;
        const outcome = this.getField(row, ['Outcome', 'Result', 'Deliverable']) || '';

        try {
          // Log Engagement
          await engagementService.create({
            organisationId: targetOrgId,
            contactId: null,
            engagementType: 'MEETING_ONSITE',
            engagementDate: validDate,
            purpose: 'FOLLOW_UP',
            details,
            outcome,
            status: 'COMPLETED',
            nextEngagementDate: null,
            engagementCycle: null,
            engagementCycleDescription: null,
            assignedTo: userId,
            createdBy: userId,
            updatedBy: userId,
            createdByName: userName,
            updatedByName: userName,
          });
          report.engagementsCreated++;

          // Create corresponding Follow-Up Task
          await taskService.create({
            organisationId: targetOrgId,
            contactId: null,
            engagementId: null,
            opportunityId: null,
            assignedTo: userId,
            title,
            description: details,
            dueDate: validDate,
            priority: 'MEDIUM',
            status: 'OPEN',
            createdBy: userId,
            updatedBy: userId,
            createdByName: userName,
            updatedByName: userName,
          });
          report.tasksCreated++;
        } catch (err: any) {
          report.validationErrors.push({
            entity: 'Worklist',
            row: i + 1,
            error: `Failed to import worklist item: ${err.message}`,
          });
        }
      }
    }

    // ----------------------------------------------------
    // STEP 7 & 8: Process OPPORTUNITIES Worksheet
    // ----------------------------------------------------
    const oppsSheet = workbookResult.sheets.find((s) => s.recognizedType === 'OPPORTUNITIES');
    if (oppsSheet) {
      report.totalSheetsProcessed++;
      report.detailedLogs.push(`Processing Opportunities Sheet "${oppsSheet.sheetName}" with ${oppsSheet.rows.length} rows...`);

      for (let i = 0; i < oppsSheet.rows.length; i++) {
        const row = oppsSheet.rows[i];
        const title = this.getField(row, ['Title', 'OpportunityName', 'Deal', 'Opportunity', 'Scope']);
        if (!title) {
          report.validationErrors.push({
            entity: 'Opportunities',
            row: i + 1,
            error: 'Opportunity Title is required.',
          });
          continue;
        }

        const orgNameOrId = this.getField(row, ['OrganisationName', 'Organisation', 'TargetName', 'Company', 'OrgID']);
        let targetOrgId = orgNameOrId ? orgIdMap.get(orgNameOrId) || orgIdMap.get(this.normalizeOrgName(orgNameOrId)) || '' : '';
        if (!targetOrgId && existingOrgs.length > 0) {
          const match = this.matchOrganisation(orgNameOrId, existingOrgs);
          targetOrgId = match ? match.id : existingOrgs[0].id;
        }

        const rawVal = this.getField(row, ['EstimatedValue', 'Value', 'DealValue', 'Amount', 'Budget']);
        const estimatedValue = parseFloat(rawVal.replace(/[^0-9.-]+/g, '')) || 0;
        const currency = this.getField(row, ['Currency', 'Curr']) || 'PGK';
        const solutionCategory = this.getField(row, ['SolutionCategory', 'Solution', 'Category', 'Product']) || 'Cloud & Data Centre Solutions';

        const stageRaw = this.getField(row, ['PipelineStage', 'Stage']).toUpperCase();
        const pipelineStage = stageRaw.includes('QUAL')
          ? 'QUALIFIED'
          : stageRaw.includes('DISC')
          ? 'DISCOVERY'
          : stageRaw.includes('SOL')
          ? 'SOLUTION_DEVELOPMENT'
          : stageRaw.includes('PROP')
          ? 'PROPOSAL'
          : stageRaw.includes('NEG')
          ? 'NEGOTIATION'
          : stageRaw.includes('CLOSE')
          ? 'CLOSED'
          : 'IDENTIFIED';

        const statusRaw = this.getField(row, ['Status']).toUpperCase();
        const status = statusRaw.includes('WON')
          ? 'WON'
          : statusRaw.includes('LOST')
          ? 'LOST'
          : statusRaw.includes('UNCONV')
          ? 'UNCONVERTED'
          : 'OPEN';

        try {
          await opportunityService.create({
            organisationId: targetOrgId,
            contactId: null,
            title,
            solutionCategory,
            estimatedValue,
            currency,
            pipelineStage,
            status,
            discoveredDate: new Date().toISOString(),
            description: this.getField(row, ['Description', 'ScopeOfWork', 'Overview']),
            notes: this.getField(row, ['Notes', 'Comments']),
            accountManagerId: null,
            referredDate: null,
            closedDate: status === 'WON' || status === 'LOST' ? new Date().toISOString() : null,
            winReason: status === 'WON' ? 'Successfully converted from migration import' : null,
            lossReason: status === 'LOST' ? 'Imported as historical lost opportunity' : null,
            bdmOwnerId: userId,
            createdBy: userId,
            updatedBy: userId,
            createdByName: userName,
            updatedByName: userName,
          });

          report.opportunitiesCreated++;
        } catch (err: any) {
          report.validationErrors.push({
            entity: 'Opportunities',
            row: i + 1,
            error: `Failed to import opportunity: ${err.message}`,
          });
        }
      }
    }

    report.detailedLogs.push('Migration workflow execution completed.');
    return report;
  },
};
