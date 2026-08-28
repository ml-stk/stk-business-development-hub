import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleProtectedRoute } from './components/auth/RoleProtectedRoute';

import { LoginPage } from './pages/LoginPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';

import { DashboardPage } from './pages/DashboardPage';
import { OrganisationsPage } from './pages/OrganisationsPage';
import { OrganisationDetailPage } from './pages/OrganisationDetailPage';
import { ContactsPage } from './pages/ContactsPage';
import { EngagementsPage } from './pages/EngagementsPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { WorklistPage } from './pages/WorklistPage';
import { ReportsPage } from './pages/ReportsPage';

import { UsersPage } from './pages/admin/UsersPage';
import { MasterDataPage } from './pages/admin/MasterDataPage';
import { DataImportPage } from './pages/admin/DataImportPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* =========================================================
                PUBLIC AUTH ROUTES
               ========================================================= */}

            <Route
              path="/login"
              element={<LoginPage />}
            />

            {/* =========================================================
                PROTECTED APPLICATION ROUTES
               ========================================================= */}

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DashboardPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/worklist"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <WorklistPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/organisations"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <OrganisationsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/organisations/:id"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <OrganisationDetailPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ContactsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/engagements"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EngagementsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/opportunities"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <OpportunitiesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* =========================================================
                REPORTS
                Available to:
                - ADMIN
                - BDM_MANAGER
                - BDM
               ========================================================= */}

            <Route
              path="/reports"
              element={
                <RoleProtectedRoute
                  allowedRoles={[
                    'BDM',
                    'BDM_MANAGER',
                    'ADMIN',
                  ]}
                >
                  <AppLayout>
                    <ReportsPage />
                  </AppLayout>
                </RoleProtectedRoute>
              }
            />

            {/* =========================================================
                ADMINISTRATION / GOVERNANCE
               ========================================================= */}

            {/* User administration: ADMIN only */}
            <Route
              path="/admin/users"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN']}
                >
                  <AppLayout>
                    <UsersPage />
                  </AppLayout>
                </RoleProtectedRoute>
              }
            />

            {/* Master data: ADMIN only */}
            <Route
              path="/admin/master-data"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN']}
                >
                  <AppLayout>
                    <MasterDataPage />
                  </AppLayout>
                </RoleProtectedRoute>
              }
            />

            {/* Data import: ADMIN only
                Bulk import can create/modify large numbers of
                business records and therefore remains an admin
                function. */}
            <Route
              path="/admin/import"
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN']}
                >
                  <AppLayout>
                    <DataImportPage />
                  </AppLayout>
                </RoleProtectedRoute>
              }
            />

            {/* =========================================================
                AUTHENTICATED ACCESS DENIED PAGE
               ========================================================= */}

            <Route
              path="/access-denied"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AccessDeniedPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* =========================================================
                FALLBACK
               ========================================================= */}

            <Route
              path="*"
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}