import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string; text?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  message,
  text,
  size = 'md',
}) => {
  const displayMsg = text || message || 'Loading data...';
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Loader2 className={`${sizeMap[size]} text-indigo-400 animate-spin`} />
      {displayMsg && <p className="mt-3 text-xs text-neutral-400 font-medium tracking-wide">{displayMsg}</p>}
    </div>
  );
};
