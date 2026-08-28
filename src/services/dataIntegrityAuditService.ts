import { collection, getDocs, DocumentData } from 'firebase/firestore';
import { db } from '../config/firebase';

export type AuditSeverity = 'ERROR' | 'WARNING';

export interface DataIntegrityFinding {
  severity: AuditSeverity;
  collection: string;
  documentId: string;
  field?: string;
  message: string;
  value?: unknown;
}

export interface DataIntegrityAuditIssue {
  collection: string;
  documentId: string;
  field: string;
  message: string;
}

export interface DataIntegrityAuditSummary {
  totalIssues: number;
  errors: number;
  warnings: number;
  collectionsScanned: number;
  documentsScanned: number;
}

export interface DataIntegrityAuditReport {
  generatedAt: string;
  completedAt: string;
  collectionsScanned: number;
  documentsScanned: number;
  errors: number;
  warnings: number;
  findings: DataIntegrityFinding[];
  issues: DataIntegrityAuditIssue[];
  summary: DataIntegrityAuditSummary;
  collectionCounts: Record<string, number>;
}

export type DataIntegrityAuditResult = DataIntegrityAuditReport;

const AUDIT_COLLECTIONS = [
  'users',
  'organisations',
  'contacts',
  'engagements',
  'tasks',
  'opportunities',
  'notifications',
  'settings',
] as const;

type AuditCollection = (typeof AUDIT_COLLECTIONS)[number];

const USER_REFERENCE_FIELDS: Record<string, string[]> = {
  organisations: ['assignedBDMId', 'createdBy', 'updatedBy'],
  contacts: ['createdBy', 'updatedBy'],
  engagements: ['assignedTo', 'createdBy', 'updatedBy'],
  tasks: ['assignedTo', 'completedBy', 'createdBy', 'updatedBy'],
  opportunities: [
    'bdmOwnerId',
    'accountManagerId',
    'createdBy',
    'updatedBy',
  ],
  notifications: ['userId'],
};

const AUDIT_FIELDS: Record<string, string[]> = {
  organisations: ['createdBy', 'updatedBy'],
  contacts: ['createdBy', 'updatedBy'],
  engagements: ['createdBy', 'updatedBy'],
  tasks: ['createdBy', 'updatedBy'],
  opportunities: ['createdBy', 'updatedBy'],
};

function normalized(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function addFinding(
  findings: DataIntegrityFinding[],
  severity: AuditSeverity,
  collectionName: string,
  documentId: string,
  message: string,
  field?: string,
  value?: unknown
) {
  findings.push({
    severity,
    collection: collectionName,
    documentId,
    field,
    message,
    value,
  });
}

export const dataIntegrityAuditService = {
  async run(): Promise<DataIntegrityAuditReport> {
    const generatedAt = new Date().toISOString();
    const findings: DataIntegrityFinding[] = [];
    const collectionCounts: Record<string, number> = {};

    const snapshots = new Map<
      AuditCollection,
      Awaited<ReturnType<typeof getDocs>>
    >();

    // ============================================================
    // 1. Read all collections in read-only audit mode
    // ============================================================
    for (const collectionName of AUDIT_COLLECTIONS) {
      try {
        const snapshot = await getDocs(collection(db, collectionName));

        snapshots.set(collectionName, snapshot);
        collectionCounts[collectionName] = snapshot.size;
      } catch (error) {
        addFinding(
          findings,
          'ERROR',
          collectionName,
          '*',
          `Unable to read collection: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // ============================================================
    // 2. Build canonical user UID and display-name lookup maps
    // ============================================================
    const users = snapshots.get('users');

    const userIds = new Set<string>();
    const userNames = new Map<string, string>();

    users?.docs.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;

      const uid = String(data.uid ?? docSnap.id);

      userIds.add(uid);

      // Firestore document ID must match the stored uid field.
      if (docSnap.id !== uid) {
        addFinding(
          findings,
          'ERROR',
          'users',
          docSnap.id,
          'User document ID does not match the stored uid field.',
          'uid',
          data.uid
        );
      }

      // Used to detect display names accidentally stored in UID fields.
      if (data.displayName) {
        userNames.set(normalized(data.displayName), uid);
      }

      // Flag known legacy/demo seed patterns.
      if (/^(bdm|am|mgr|admin)-user-\d+$|^user_\d+$/i.test(uid)) {
        addFinding(
          findings,
          'WARNING',
          'users',
          docSnap.id,
          'UID matches a known synthetic/seed identifier pattern. Confirm this is a real Firebase Authentication UID before production use.',
          'uid',
          uid
        );
      }

      if (!data.email) {
        addFinding(
          findings,
          'WARNING',
          'users',
          docSnap.id,
          'User profile has no email address.',
          'email'
        );
      }

      if (
        ![
          'ADMIN',
          'BDM_MANAGER',
          'BDM',
          'ACCOUNT_MANAGER',
        ].includes(data.role as string)
      ) {
        addFinding(
          findings,
          'ERROR',
          'users',
          docSnap.id,
          'User has an unsupported role.',
          'role',
          data.role
        );
      }
    });

    // ============================================================
    // 3. Validate UID-based ownership and assignment references
    // ============================================================
    const scanUserReference = (
      collectionName: string,
      documentId: string,
      field: string,
      value: unknown
    ) => {
      if (value === null || value === undefined || value === '') {
        return;
      }

      const stringValue = String(value);

      if (!userIds.has(stringValue)) {
        const displayNameUid = userNames.get(normalized(value));

        addFinding(
          findings,
          'ERROR',
          collectionName,
          documentId,
          displayNameUid
            ? 'Field contains a display name instead of a canonical Firebase Authentication UID.'
            : 'Field references a user UID that does not exist in /users.',
          field,
          value
        );
      }
    };

    for (const collectionName of Object.keys(
      USER_REFERENCE_FIELDS
    ) as string[]) {
      const snapshot = snapshots.get(
        collectionName as AuditCollection
      );

      if (!snapshot) {
        continue;
      }

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as DocumentData;

        // Validate all user ownership/assignment references.
        for (const field of USER_REFERENCE_FIELDS[collectionName]) {
          scanUserReference(
            collectionName,
            docSnap.id,
            field,
            data[field]
          );
        }

        // Validate mandatory createdBy / updatedBy fields.
        for (const field of AUDIT_FIELDS[collectionName] ?? []) {
          const value = data[field];

          if (
            value === null ||
            value === undefined ||
            value === ''
          ) {
            addFinding(
              findings,
              'ERROR',
              collectionName,
              docSnap.id,
              'Required audit field is missing.',
              field,
              value
            );
          }
        }
      });
    }

    // ============================================================
    // 4. Validate task completion integrity
    // ============================================================
    const tasks = snapshots.get('tasks');

    tasks?.docs.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;

      if (data.status === 'COMPLETED') {
        if (!data.completedBy) {
          addFinding(
            findings,
            'ERROR',
            'tasks',
            docSnap.id,
            'Completed task is missing completedBy.',
            'completedBy'
          );
        }

        if (!data.completedDate) {
          addFinding(
            findings,
            'ERROR',
            'tasks',
            docSnap.id,
            'Completed task is missing completedDate.',
            'completedDate'
          );
        }
      } else {
        if (
          data.completedBy !== null &&
          data.completedBy !== undefined &&
          data.completedBy !== ''
        ) {
          addFinding(
            findings,
            'ERROR',
            'tasks',
            docSnap.id,
            'Non-completed task contains completedBy metadata.',
            'completedBy',
            data.completedBy
          );
        }

        if (
          data.completedDate !== null &&
          data.completedDate !== undefined &&
          data.completedDate !== ''
        ) {
          addFinding(
            findings,
            'ERROR',
            'tasks',
            docSnap.id,
            'Non-completed task contains completedDate metadata.',
            'completedDate',
            data.completedDate
          );
        }
      }
    });

    // ============================================================
    // 5. Build entity reference lookup sets
    // ============================================================
    const organisations = new Set(
      snapshots
        .get('organisations')
        ?.docs.map((docSnap) => docSnap.id) ?? []
    );

    const contacts = new Set(
      snapshots
        .get('contacts')
        ?.docs.map((docSnap) => docSnap.id) ?? []
    );

    const engagements = new Set(
      snapshots
        .get('engagements')
        ?.docs.map((docSnap) => docSnap.id) ?? []
    );

    const opportunitiesIds = new Set(
      snapshots
        .get('opportunities')
        ?.docs.map((docSnap) => docSnap.id) ?? []
    );

    const scanReference = (
      collectionName: string,
      documentId: string,
      field: string,
      value: unknown,
      validIds: Set<string>
    ) => {
      if (value === null || value === undefined || value === '') {
        return;
      }

      if (!validIds.has(String(value))) {
        addFinding(
          findings,
          'ERROR',
          collectionName,
          documentId,
          'Document references a record that does not exist.',
          field,
          value
        );
      }
    };

    // ============================================================
    // 6. Validate contact references
    // ============================================================
    snapshots.get('contacts')?.docs.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;

      scanReference(
        'contacts',
        docSnap.id,
        'organisationId',
        data.organisationId,
        organisations
      );

      scanReference(
        'contacts',
        docSnap.id,
        'reportsToContactId',
        data.reportsToContactId,
        contacts
      );
    });

    // ============================================================
    // 7. Validate engagement references
    // ============================================================
    snapshots.get('engagements')?.docs.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;

      scanReference(
        'engagements',
        docSnap.id,
        'organisationId',
        data.organisationId,
        organisations
      );

      scanReference(
        'engagements',
        docSnap.id,
        'contactId',
        data.contactId,
        contacts
      );
    });

    // ============================================================
    // 8. Validate task references
    // ============================================================
    snapshots.get('tasks')?.docs.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;

      scanReference(
        'tasks',
        docSnap.id,
        'organisationId',
        data.organisationId,
        organisations
      );

      scanReference(
        'tasks',
        docSnap.id,
        'contactId',
        data.contactId,
        contacts
      );

      scanReference(
        'tasks',
        docSnap.id,
        'engagementId',
        data.engagementId,
        engagements
      );

      scanReference(
        'tasks',
        docSnap.id,
        'opportunityId',
        data.opportunityId,
        opportunitiesIds
      );
    });

    // ============================================================
    // 9. Validate opportunity references
    // ============================================================
    snapshots.get('opportunities')?.docs.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;

      scanReference(
        'opportunities',
        docSnap.id,
        'organisationId',
        data.organisationId,
        organisations
      );

      scanReference(
        'opportunities',
        docSnap.id,
        'contactId',
        data.contactId,
        contacts
      );
    });

    // ============================================================
    // 10. Review settings audit provenance
    // ============================================================
    snapshots.get('settings')?.docs.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;
      const value = data.updatedBy;

      if (value && !userIds.has(String(value))) {
        addFinding(
          findings,
          'WARNING',
          'settings',
          docSnap.id,
          'Settings audit field updatedBy is not a known user UID. Review system/default provenance.',
          'updatedBy',
          value
        );
      }
    });

    // ============================================================
    // 11. Validate opportunity status and closure integrity
    // ============================================================
    const opportunities = snapshots.get('opportunities');

    opportunities?.docs.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;

      if (data.status === 'WON') {
        if (!data.closedDate) {
          addFinding(
            findings,
            'ERROR',
            'opportunities',
            docSnap.id,
            'WON opportunity is missing closedDate.',
            'closedDate'
          );
        }

        if (!data.winReason) {
          addFinding(
            findings,
            'ERROR',
            'opportunities',
            docSnap.id,
            'WON opportunity is missing winReason.',
            'winReason'
          );
        }
      }

      if (data.status === 'LOST') {
        if (!data.closedDate) {
          addFinding(
            findings,
            'ERROR',
            'opportunities',
            docSnap.id,
            'LOST opportunity is missing closedDate.',
            'closedDate'
          );
        }

        if (!data.lossReason) {
          addFinding(
            findings,
            'ERROR',
            'opportunities',
            docSnap.id,
            'LOST opportunity is missing lossReason.',
            'lossReason'
          );
        }
      }

      if (
        !['OPEN', 'WON', 'LOST', 'UNCONVERTED'].includes(
          String(data.status)
        )
      ) {
        addFinding(
          findings,
          'ERROR',
          'opportunities',
          docSnap.id,
          'Opportunity has an unsupported status.',
          'status',
          data.status
        );
      }
    });

    // ============================================================
    // 12. Produce final report
    // ============================================================
    const totalDocuments = Object.values(collectionCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    const errors = findings.filter(
      (finding) => finding.severity === 'ERROR'
    ).length;
    const warnings = findings.filter(
      (finding) => finding.severity === 'WARNING'
    ).length;

    const issues: DataIntegrityAuditIssue[] = findings.map((f) => ({
      collection: f.collection,
      documentId: f.documentId,
      field: f.field || '—',
      message: f.message,
    }));

    const completedAt = new Date().toISOString();

    return {
      generatedAt,
      completedAt,
      collectionsScanned: Object.keys(collectionCounts).length,
      documentsScanned: totalDocuments,
      errors,
      warnings,
      findings,
      issues,
      summary: {
        totalIssues: findings.length,
        errors,
        warnings,
        collectionsScanned: Object.keys(collectionCounts).length,
        documentsScanned: totalDocuments,
      },
      collectionCounts,
    };
  },

  async runAudit(): Promise<DataIntegrityAuditReport> {
    return this.run();
  },
};
