import React from 'react';
import { OrgPriority, TaskPriority, DecisionRole, InfluenceLevel, RelationshipStrength, UserRole } from '../../types';
import { Badge } from './StatusBadge';

export const PriorityBadge: React.FC<{ priority: OrgPriority | TaskPriority }> = ({ priority }) => {
  const map = {
    HIGH: { label: 'High Priority', variant: 'danger' as const },
    MEDIUM: { label: 'Medium Priority', variant: 'warning' as const },
    LOW: { label: 'Low Priority', variant: 'neutral' as const },
  };
  const c = map[priority] || { label: priority, variant: 'neutral' as const };
  return <Badge label={c.label} variant={c.variant} />;
};

export const DecisionRoleBadge: React.FC<{ role: DecisionRole }> = ({ role }) => {
  const map: Record<DecisionRole, { label: string; variant: 'danger' | 'purple' | 'info' | 'amber' | 'neutral' | 'success' }> = {
    DECISION_MAKER: { label: 'Decision Maker', variant: 'purple' },
    INFLUENCER: { label: 'Influencer', variant: 'info' },
    TECHNICAL_EVALUATOR: { label: 'Tech Evaluator', variant: 'amber' },
    PROCUREMENT: { label: 'Procurement', variant: 'warning' as any },
    GATEKEEPER: { label: 'Gatekeeper', variant: 'danger' },
    USER: { label: 'End User', variant: 'neutral' },
    GENERAL_CONTACT: { label: 'General Contact', variant: 'neutral' },
    UNKNOWN: { label: 'Unknown', variant: 'neutral' },
  };
  const c = map[role] || { label: role.replace(/_/g, ' '), variant: 'neutral' };
  return <Badge label={c.label} variant={c.variant as any} />;
};

export const InfluenceBadge: React.FC<{ level: InfluenceLevel }> = ({ level }) => {
  const map: Record<InfluenceLevel, { label: string; variant: 'danger' | 'warning' | 'neutral' }> = {
    HIGH: { label: 'High Influence', variant: 'danger' },
    MEDIUM: { label: 'Med Influence', variant: 'warning' },
    LOW: { label: 'Low Influence', variant: 'neutral' },
    UNKNOWN: { label: 'Unknown', variant: 'neutral' },
  };
  const c = map[level] || { label: level, variant: 'neutral' };
  return <Badge label={c.label} variant={c.variant} />;
};

export const RelationshipBadge: React.FC<{ strength: RelationshipStrength }> = ({ strength }) => {
  const map: Record<RelationshipStrength, { label: string; variant: 'success' | 'info' | 'warning' | 'neutral' }> = {
    STRONG: { label: 'Strong Bond', variant: 'success' },
    MODERATE: { label: 'Moderate', variant: 'info' },
    WEAK: { label: 'Weak', variant: 'warning' },
    NEW: { label: 'New Contact', variant: 'purple' as any },
    UNKNOWN: { label: 'Unknown', variant: 'neutral' },
  };
  const c = map[strength] || { label: strength, variant: 'neutral' };
  return <Badge label={c.label} variant={c.variant} />;
};

export const UserRoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
  const map: Record<UserRole, { label: string; variant: 'purple' | 'info' | 'amber' | 'neutral' | 'success' }> = {
    BDM: { label: 'BDM', variant: 'purple' },
    ACCOUNT_MANAGER: { label: 'Account Manager', variant: 'info' },
    BDM_MANAGER: { label: 'BDM Manager', variant: 'amber' },
    ADMIN: { label: 'Administrator', variant: 'danger' as any },
  };
  const c = map[role] || { label: role, variant: 'neutral' };
  return <Badge label={c.label} variant={c.variant as any} />;
};
