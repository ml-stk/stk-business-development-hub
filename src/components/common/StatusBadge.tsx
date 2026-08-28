import React from 'react';
import {
  OrgStatus,
  OrgCategory,
  EngagementStatus,
  TaskStatus,
  OpportunityStatus,
  PipelineStage,
} from '../../types';

interface BadgeProps {
  label?: string;
  variant?:
    | 'neutral'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'purple'
    | 'amber';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  const colorMap: Record<
    NonNullable<BadgeProps['variant']>,
    string
  > = {
    neutral:
      'bg-[#123B5D] text-[#B7C8D5] border-[#2F86B8]/30',

    success:
      'bg-emerald-500/10 text-emerald-300 border-emerald-400/30',

    warning:
      'bg-amber-500/10 text-amber-300 border-amber-400/30',

    danger:
      'bg-rose-500/10 text-rose-300 border-rose-400/30',

    info:
      'bg-[#1F5F8B]/50 text-[#8FD7E6] border-[#2F86B8]/50',

    purple:
      'bg-[#243B73]/50 text-[#B7C7FF] border-[#5B78C4]/40',

    amber:
      'bg-orange-500/10 text-orange-300 border-orange-400/30',
  };

  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={[
        'inline-flex items-center font-medium rounded-lg border whitespace-nowrap',
        'backdrop-blur-xs',
        colorMap[variant],
        sizeClass,
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
};

export const OrgStatusBadge: React.FC<{
  status: OrgStatus;
}> = ({ status }) => {
  const config: Record<
    OrgStatus,
    {
      label: string;
      variant: BadgeProps['variant'];
    }
  > = {
    ACTIVE: {
      label: 'Active Target',
      variant: 'success',
    },

    ON_HOLD: {
      label: 'On Hold',
      variant: 'warning',
    },

    INACTIVE: {
      label: 'Inactive',
      variant: 'neutral',
    },

    ARCHIVED: {
      label: 'Archived',
      variant: 'danger',
    },
  };

  const c =
    config[status] || {
      label: status,
      variant: 'neutral',
    };

  return (
    <Badge
      label={c.label}
      variant={c.variant}
    />
  );
};

export const OrgCategoryBadge: React.FC<{
  category: OrgCategory;
}> = ({ category }) => {
  const isPrimary =
    category === 'PRIMARY';

  return (
    <Badge
      label={
        isPrimary
          ? 'Primary Target'
          : 'Secondary'
      }
      variant={
        isPrimary
          ? 'purple'
          : 'neutral'
      }
    />
  );
};

export const TaskStatusBadge: React.FC<{
  status: TaskStatus;
}> = ({ status }) => {
  const config: Record<
    TaskStatus,
    {
      label: string;
      variant: BadgeProps['variant'];
    }
  > = {
    OPEN: {
      label: 'Open',
      variant: 'info',
    },

    IN_PROGRESS: {
      label: 'In Progress',
      variant: 'warning',
    },

    COMPLETED: {
      label: 'Completed',
      variant: 'success',
    },

    CANCELLED: {
      label: 'Cancelled',
      variant: 'neutral',
    },
  };

  const c =
    config[status] || {
      label: status,
      variant: 'neutral',
    };

  return (
    <Badge
      label={c.label}
      variant={c.variant}
    />
  );
};

export const OpportunityStatusBadge: React.FC<{
  status: OpportunityStatus;
}> = ({ status }) => {
  const config: Record<
    OpportunityStatus,
    {
      label: string;
      variant: BadgeProps['variant'];
    }
  > = {
    OPEN: {
      label: 'Active Pipeline',
      variant: 'info',
    },

    WON: {
      label: 'Won',
      variant: 'success',
    },

    LOST: {
      label: 'Lost',
      variant: 'danger',
    },

    UNCONVERTED: {
      label: 'Unconverted',
      variant: 'neutral',
    },
  };

  const c =
    config[status] || {
      label: status,
      variant: 'neutral',
    };

  return (
    <Badge
      label={c.label}
      variant={c.variant}
    />
  );
};

export const PipelineStageBadge: React.FC<{
  stage: PipelineStage;
}> = ({ stage }) => {
  const map: Record<
    PipelineStage,
    {
      label: string;
      variant: BadgeProps['variant'];
    }
  > = {
    IDENTIFIED: {
      label: 'Identified',
      variant: 'neutral',
    },

    QUALIFIED: {
      label: 'Qualified',
      variant: 'info',
    },

    DISCOVERY: {
      label: 'Discovery',
      variant: 'info',
    },

    SOLUTION_DEVELOPMENT: {
      label: 'Solution Dev',
      variant: 'purple',
    },

    PROPOSAL: {
      label: 'Proposal',
      variant: 'warning',
    },

    NEGOTIATION: {
      label: 'Negotiation',
      variant: 'amber',
    },

    CLOSED: {
      label: 'Closed',
      variant: 'success',
    },
  };

  const c =
    map[stage] || {
      label: stage,
      variant: 'neutral',
    };

  return (
    <Badge
      label={c.label}
      variant={c.variant}
    />
  );
};

export const EngagementStatusBadge: React.FC<{
  status: EngagementStatus;
}> = ({ status }) => {
  const map: Record<
    EngagementStatus,
    {
      label: string;
      variant: BadgeProps['variant'];
    }
  > = {
    OPEN: {
      label: 'Open',
      variant: 'info',
    },

    IN_PROGRESS: {
      label: 'In Progress',
      variant: 'warning',
    },

    COMPLETED: {
      label: 'Completed',
      variant: 'success',
    },

    CLOSED: {
      label: 'Closed',
      variant: 'neutral',
    },

    ON_HOLD: {
      label: 'On Hold',
      variant: 'amber',
    },
  };

  const c =
    map[status] || {
      label: status,
      variant: 'neutral',
    };

  return (
    <Badge
      label={c.label}
      variant={c.variant}
    />
  );
};

export { PriorityBadge } from './PriorityBadge';