import React from 'react';
import { UserRole } from '../../../shared/types';
import { Crown, ShieldCheck, User, Eye } from 'lucide-react';

interface RoleBadgeProps {
  role: UserRole;
  showIcon?: boolean;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, showIcon = true }) => {
  const getBadgeStyle = () => {
    switch (role) {
      case 'host':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          label: 'HOST',
          icon: <Crown className="w-3 h-3 text-amber-400" />,
        };
      case 'moderator':
        return {
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          label: 'MOD',
          icon: <ShieldCheck className="w-3 h-3 text-blue-400" />,
        };
      case 'participant':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          label: 'MEMBER',
          icon: <User className="w-3 h-3 text-emerald-400" />,
        };
      case 'viewer':
      default:
        return {
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
          label: 'VIEWER',
          icon: <Eye className="w-3 h-3 text-slate-400" />,
        };
    }
  };

  const style = getBadgeStyle();

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${style.bg}`}
    >
      {showIcon && style.icon}
      <span>{style.label}</span>
    </span>
  );
};
