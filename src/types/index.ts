export type UserRole = 'BDM' | 'ACCOUNT_MANAGER' | 'BDM_MANAGER' | 'ADMIN';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  jobTitle: string;
  department: string;
  active: boolean;
  photoURL?: string | null;
  createdAt: string; // ISO string or timestamp
  updatedAt: string;
}

export type OrgCategory = 'PRIMARY' | 'SECONDARY';
export type OrgPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type OrgStatus = 'ACTIVE' | 'ON_HOLD' | 'INACTIVE' | 'ARCHIVED';

export interface Organisation {
  id: string;
  name: string;
  aliases: string[];
  category: OrgCategory;
  sector: string;
  priority: OrgPriority;
  status: OrgStatus;
  assignedBDMId: string | null;
  location: string;
  website: string;
  description: string;
  notes: string;
  lastEngagementDate: string | null;
  nextFollowUpDate: string | null;
  createdAt: string;
  createdBy: string; // User UID
  updatedAt: string;
  updatedBy: string; // User UID
  createdByName?: string;
  updatedByName?: string;
}

export type DecisionRole =
  | 'DECISION_MAKER'
  | 'INFLUENCER'
  | 'TECHNICAL_EVALUATOR'
  | 'PROCUREMENT'
  | 'GATEKEEPER'
  | 'USER'
  | 'GENERAL_CONTACT'
  | 'UNKNOWN';

export type InfluenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type RelationshipStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'NEW' | 'UNKNOWN';
export type ContactStatus = 'ACTIVE' | 'INACTIVE';

export interface Contact {
  id: string;
  organisationId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle: string;
  department: string;
  mobile: string;
  landline: string;
  email: string;
  gender: string | null;
  reportsToContactId: string | null;
  decisionRole: DecisionRole;
  influenceLevel: InfluenceLevel;
  relationshipStrength: RelationshipStrength;
  status: ContactStatus;
  notes: string;
  createdAt: string;
  createdBy: string; // User UID
  updatedAt: string;
  updatedBy: string; // User UID
  createdByName?: string;
  updatedByName?: string;
}

export type EngagementType =
  | 'EMAIL'
  | 'PHONE_CALL'
  | 'SMS'
  | 'MEETING_ONSITE'
  | 'MEETING_EVENT'
  | 'MEETING_COFFEE'
  | 'LINKEDIN'
  | 'VIDEO_CONFERENCE'
  | 'OTHER';

export type EngagementPurpose =
  | 'BUSINESS_INTRODUCTION'
  | 'CONTACT_ESTABLISHMENT'
  | 'MEET_AND_GREET'
  | 'FOLLOW_UP'
  | 'REFERRAL'
  | 'DISCOVERY'
  | 'OPPORTUNITY_DISCUSSION'
  | 'PROPOSAL_DISCUSSION'
  | 'OTHER';

export type EngagementStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'ON_HOLD';

export interface Engagement {
  id: string;
  organisationId: string;
  contactId: string | null;
  assignedTo: string; // User UID
  engagementType: EngagementType;
  engagementDate: string; // ISO string
  purpose: EngagementPurpose;
  details: string;
  outcome: string;
  status: EngagementStatus;
  engagementCycle: number | null;
  engagementCycleDescription: string | null;
  nextEngagementDate: string | null; // ISO string
  createdAt: string;
  createdBy: string; // User UID
  updatedAt: string;
  updatedBy: string; // User UID
  createdByName?: string;
  updatedByName?: string;
  assignedToName?: string;
}

export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Task {
  id: string;
  organisationId: string;
  contactId: string | null;
  engagementId: string | null;
  opportunityId: string | null;
  assignedTo: string; // User UID
  title: string;
  description: string;
  dueDate: string; // ISO string
  priority: TaskPriority;
  status: TaskStatus;
  completedDate: string | null;
  completedBy: string | null; // User UID
  createdAt: string;
  createdBy: string; // User UID
  updatedAt: string;
  updatedBy: string; // User UID
  createdByName?: string;
  updatedByName?: string;
  assignedToName?: string;
  completedByName?: string;
}

export type OpportunityStatus = 'OPEN' | 'WON' | 'LOST' | 'UNCONVERTED';

export type PipelineStage =
  | 'IDENTIFIED'
  | 'QUALIFIED'
  | 'DISCOVERY'
  | 'SOLUTION_DEVELOPMENT'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'CLOSED';

export interface Opportunity {
  id: string;
  organisationId: string;
  contactId: string | null;
  title: string;
  description: string;
  solutionCategory: string;
  discoveredDate: string; // ISO string
  status: OpportunityStatus;
  pipelineStage: PipelineStage;
  estimatedValue: number;
  currency: string;
  bdmOwnerId: string; // User UID
  accountManagerId: string | null; // User UID
  referredDate: string | null;
  closedDate: string | null;
  winReason: string | null;
  lossReason: string | null;
  notes: string;
  createdAt: string;
  createdBy: string; // User UID
  updatedAt: string;
  updatedBy: string; // User UID
  createdByName?: string;
  updatedByName?: string;
  bdmOwnerName?: string;
  accountManagerName?: string;
}

export type NotificationType =
  | 'TASK_OVERDUE'
  | 'TASK_DUE_TODAY'
  | 'FOLLOW_UP_DUE'
  | 'OPPORTUNITY_UPDATE'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType: 'organisation' | 'task' | 'engagement' | 'opportunity' | 'contact' | 'system';
  relatedEntityId: string;
  read: boolean;
  createdAt: string;
}

export interface MasterSetting {
  id: string;
  key: string;
  label: string;
  values: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface DynamicWorklistItem extends Task {
  daysRemaining: number;
  isOverdue: boolean;
  organisationName?: string;
  contactName?: string;
  assignedUserName?: string;
  opportunityTitle?: string;
}

export interface HierarchyNode {
  contact: Contact;
  children: HierarchyNode[];
}
