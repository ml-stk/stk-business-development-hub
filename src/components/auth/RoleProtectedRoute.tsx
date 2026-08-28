import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { ProtectedRoute } from './ProtectedRoute';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const RoleProtectedRoute: React.FC<
  RoleProtectedRouteProps
> = ({ children, allowedRoles }) => {
  const {
    currentUser,
    loading,
    hasRole,
  } = useAuth();

  /*
   * ProtectedRoute establishes:
   *
   * - Firebase authentication
   * - Firestore profile existence
   * - active account state
   *
   * Wait here as well rather than accidentally evaluating
   * role state during initialization.
   */
  if (loading) {
    return null;
  }

  return (
    <ProtectedRoute>
      {currentUser && hasRole(allowedRoles) ? (
        children
      ) : (
        <Navigate
          to="/access-denied"
          replace
        />
      )}
    </ProtectedRoute>
  );
};