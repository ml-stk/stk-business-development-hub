import React, { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconBgColor?: string;
  iconTextColor?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-[#1F5F8B]',
  iconTextColor = 'text-[#49BFAE]',
  trend,
  onClick,
  className = '',
}) => {
  return (
    <div
      onClick={onClick}
      className={[
        'relative overflow-hidden bg-[#123B5D] rounded-2xl border border-[#24465F] p-5 shadow-lg transition-all duration-200',
        onClick
          ? 'cursor-pointer hover:border-[#2F86B8] hover:bg-[#1F5F8B]/80 hover:-translate-y-0.5'
          : '',
        className,
      ].join(' ')}
    >
      {/* Subtle top highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#49BFAE]/40 to-transparent" />

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[#B7C8D5] uppercase tracking-wider">
          {title}
        </span>

        <div
          className={[
            'w-10 h-10 rounded-xl flex items-center justify-center border border-[#2F86B8]/40 shrink-0',
            iconBgColor,
            iconTextColor,
          ].join(' ')}
        >
          {icon}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white tracking-tight">
          {value}
        </span>

        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.isPositive
                ? 'text-[#49BFAE]'
                : 'text-rose-300'
            }`}
          >
            {trend.value} {trend.label}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-[#8EA5B5]">
          {subtitle}
        </p>
      )}
    </div>
  );
};