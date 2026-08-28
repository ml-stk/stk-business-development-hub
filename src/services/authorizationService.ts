import {
  UserProfile,
  Organisation,
  Contact,
  Engagement,
  Task,
  Opportunity,
  UserRole,
} from '../types';

/**
 * STK Business Development Hub
 * Frontend Authorization Policy
 *
 * IMPORTANT:
 * This service controls UI behaviour only.
 *
 * It determines whether buttons, controls, actions, and workflows
 * should be presented to the current user.
 *
 * Firebase Authentication + Firestore Security Rules remain the
 * authoritative security boundary.
 */

/* ================================================================
   ROLE HELPERS
   ================================================================ */

export const isAdmin = (
  user: UserProfile | null | undefined
): boolean => user?.active === true && user.role === 'ADMIN';

export const isBDMManager = (
  user: UserProfile | null | undefined
): boolean =>
  user?.active === true && user.role === 'BDM_MANAGER';

export const isBDM = (
  user: UserProfile | null | undefined
): boolean => user?.active === true && user.role === 'BDM';

export const isAccountManager = (
  user: UserProfile | null | undefined
): boolean =>
  user?.active === true &&
  user.role === 'ACCOUNT_MANAGER';

export const isManagerOrAdmin = (
  user: UserProfile | null | undefined
): boolean =>
  isAdmin(user) || isBDMManager(user);

export const isActiveUser = (
  user: UserProfile | null | undefined
): boolean => user?.active === true;

/**
 * Checks whether the user has one of the specified application roles.
 *
 * ADMIN is treated as having access to all role-gated UI features.
 *
 * This is NOT a Firestore authorization mechanism.
 */
export const hasRole = (
  user: UserProfile | null | undefined,
  roles: UserRole[]
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  return roles.includes(user!.role);
};

/* ================================================================
   ORGANISATIONS
   ================================================================ */

/**
 * All active users may view organisations.
 */
export const canViewOrganisation = (
  user: UserProfile | null | undefined,
  _organisation?: Organisation
): boolean => {
  return isActiveUser(user);
};

/**
 * ADMIN and BDM_MANAGER can create organisations.
 *
 * BDMs can create:
 * - an organisation assigned to themselves
 * - an intentionally unassigned organisation
 */
export const canCreateOrganisation = (
  user: UserProfile | null | undefined,
  assignedBDMId?: string | null
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isManagerOrAdmin(user)) {
    return true;
  }

  return (
    isBDM(user) &&
    (
      assignedBDMId === undefined ||
      assignedBDMId === null ||
      assignedBDMId === user!.uid
    )
  );
};

/**
 * ADMIN and BDM_MANAGER can edit/reassign any organisation.
 *
 * BDM can edit an organisation only when it is assigned to them.
 */
export const canEditOrganisation = (
  user: UserProfile | null | undefined,
  organisation: Organisation
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isManagerOrAdmin(user)) {
    return true;
  }

  return (
    isBDM(user) &&
    organisation.assignedBDMId === user!.uid
  );
};

/**
 * Only management roles can change BDM ownership.
 */
export const canReassignOrganisation = (
  user: UserProfile | null | undefined,
  _organisation?: Organisation
): boolean => {
  return isManagerOrAdmin(user);
};

/**
 * Only management roles can delete organisations.
 */
export const canDeleteOrganisation = (
  user: UserProfile | null | undefined,
  _organisation?: Organisation
): boolean => {
  return isManagerOrAdmin(user);
};

/* ================================================================
   CONTACTS
   ================================================================ */

/**
 * All active users may view contacts under the shared
 * customer-intelligence model.
 */
export const canViewContact = (
  user: UserProfile | null | undefined,
  _contact?: Contact
): boolean => {
  return isActiveUser(user);
};

/**
 * ADMIN, BDM_MANAGER and BDM can create contacts.
 */
export const canCreateContact = (
  user: UserProfile | null | undefined,
  _organisationId?: string
): boolean => {
  return (
    isAdmin(user) ||
    isBDMManager(user) ||
    isBDM(user)
  );
};

/**
 * Active users may edit permitted contact fields.
 *
 * Firestore Rules must continue to enforce that organisationId
 * cannot be changed by unauthorized users.
 */
export const canEditContact = (
  user: UserProfile | null | undefined,
  _contact: Contact
): boolean => {
  return isActiveUser(user);
};

/**
 * Only management roles can delete contacts.
 */
export const canDeleteContact = (
  user: UserProfile | null | undefined,
  _contact?: Contact
): boolean => {
  return isManagerOrAdmin(user);
};

/* ================================================================
   ENGAGEMENTS
   ================================================================ */

/**
 * All active users may view shared engagement history.
 */
export const canViewEngagement = (
  user: UserProfile | null | undefined,
  _engagement?: Engagement
): boolean => {
  return isActiveUser(user);
};

/**
 * Any active authenticated user may create an engagement.
 */
export const canCreateEngagement = (
  user: UserProfile | null | undefined
): boolean => {
  return isActiveUser(user);
};

/**
 * Managers/admins can edit any engagement.
 *
 * The original creator can edit their own engagement.
 */
export const canEditEngagement = (
  user: UserProfile | null | undefined,
  engagement: Engagement
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isManagerOrAdmin(user)) {
    return true;
  }

  return engagement.createdBy === user!.uid;
};

/**
 * Managers/admins or the original creator can delete an engagement.
 */
export const canDeleteEngagement = (
  user: UserProfile | null | undefined,
  engagement: Engagement
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isManagerOrAdmin(user)) {
    return true;
  }

  return engagement.createdBy === user!.uid;
};

/**
 * Engagement ownership/audit information is never editable
 * through normal UI actions.
 */
export const canChangeEngagementOwnership = (
  user: UserProfile | null | undefined,
  _engagement: Engagement
): boolean => {
  return isManagerOrAdmin(user);
};

/* ================================================================
   TASKS / WORKLIST
   ================================================================ */

/**
 * Manager/Admin can view all tasks.
 *
 * Normal users can view tasks they:
 * - are assigned to
 * - created
 */
export const canViewTask = (
  user: UserProfile | null | undefined,
  task: Task
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isManagerOrAdmin(user)) {
    return true;
  }

  return (
    task.assignedTo === user!.uid ||
    task.createdBy === user!.uid
  );
};

/**
 * Manager/Admin can create and assign tasks to others.
 *
 * Normal users can create only self-assigned tasks.
 */
export const canCreateTask = (
  user: UserProfile | null | undefined,
  assignedTo?: string
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isManagerOrAdmin(user)) {
    return true;
  }

  return assignedTo === undefined ||
    assignedTo === user!.uid;
};

/**
 * Manager/Admin may edit any task.
 *
 * Normal users can edit tasks they are assigned to or created,
 * subject to ownership restrictions enforced by Firestore Rules.
 */
export const canEditTask = (
  user: UserProfile | null | undefined,
  task: Task
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isManagerOrAdmin(user)) {
    return true;
  }

  return (
    task.assignedTo === user!.uid ||
    task.createdBy === user!.uid
  );
};

/**
 * Only managers/admins may change task assignment.
 */
export const canAssignTask = (
  user: UserProfile | null | undefined,
  _task?: Task
): boolean => {
  return isManagerOrAdmin(user);
};

/**
 * A task can be completed by an active user who is:
 * - the assignee
 * - the creator
 * - a manager/admin
 */
export const canCompleteTask = (
  user: UserProfile | null | undefined,
  task: Task
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isManagerOrAdmin(user)) {
    return true;
  }

  return (
    task.assignedTo === user!.uid ||
    task.createdBy === user!.uid
  );
};

/**
 * The user completing the task must be represented by their
 * Firebase Auth UID.
 */
export const canSetCompletedBy = (
  user: UserProfile | null | undefined,
  task: Task
): boolean => {
  return canCompleteTask(user, task);
};

/**
 * Managers/admins or the task creator can delete a task.
 */
export const canDeleteTask = (
  user: UserProfile | null | undefined,
  task: Task
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isManagerOrAdmin(user)) {
    return true;
  }

  return task.createdBy === user!.uid;
};

/* ================================================================
   OPPORTUNITIES
   ================================================================ */

/**
 * All active users can view the shared commercial pipeline.
 */
export const canViewOpportunity = (
  user: UserProfile | null | undefined,
  _opportunity?: Opportunity
): boolean => {
  return isActiveUser(user);
};

/**
 * ADMIN and BDM_MANAGER can create an opportunity.
 *
 * BDM can create only where they are the BDM owner.
 */
export const canCreateOpportunity = (
  user: UserProfile | null | undefined,
  bdmOwnerId?: string
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isManagerOrAdmin(user)) {
    return true;
  }

  return (
    isBDM(user) &&
    bdmOwnerId === user!.uid
  );
};

/**
 * Managers/admins can edit any opportunity.
 *
 * BDM can edit their own opportunity.
 * Account Manager can edit an opportunity assigned to them.
 */
export const canEditOpportunity = (
  user: UserProfile | null | undefined,
  opportunity: Opportunity
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (isManagerOrAdmin(user)) {
    return true;
  }

  if (
    isBDM(user) &&
    opportunity.bdmOwnerId === user!.uid
  ) {
    return true;
  }

  if (
    isAccountManager(user) &&
    opportunity.accountManagerId === user!.uid
  ) {
    return true;
  }

  return false;
};

/**
 * Only management roles can reassign BDM ownership.
 */
export const canReassignOpportunityBDM = (
  user: UserProfile | null | undefined,
  _opportunity?: Opportunity
): boolean => {
  return isManagerOrAdmin(user);
};

/**
 * Only management roles can arbitrarily reassign an Account Manager.
 *
 * This keeps handover authority outside the normal AM role.
 */
export const canAssignAccountManager = (
  user: UserProfile | null | undefined,
  _opportunity?: Opportunity
): boolean => {
  return isManagerOrAdmin(user);
};

/**
 * An assigned Account Manager may work on their opportunity,
 * but does not receive ownership-reassignment authority.
 */
export const canManageAssignedOpportunity = (
  user: UserProfile | null | undefined,
  opportunity: Opportunity
): boolean => {
  return (
    isAccountManager(user) &&
    opportunity.accountManagerId === user!.uid
  );
};

/**
 * Only managers/admins can delete opportunities.
 */
export const canDeleteOpportunity = (
  user: UserProfile | null | undefined,
  _opportunity?: Opportunity
): boolean => {
  return isManagerOrAdmin(user);
};

/**
 * Opportunity closure actions.
 *
 * The frontend can use this to control whether the close action
 * is presented. Firestore Rules independently validate:
 *
 * WON:
 *   closedDate + winReason
 *
 * LOST:
 *   closedDate + lossReason
 */
export const canCloseOpportunity = (
  user: UserProfile | null | undefined,
  opportunity: Opportunity
): boolean => {
  return canEditOpportunity(user, opportunity);
};

/* ================================================================
   USER ADMINISTRATION
   ================================================================ */

/**
 * Only ADMIN can view administrative user-management controls.
 */
export const canManageUsers = (
  user: UserProfile | null | undefined
): boolean => {
  return isAdmin(user);
};

/**
 * Only ADMIN can change user roles.
 */
export const canChangeUserRole = (
  user: UserProfile | null | undefined,
  targetUser?: UserProfile
): boolean => {
  if (!isAdmin(user)) {
    return false;
  }

  return Boolean(targetUser);
};

/**
 * Only ADMIN can activate/deactivate other users.
 *
 * Prevent frontend from presenting a self-deactivation workflow.
 * Firestore Rules provide the actual enforcement.
 */
export const canChangeUserActiveStatus = (
  user: UserProfile | null | undefined,
  targetUser: UserProfile
): boolean => {
  if (!isAdmin(user)) {
    return false;
  }

  return targetUser.uid !== user!.uid;
};

/* ================================================================
   MASTER DATA / SETTINGS
   ================================================================ */

/**
 * Only ADMIN can modify master data and application settings.
 */
export const canManageSettings = (
  user: UserProfile | null | undefined
): boolean => {
  return isAdmin(user);
};

/**
 * All active users can read settings/master data.
 */
export const canViewSettings = (
  user: UserProfile | null | undefined
): boolean => {
  return isActiveUser(user);
};

/* ================================================================
   DATA IMPORT / MIGRATION
   ================================================================ */

/**
 * Bulk data import can materially modify business records.
 *
 * Keep this ADMIN-only for the current application architecture.
 */
export const canRunDataImport = (
  user: UserProfile | null | undefined
): boolean => {
  return isAdmin(user);
};

/**
 * Data integrity audit is read-only but exposes sensitive
 * administrative data-quality information.
 *
 * Keep execution restricted to ADMIN.
 */
export const canRunDataIntegrityAudit = (
  user: UserProfile | null | undefined
): boolean => {
  return isAdmin(user);
};

/* ================================================================
   REPORTING
   ================================================================ */

/**
 * Current reporting policy:
 *
 * ADMIN
 * BDM_MANAGER
 * BDM
 *
 * Account Managers do not receive the management reporting area
 * by default.
 */
export const canViewReports = (
  user: UserProfile | null | undefined
): boolean => {
  return hasRole(user, [
    'ADMIN',
    'BDM_MANAGER',
    'BDM',
  ]);
};

/**
 * Management-level reports.
 */
export const canViewManagementReports = (
  user: UserProfile | null | undefined
): boolean => {
  return (
    isAdmin(user) ||
    isBDMManager(user)
  );
};

/* ================================================================
   GENERIC UI HELPERS
   ================================================================ */

/**
 * Determines whether a destructive action should be shown.
 *
 * Convenience helper for shared components.
 */
export const canDelete = (
  user: UserProfile | null | undefined,
  options: {
    adminOnly?: boolean;
    managerOrAdmin?: boolean;
    ownerId?: string | null;
  } = {}
): boolean => {
  if (!isActiveUser(user)) {
    return false;
  }

  if (
    options.adminOnly === true
  ) {
    return isAdmin(user);
  }

  if (
    options.managerOrAdmin === true
  ) {
    return isManagerOrAdmin(user);
  }

  if (
    options.ownerId &&
    options.ownerId === user!.uid
  ) {
    return true;
  }

  return false;
};

export const authorizationService = {
  isAdmin,
  isBDMManager,
  isBDM,
  isAccountManager,
  isManagerOrAdmin,
  isActiveUser,
  hasRole,
  canViewOrganisation,
  canCreateOrganisation,
  canEditOrganisation,
  canReassignOrganisation,
  canDeleteOrganisation,
  canViewContact,
  canCreateContact,
  canEditContact,
  canDeleteContact,
  canViewEngagement,
  canCreateEngagement,
  canEditEngagement,
  canDeleteEngagement,
  canChangeEngagementOwnership,
  canViewTask,
  canCreateTask,
  canEditTask,
  canAssignTask,
  canCompleteTask,
  canSetCompletedBy,
  canDeleteTask,
  canViewOpportunity,
  canCreateOpportunity,
  canEditOpportunity,
  canReassignOpportunityBDM,
  canAssignAccountManager,
  canManageAssignedOpportunity,
  canDeleteOpportunity,
  canCloseOpportunity,
  canManageUsers,
  canChangeUserRole,
  canChangeUserActiveStatus,
  canManageSettings,
  canViewSettings,
  canRunDataImport,
  canRunDataIntegrityAudit,
  canViewReports,
  canViewManagementReports,
  canDelete,
};

export default authorizationService;
