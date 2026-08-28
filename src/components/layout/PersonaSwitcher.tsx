import React, {
  useState,
  useRef,
  useEffect,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAuth,
} from '../../contexts/AuthContext';
import {
  UserRoleBadge,
} from '../common/PriorityBadge';
import {
  ChevronDown,
  Check,
  UserCheck,
  Shield,
  LogOut,
  Briefcase,
  Building,
  Key,
} from 'lucide-react';
import { AuthModal } from '../auth/AuthModal';

export const PersonaSwitcher: React.FC = () => {
  const {
    currentUser,
    firebaseUser,
    allUsers,
    switchPersona,
    logout,
  } = useAuth();

  const [isOpen, setIsOpen] =
    useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] =
    useState(false);

  const dropdownRef =
    useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  /*
   * Close the account menu when the user clicks
   * outside of it.
   */
  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, []);

  /*
   * No authenticated application profile means
   * there is no account menu to render.
   */
  if (!currentUser) {
    return null;
  }

  const handleSignOut =
    async () => {
      setIsOpen(false);

      await logout();

      navigate('/login', {
        replace: true,
      });
    };

  return (
    <>
      <div
        className="relative"
        ref={dropdownRef}
      >
        {/* Account Button */}
        <button
          type="button"
          onClick={() =>
            setIsOpen((open) => !open)
          }
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-[#2F86B8]/40 bg-[#0E2A47] hover:bg-[#1F5F8B] transition-all shadow-md text-left cursor-pointer"
          title="Account profile and security"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <div className="relative">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName}
                className="w-7 h-7 rounded-full object-cover border border-[#2F86B8]/50"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#1F5F8B] text-[#B7E7F0] font-bold text-xs flex items-center justify-center border border-[#2F86B8]/50">
                {currentUser.displayName
                  ?.charAt(0)
                  .toUpperCase() || 'U'}
              </div>
            )}

            <span
              className={[
                'absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-[#0E2A47]',
                firebaseUser
                  ? 'bg-[#49BFAE]'
                  : 'bg-amber-400',
              ].join(' ')}
            />
          </div>

          <div className="hidden sm:block text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white leading-tight">
                {currentUser.displayName}
              </span>

              <UserRoleBadge
                role={currentUser.role}
              />
            </div>

            <span className="text-[11px] text-[#B7C8D5] block truncate max-w-[150px]">
              {currentUser.email ||
                currentUser.jobTitle}
            </span>
          </div>

          <ChevronDown
            className={[
              'w-4 h-4 shrink-0 transition-transform text-[#9DB7C5]',
              isOpen
                ? 'rotate-180'
                : '',
            ].join(' ')}
          />
        </button>

        {/* Account Dropdown */}
        {isOpen && (
          <div
            className="absolute right-0 mt-2 w-72 bg-[#0B2034] rounded-2xl shadow-2xl border border-[#2F86B8]/40 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-xl"
            role="menu"
          >
            {/* User Profile */}
            <div className="px-4 py-3 border-b border-[#24465F] bg-[#0E2A47]">
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName}
                    className="w-10 h-10 rounded-full object-cover border border-[#2F86B8]/50 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#1F5F8B] text-[#B7E7F0] font-bold text-sm flex items-center justify-center border border-[#2F86B8]/50 shrink-0">
                    {currentUser.displayName
                      ?.charAt(0)
                      .toUpperCase() || 'U'}
                  </div>
                )}

                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {currentUser.displayName}
                  </h4>

                  <p className="text-[11px] text-[#9DB7C5] truncate">
                    {currentUser.email}
                  </p>

                  <div className="mt-1">
                    <UserRoleBadge
                      role={currentUser.role}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#24465F] text-[11px] text-[#9DB7C5] space-y-1">
                <div className="flex items-center gap-1.5 truncate">
                  <Briefcase className="w-3 h-3 text-[#7FA4BB] shrink-0" />
                  <span className="truncate">
                    {currentUser.jobTitle ||
                      'Specialist'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 truncate">
                  <Building className="w-3 h-3 text-[#7FA4BB] shrink-0" />
                  <span className="truncate">
                    {currentUser.department ||
                      'Business Development'}
                  </span>
                </div>
              </div>
            </div>

            {/* Account Authentication & Security */}
            <div className="px-3 py-2 border-b border-[#24465F]">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsAuthModalOpen(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#123B5D] hover:bg-[#1F5F8B] border border-[#2F86B8]/30 text-[#D4E1E8] text-xs font-medium transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#49BFAE]" />
                  <span>
                    Account & Auth Security
                  </span>
                </div>

                <Key className="w-3.5 h-3.5 text-[#7FA4BB]" />
              </button>
            </div>

            {/*
             * Development-only persona switching.
             *
             * This block is compiled out of the production build
             * by Vite because import.meta.env.DEV is false in
             * production.
             *
             * It does not modify Firebase Authentication.
             * It remains available only for local development.
             */}
            {import.meta.env.DEV &&
              allUsers.length > 0 && (
                <div className="border-b border-[#24465F]">
                  <div className="px-3.5 py-1.5 bg-amber-500/10 border-b border-amber-500/20">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      <UserCheck className="w-3 h-3" />
                      Dev Impersonation (Local Only)
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto py-1">
                    {allUsers.map(
                      (user) => {
                        const isSelected =
                          user.uid ===
                          currentUser.uid;

                        return (
                          <button
                            type="button"
                            key={user.uid}
                            onClick={() => {
                              switchPersona(
                                user
                              );
                              setIsOpen(
                                false
                              );
                            }}
                            className={[
                              'w-full text-left px-3.5 py-1.5 flex items-center justify-between gap-2 hover:bg-[#123B5D] transition-colors cursor-pointer',
                              isSelected
                                ? 'bg-[#1F5F8B]/40'
                                : '',
                            ].join(' ')}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="text-xs font-medium text-white truncate">
                                {
                                  user.displayName
                                }
                              </span>

                              <UserRoleBadge
                                role={
                                  user.role
                                }
                              />
                            </div>

                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-[#49BFAE] shrink-0" />
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

            {/* Sign Out */}
            <div className="p-2">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() =>
          setIsAuthModalOpen(false)
        }
      />
    </>
  );
};