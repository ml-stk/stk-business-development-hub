import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

export const AccessDeniedPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-[#131317] border border-amber-500/20 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Access Denied</h2>
          <p className="text-xs text-neutral-400 mt-1">
            You do not have the required permissions to access this page.
          </p>
        </div>

        <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs text-neutral-300 text-left space-y-1">
          <div>
            <span className="text-neutral-500 font-medium">Your Role: </span>
            <strong className="text-amber-300 font-semibold">{currentUser?.role || 'BDM'}</strong>
          </div>
          <div>
            <span className="text-neutral-500 font-medium">Account: </span>
            <span className="text-white">{currentUser?.email}</span>
          </div>
        </div>

        <p className="text-[11px] text-neutral-400">
          If you believe you should have access to this resource, please request elevated permissions from an STK Hub Administrator.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-semibold text-xs rounded-xl border border-white/10 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-md"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
