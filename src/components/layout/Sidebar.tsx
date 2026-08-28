import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Building2,
  Users,
  CalendarDays,
  TrendingUp,
  BarChart3,
  Settings,
  UploadCloud,
  Layers,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen,
  onCloseMobile,
}) => {
  const {
    isBDMManager,
    isAdmin,
  } = useAuth();

  const mainNav = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      to: '/worklist',
      label: 'My Worklist',
      icon: CheckSquare,
    },
    {
      to: '/organisations',
      label: 'Organisations',
      icon: Building2,
    },
    {
      to: '/contacts',
      label: 'Contacts',
      icon: Users,
    },
    {
      to: '/engagements',
      label: 'Engagements',
      icon: CalendarDays,
    },
    {
      to: '/opportunities',
      label: 'Opportunities',
      icon: TrendingUp,
    },
    {
      to: '/reports',
      label: 'Reports',
      icon: BarChart3,
    },
  ];

  const adminNav = [
    {
      to: '/admin/users',
      label: 'User Management',
      icon: Users,
    },
    {
      to: '/admin/master-data',
      label: 'Master Data & Settings',
      icon: Settings,
    },
    {
      to: '/admin/import',
      label: 'Data Import & Migration',
      icon: UploadCloud,
    },
  ];

  const showAdminSection =
    isAdmin || isBDMManager;

  const navigationItemClasses = (
    isActive: boolean
  ) =>
    [
      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group border',
      isActive
        ? 'bg-[#1F5F8B] text-white border-[#2F86B8] shadow-sm'
        : 'text-[#B7C8D5] border-transparent hover:text-white hover:bg-[#123B5D]',
    ].join(' ');

  const iconClasses = (
    isActive: boolean
  ) =>
    [
      'w-4 h-4 shrink-0 transition-colors',
      isActive
        ? 'text-[#49BFAE]'
        : 'text-[#7FA4BB] group-hover:text-[#B7C8D5]',
    ].join(' ');

  const content = (
    <div className="flex flex-col h-full bg-[#0E2A47] text-[#B7C8D5] border-r border-[#24465F]">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#24465F] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1F5F8B] flex items-center justify-center text-white shadow-lg shadow-black/20 border border-[#2F86B8]">
            <Layers className="w-4 h-4" />
          </div>

          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-tight">
              STK Hub
            </h1>

            <p className="text-[10px] text-[#8EA5B5] font-medium tracking-wide">
              Targets & Engagements
            </p>
          </div>
        </div>

        {mobileOpen && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-[#8EA5B5] hover:text-white hover:bg-[#123B5D] lg:hidden cursor-pointer transition-colors"
            title="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Main Operations */}
        <div>
          <span className="px-3 text-[10px] font-bold text-[#7FA4BB] uppercase tracking-wider block mb-2">
            Main Operations
          </span>

          <nav className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    navigationItemClasses(isActive)
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={iconClasses(isActive)}
                      />

                      <span className="truncate">
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Administration */}
        {showAdminSection && (
          <div>
            <span className="px-3 text-[10px] font-bold text-[#7FA4BB] uppercase tracking-wider block mb-2">
              Administration & Governance
            </span>

            <nav className="space-y-1">
              {adminNav.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      navigationItemClasses(isActive)
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={iconClasses(isActive)}
                        />

                        <span className="truncate">
                          {item.label}
                        </span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[#24465F] bg-[#0B2034]">
        <div className="flex items-center justify-between text-xs px-2 py-1">
          <span className="text-[11px] text-[#8EA5B5]">
            STK BD Hub v2.5
          </span>

          <span className="inline-flex items-center gap-1.5 text-[10px] text-[#49BFAE] bg-[#123B5D] px-2 py-0.5 rounded-full border border-[#2F86B8]/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[#49BFAE] animate-pulse" />
            Live Cloud
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:fixed lg:inset-y-0 z-30">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#071521]/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />

          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0E2A47] z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};