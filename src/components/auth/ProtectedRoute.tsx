import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ShieldAlert,
  LogOut,
  Loader2,
  Layers,
} from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
}) => {
  const {
    currentUser,
    firebaseUser,
    loading,
    logout,
  } = useAuth();

  const location = useLocation();

  /*
   * Wait until Firebase authentication state and the
   * corresponding Firestore user profile have been resolved.
   *
   * A valid Firebase session by itself is NOT sufficient
   * for application access.
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 text-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
            <Layers className="w-5 h-5" />
          </div>

          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              STK Business Development Hub
            </h1>

            <p className="text-xs text-neutral-400">
              Authenticating secure session...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 px-3.5 py-2 rounded-xl border border-indigo-500/20">
          <Loader2 className="w-4 h-4 animate-spin" />

          <span>
            Verifying security credentials &amp; user permissions
          </span>
        </div>
      </div>
    );
  }

  /*
   * Fail closed.
   *
   * A protected route requires BOTH:
   *
   * 1. A valid Firebase Authentication session
   * 2. A valid Firestore application user profile
   *
   * If Firebase authentication exists but the Firestore profile
   * cannot be established, the user must NOT be granted access.
   */
  if (!firebaseUser || !currentUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  /*
   * The Firestore user profile is the authoritative application
   * access state. Inactive users must never be allowed through.
   */
  if (currentUser.active !== true) {
    return (
      <div className="min-h-screen bg-[#09090b] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#131317] border border-rose-500/20 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-base font-bold text-white">
                Account Deactivated
              </h2>

              <p className="text-xs text-neutral-400">
                Access to STK BD Hub has been suspended
              </p>
            </div>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed">
            Your user account (
            <strong>{currentUser.email}</strong>) is currently
            deactivated. Please contact an STK Hub Administrator
            to reactivate your access.
          </p>

          <div className="pt-2">
            <button
              onClick={() => {
                void logout();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-semibold text-xs rounded-xl border border-rose-500/30 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * At this point:
   *
   * - Firebase authentication exists
   * - Firestore user profile exists
   * - User is active
   *
   * Firestore Security Rules remain the authoritative data-access
   * boundary. This component only controls application routing.
   */
  return <>{children}</>;
};