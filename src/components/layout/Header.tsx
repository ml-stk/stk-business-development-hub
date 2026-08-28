import React, { useEffect, useState } from 'react';
import {
  Menu,
  CheckCircle2,
  Database,
} from 'lucide-react';
import { PersonaSwitcher } from './PersonaSwitcher';
import { NotificationDropdown } from './NotificationDropdown';
import {
  collection,
  getDocs,
  limit,
  query,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
}) => {
  const [toastMessage, setToastMessage] =
    useState<string | null>(null);

  const [dbStatus, setDbStatus] =
    useState<
      'checking' | 'connected' | 'offline'
    >('checking');

  useEffect(() => {
    let mounted = true;

    const checkConnection = async () => {
      try {
        await getDocs(
          query(
            collection(db, 'settings'),
            limit(1)
          )
        );

        if (mounted) {
          setDbStatus('connected');
        }
      } catch (error) {
        console.warn(
          'Firestore connectivity check failed:',
          error
        );

        if (mounted) {
          setDbStatus('offline');
        }
      }
    };

    void checkConnection();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * Kept available for future non-destructive system
   * notifications without reintroducing demo tooling.
   */
  const triggerToast = (message: string) => {
    setToastMessage(message);

    window.setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  void triggerToast;

  return (
    <>
      <header className="sticky top-0 z-20 bg-[#123B5D] border-b border-[#24465F] px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-lg shadow-black/10">
        {/* Left: Mobile Menu & Application Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl text-[#B7C8D5] hover:text-white hover:bg-[#1F5F8B] transition-colors cursor-pointer"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:block min-w-0">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#49BFAE] shadow-sm shadow-[#49BFAE]/40" />
              STK Business Development Hub
            </div>

            <p className="text-[11px] text-[#B7C8D5] font-medium truncate">
              Targets • Engagements • Opportunities • Insights
            </p>
          </div>
        </div>

        {/* Right: Status, Notifications, User */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Firestore Connection Badge */}
          <div
            className={[
              'hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border',
              dbStatus === 'connected'
                ? 'bg-[#0E2A47] border-[#2F86B8]/40 text-[#49BFAE]'
                : dbStatus === 'offline'
                ? 'bg-rose-950/30 border-rose-400/30 text-rose-300'
                : 'bg-[#0E2A47] border-[#24465F] text-[#8EA5B5]',
            ].join(' ')}
          >
            <span
              className={[
                'w-1.5 h-1.5 rounded-full',
                dbStatus === 'connected'
                  ? 'bg-[#49BFAE] animate-pulse'
                  : dbStatus === 'offline'
                  ? 'bg-rose-400'
                  : 'bg-[#7FA4BB] animate-pulse',
              ].join(' ')}
            />

            <Database
              className={[
                'w-3 h-3',
                dbStatus === 'connected'
                  ? 'text-[#49BFAE]'
                  : dbStatus === 'offline'
                  ? 'text-rose-300'
                  : 'text-[#7FA4BB]',
              ].join(' ')}
            />

            <span>
              {dbStatus === 'connected'
                ? 'Firestore: Connected'
                : dbStatus === 'offline'
                ? 'Firestore: Offline'
                : 'Firestore: Checking'}
            </span>
          </div>

          <div className="h-5 w-px bg-[#24465F]" />

          {/* Notifications */}
          <NotificationDropdown />

          {/* User / Persona */}
          <PersonaSwitcher />
        </div>
      </header>

      {/* System Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#0E2A47] text-white text-xs font-medium px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200 border border-[#2F86B8]/50">
          <CheckCircle2 className="w-4 h-4 text-[#49BFAE] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};