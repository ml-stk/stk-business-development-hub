import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';

import {
  getApp,
  getApps,
  initializeApp,
} from 'firebase/app';

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  Info,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserRound,
  UserX,
  X,
} from 'lucide-react';

import {
  db,
  auth,
  firebaseConfig,
} from '../../config/firebase';

import { useAuth } from '../../contexts/AuthContext';

import {
  UserProfile,
  UserRole,
} from '../../types';

import {
  dataIntegrityAuditService,
  DataIntegrityAuditResult,
} from '../../services/dataIntegrityAuditService';

type RoleFilter =
  | 'ALL'
  | UserRole;

type StatusFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'INACTIVE';

const ROLE_OPTIONS: UserRole[] = [
  'ADMIN',
  'BDM_MANAGER',
  'BDM',
  'ACCOUNT_MANAGER',
];

const ROLE_LABELS: Record<
  UserRole,
  string
> = {
  ADMIN: 'Administrator',
  BDM_MANAGER: 'BDM Manager',
  BDM: 'Business Development Manager',
  ACCOUNT_MANAGER: 'Account Manager',
};

const ROLE_BADGE_CLASSES: Record<
  UserRole,
  string
> = {
  ADMIN:
    'bg-rose-500/10 text-rose-300 border-rose-500/20',

  BDM_MANAGER:
    'bg-purple-500/10 text-purple-300 border-purple-500/20',

  BDM:
    'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',

  ACCOUNT_MANAGER:
    'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

/*
 * Use a separate Firebase App/Auth instance for administrative
 * account provisioning.
 *
 * This prevents createUserWithEmailAndPassword() from replacing
 * the currently authenticated ADMIN session.
 */
const SECONDARY_APP_NAME =
  'stk-admin-user-provisioning';

const getProvisioningAuth = () => {
  const existingApps = getApps();

  const secondaryApp = existingApps.find(
    (firebaseApp) =>
      firebaseApp.name ===
      SECONDARY_APP_NAME
  );

  const provisioningApp =
    secondaryApp ||
    initializeApp(
      firebaseConfig,
      SECONDARY_APP_NAME
    );

  return getAuth(provisioningApp);
};

const generateTemporaryPassword = (): string => {
  const randomPart =
    Math.random()
      .toString(36)
      .slice(2, 10);

  const timestamp =
    Date.now()
      .toString(36)
      .slice(-6);

  return `STK-${randomPart}-${timestamp}!`;
};

export const UsersPage: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    allUsers,
    refreshUsers,
  } = useAuth();

  const [users, setUsers] =
    useState<UserProfile[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState('');

  const [roleFilter, setRoleFilter] =
    useState<RoleFilter>('ALL');

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ALL');

  const [
    updatingUserId,
    setUpdatingUserId,
  ] =
    useState<string | null>(null);

  const [
    auditRunning,
    setAuditRunning,
  ] =
    useState(false);

  const [
    auditResult,
    setAuditResult,
  ] =
    useState<DataIntegrityAuditResult | null>(
      null
    );

  const [
    auditError,
    setAuditError,
  ] =
    useState<string | null>(null);

  /*
   * ------------------------------------------------------------
   * Create User Modal State
   * ------------------------------------------------------------
   */

  const [
    showCreateUserModal,
    setShowCreateUserModal,
  ] =
    useState(false);

  const [
    createUserLoading,
    setCreateUserLoading,
  ] =
    useState(false);

  const [
    createUserError,
    setCreateUserError,
  ] =
    useState<string | null>(null);

  const [
    createUserSuccess,
    setCreateUserSuccess,
  ] =
    useState<string | null>(null);

  const [
    newUserDisplayName,
    setNewUserDisplayName,
  ] =
    useState('');

  const [
    newUserEmail,
    setNewUserEmail,
  ] =
    useState('');

  const [
    newUserRole,
    setNewUserRole,
  ] =
    useState<UserRole>('BDM');

  const [
    newUserJobTitle,
    setNewUserJobTitle,
  ] =
    useState('');

  const [
    newUserDepartment,
    setNewUserDepartment,
  ] =
    useState('');

  const [
    newUserActive,
    setNewUserActive,
  ] =
    useState(true);

  const [
    sendResetEmail,
    setSendResetEmail,
  ] =
    useState(true);

  const [
    temporaryPassword,
    setTemporaryPassword,
  ] =
    useState<string | null>(null);

  /*
   * Existing user detection and update inside Create modal
   */
  const [
    detectedExistingUser,
    setDetectedExistingUser,
  ] =
    useState<UserProfile | null>(null);

  const [
    updatingExistingFromModal,
    setUpdatingExistingFromModal,
  ] =
    useState(false);

  /*
   * ------------------------------------------------------------
   * Edit User Modal State
   * ------------------------------------------------------------
   */
  const [
    editingUser,
    setEditingUser,
  ] =
    useState<UserProfile | null>(null);

  const [
    showEditUserModal,
    setShowEditUserModal,
  ] =
    useState(false);

  const [
    editDisplayName,
    setEditDisplayName,
  ] =
    useState('');

  const [
    editRole,
    setEditRole,
  ] =
    useState<UserRole>('BDM');

  const [
    editJobTitle,
    setEditJobTitle,
  ] =
    useState('');

  const [
    editDepartment,
    setEditDepartment,
  ] =
    useState('');

  const [
    editActive,
    setEditActive,
  ] =
    useState(true);

  const [
    editLoading,
    setEditLoading,
  ] =
    useState(false);

  const [
    editError,
    setEditError,
  ] =
    useState<string | null>(null);

  const [
    editSuccess,
    setEditSuccess,
  ] =
    useState<string | null>(null);

  /*
   * Inline password reset & toast alerts
   */
  const [
    resetPasswordLoadingEmail,
    setResetPasswordLoadingEmail,
  ] =
    useState<string | null>(null);

  const [
    toastMessage,
    setToastMessage,
  ] =
    useState<{
      type: 'success' | 'error' | 'info';
      text: string;
    } | null>(null);

  /*
   * ------------------------------------------------------------
   * Load Users
   * ------------------------------------------------------------
   */

  const loadUsers = async () => {
    try {
      setLoading(true);

      const snapshot =
        await getDocs(
          collection(
            db,
            'users'
          )
        );

      const firestoreUsers =
        snapshot.docs.map(
          (document) =>
            ({
              uid: document.id,
              ...document.data(),
            }) as UserProfile
        );

      setUsers(
        firestoreUsers.sort(
          (a, b) =>
            a.displayName.localeCompare(
              b.displayName
            )
        )
      );
    } catch (error) {
      console.error(
        'Error loading users from Firestore:',
        error
      );

      setUsers(allUsers);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  /*
   * ------------------------------------------------------------
   * Refresh
   * ------------------------------------------------------------
   */

  const handleRefresh = async () => {
    try {
      setRefreshing(true);

      await refreshUsers();
      await loadUsers();
    } catch (error) {
      console.error(
        'Error refreshing users:',
        error
      );
    } finally {
      setRefreshing(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * Open Create User Modal
   * ------------------------------------------------------------
   */

  const openCreateUserModal = () => {
    if (!isAdmin) {
      return;
    }

    setCreateUserError(null);
    setCreateUserSuccess(null);
    setTemporaryPassword(null);
    setDetectedExistingUser(null);

    setNewUserDisplayName('');
    setNewUserEmail('');
    setNewUserRole('BDM');
    setNewUserJobTitle(
      'Business Development Specialist'
    );
    setNewUserDepartment(
      'Business Development'
    );
    setNewUserActive(true);
    setSendResetEmail(true);

    setShowCreateUserModal(true);
  };

  /*
   * ------------------------------------------------------------
   * Update existing profile directly from the Create User Modal
   * ------------------------------------------------------------
   */
  const handleUpdateExistingFromCreateModal = async () => {
    if (!detectedExistingUser || !isAdmin) {
      return;
    }

    const displayName =
      newUserDisplayName.trim() ||
      detectedExistingUser.displayName;

    const jobTitle =
      newUserJobTitle.trim() ||
      detectedExistingUser.jobTitle ||
      'Business Development Specialist';

    const department =
      newUserDepartment.trim() ||
      detectedExistingUser.department ||
      'Business Development';

    try {
      setUpdatingExistingFromModal(true);
      setCreateUserError(null);
      setCreateUserSuccess(null);

      const now = new Date().toISOString();

      await updateDoc(
        doc(db, 'users', detectedExistingUser.uid),
        {
          displayName,
          role: newUserRole,
          jobTitle,
          department,
          active: newUserActive,
          updatedAt: now,
        }
      );

      let resetNotice = '';
      if (sendResetEmail) {
        try {
          await sendPasswordResetEmail(
            auth,
            detectedExistingUser.email
          );
          resetNotice = ' A password-reset email was sent.';
        } catch (resetErr) {
          console.warn('Password reset failed:', resetErr);
          resetNotice = ' (Password-reset email could not be sent).';
        }
      }

      await refreshUsers();
      await loadUsers();

      setCreateUserSuccess(
        `User profile for "${displayName}" (${detectedExistingUser.email}) was updated successfully.${resetNotice}`
      );
      setDetectedExistingUser(null);
    } catch (err: unknown) {
      console.error('Error updating existing user profile:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update existing user profile.';
      setCreateUserError(msg);
    } finally {
      setUpdatingExistingFromModal(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * Send Password Reset Email
   * ------------------------------------------------------------
   */
  const handleSendPasswordReset = async (email: string) => {
    if (!email) return;

    try {
      setResetPasswordLoadingEmail(email);
      await sendPasswordResetEmail(auth, email.trim());
      setToastMessage({
        type: 'success',
        text: `Password-reset email sent to ${email}.`,
      });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: unknown) {
      console.error('Error sending password reset email:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to send password reset email.';
      setToastMessage({
        type: 'error',
        text: msg,
      });
      setTimeout(() => setToastMessage(null), 6000);
    } finally {
      setResetPasswordLoadingEmail(null);
    }
  };

  /*
   * ------------------------------------------------------------
   * Edit User Modal Handlers
   * ------------------------------------------------------------
   */
  const openEditUserModal = (targetUser: UserProfile) => {
    if (!isAdmin) return;

    setEditingUser(targetUser);
    setEditDisplayName(targetUser.displayName);
    setEditRole(targetUser.role);
    setEditJobTitle(targetUser.jobTitle || '');
    setEditDepartment(targetUser.department || '');
    setEditActive(targetUser.active ?? true);
    setEditError(null);
    setEditSuccess(null);
    setShowEditUserModal(true);
  };

  const handleSaveEditUser = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!editingUser || !isAdmin) return;

    const displayName = editDisplayName.trim();
    const jobTitle = editJobTitle.trim();
    const department = editDepartment.trim();

    if (!displayName) {
      setEditError('Display Name is required.');
      return;
    }

    if (!jobTitle) {
      setEditError('Job Title is required.');
      return;
    }

    if (!department) {
      setEditError('Department is required.');
      return;
    }

    try {
      setEditLoading(true);
      setEditError(null);
      setEditSuccess(null);

      const now = new Date().toISOString();

      await updateDoc(doc(db, 'users', editingUser.uid), {
        displayName,
        role: editRole,
        jobTitle,
        department,
        active: editActive,
        updatedAt: now,
      });

      await refreshUsers();
      await loadUsers();

      setEditSuccess(
        `Profile for "${displayName}" updated successfully.`
      );

      setTimeout(() => {
        setShowEditUserModal(false);
      }, 1200);
    } catch (err: unknown) {
      console.error('Error updating user profile:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update user profile.';
      setEditError(msg);
    } finally {
      setEditLoading(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * Create Firebase Authentication + Firestore Profile
   * ------------------------------------------------------------
   */

  const handleCreateUser = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!isAdmin) {
      return;
    }

    setCreateUserError(null);
    setCreateUserSuccess(null);
    setTemporaryPassword(null);
    setDetectedExistingUser(null);

    const displayName =
      newUserDisplayName.trim();

    const email =
      newUserEmail.trim().toLowerCase();

    const jobTitle =
      newUserJobTitle.trim();

    const department =
      newUserDepartment.trim();

    if (!displayName) {
      setCreateUserError(
        'Display Name is required.'
      );
      return;
    }

    if (!email) {
      setCreateUserError(
        'Email address is required.'
      );
      return;
    }

    if (!jobTitle) {
      setCreateUserError(
        'Job Title is required.'
      );
      return;
    }

    if (!department) {
      setCreateUserError(
        'Department is required.'
      );
      return;
    }

    /*
     * Check if a profile already exists for this email
     */
    const existingProfile = users.find(
      (user) => user.email.toLowerCase() === email
    );

    if (existingProfile) {
      setDetectedExistingUser(existingProfile);
      setCreateUserError(
        `A user profile already exists for ${email} (${existingProfile.displayName} • ${ROLE_LABELS[existingProfile.role]} • ${existingProfile.active ? 'Active' : 'Inactive'}). You can update the existing profile below.`
      );
      return;
    }

    setCreateUserLoading(true);

    let provisioningUser:
      | ReturnType<
          typeof getProvisioningAuth
        >['currentUser']
      | null = null;

    try {
      const provisioningAuth =
        getProvisioningAuth();

      const temporary =
        generateTemporaryPassword();

      setTemporaryPassword(
        temporary
      );

      /*
       * Create the Firebase Authentication account
       * using the SECONDARY auth instance.
       */
      const credential =
        await createUserWithEmailAndPassword(
          provisioningAuth,
          email,
          temporary
        );

      provisioningUser =
        credential.user;

      const now =
        new Date().toISOString();

      /*
       * IMPORTANT:
       *
       * This Firestore write is deliberately performed
       * using the PRIMARY ADMIN authentication session.
       *
       * The secondary Firebase Auth session does not have
       * permission to elevate itself to ADMIN.
       */
      const userProfile: UserProfile = {
        uid: credential.user.uid,

        displayName,

        email,

        role: newUserRole,

        jobTitle,

        department,

        active: newUserActive,

        photoURL:
          credential.user.photoURL ||
          null,

        createdAt: now,

        updatedAt: now,
      };

      await setDoc(
        doc(
          db,
          'users',
          credential.user.uid
        ),
        userProfile
      );

      /*
       * Optionally send a password reset email.
       *
       * The user's temporary password remains usable if
       * email delivery fails, so account creation is not
       * rolled back merely because mail delivery failed.
       */
      let resetWarning = '';

      if (sendResetEmail) {
        try {
          await sendPasswordResetEmail(
            auth,
            email
          );
        } catch (emailError) {
          console.warn(
            'Password reset email could not be sent:',
            emailError
          );

          resetWarning =
            ' The user was created, but the password-reset email could not be sent.';
        }
      }

      /*
       * Sign out only the SECONDARY authentication session.
       *
       * The existing ADMIN session remains untouched.
       */
      try {
        await signOut(
          provisioningAuth
        );
      } catch (signOutError) {
        console.warn(
          'Unable to sign out provisioning session:',
          signOutError
        );
      }

      await refreshUsers();
      await loadUsers();

      setCreateUserSuccess(
        `User "${displayName}" was created successfully.${resetWarning}`
      );
    } catch (error: unknown) {
      console.error(
        'Error creating administrative user:',
        error
      );

      /*
       * If Firestore profile creation failed after
       * Authentication succeeded, remove the orphaned
       * Auth account using the secondary Auth instance.
       */
      if (
        provisioningUser
      ) {
        try {
          await deleteUser(
            provisioningUser
          );
        } catch (cleanupError) {
          console.error(
            'Unable to remove orphaned Firebase Authentication user:',
            cleanupError
          );
        }
      }

      const isEmailInUse =
        (typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: string }).code ===
            'auth/email-already-in-use') ||
        (error instanceof Error &&
          error.message.includes('email-already-in-use'));

      if (isEmailInUse) {
        const match = users.find(
          (u) => u.email.toLowerCase() === email
        );

        if (match) {
          setDetectedExistingUser(match);
          setCreateUserError(
            `An account for ${email} is already registered (${match.displayName} • ${ROLE_LABELS[match.role]}). You can update their profile or send a password reset.`
          );
        } else {
          setCreateUserError(
            `The email ${email} is already registered in Firebase Authentication. You can send a password reset email below.`
          );
        }
      } else {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to create user account.';

        setCreateUserError(
          message
        );
      }
    } finally {
      setCreateUserLoading(
        false
      );
    }
  };

  /*
   * ------------------------------------------------------------
   * Role Change
   * ------------------------------------------------------------
   */

  const handleRoleChange = async (
    targetUser: UserProfile,
    newRole: UserRole
  ) => {
    if (!isAdmin) {
      return;
    }

    if (
      targetUser.uid ===
      currentUser?.uid
    ) {
      const confirmed =
        window.confirm(
          'You are changing your own role. This may immediately affect your administrative access. Continue?'
        );

      if (!confirmed) {
        return;
      }
    }

    try {
      setUpdatingUserId(
        targetUser.uid
      );

      const updatedAt =
        new Date().toISOString();

      await updateDoc(
        doc(
          db,
          'users',
          targetUser.uid
        ),
        {
          role: newRole,
          updatedAt,
        }
      );

      setUsers((previous) =>
        previous.map(
          (user) =>
            user.uid ===
            targetUser.uid
              ? {
                  ...user,
                  role: newRole,
                  updatedAt,
                }
              : user
        )
      );

      await refreshUsers();
    } catch (error) {
      console.error(
        'Error updating user role:',
        error
      );

      window.alert(
        'Unable to update the user role. Check your administrator permissions and Firestore security rules.'
      );
    } finally {
      setUpdatingUserId(
        null
      );
    }
  };

  /*
   * ------------------------------------------------------------
   * Active / Inactive
   * ------------------------------------------------------------
   */

  const handleActiveChange = async (
    targetUser: UserProfile,
    active: boolean
  ) => {
    if (!isAdmin) {
      return;
    }

    if (
      targetUser.uid ===
        currentUser?.uid &&
      !active
    ) {
      window.alert(
        'You cannot deactivate your own account while currently signed in.'
      );

      return;
    }

    const action =
      active
        ? 'activate'
        : 'deactivate';

    const confirmed =
      window.confirm(
        `Are you sure you want to ${action} ${targetUser.displayName}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setUpdatingUserId(
        targetUser.uid
      );

      const updatedAt =
        new Date().toISOString();

      await updateDoc(
        doc(
          db,
          'users',
          targetUser.uid
        ),
        {
          active,
          updatedAt,
        }
      );

      setUsers((previous) =>
        previous.map(
          (user) =>
            user.uid ===
            targetUser.uid
              ? {
                  ...user,
                  active,
                  updatedAt,
                }
              : user
        )
      );

      await refreshUsers();
    } catch (error) {
      console.error(
        'Error updating user status:',
        error
      );

      window.alert(
        `Unable to ${action} the user. Verify your administrator permissions and Firestore security rules.`
      );
    } finally {
      setUpdatingUserId(
        null
      );
    }
  };

  /*
   * ------------------------------------------------------------
   * Integrity Audit
   * ------------------------------------------------------------
   */

  const handleRunIntegrityAudit =
    async () => {
      if (!isAdmin) {
        return;
      }

      try {
        setAuditRunning(true);
        setAuditError(null);

        const result =
          await dataIntegrityAuditService.runAudit();

        setAuditResult(
          result
        );
      } catch (error) {
        console.error(
          'Error running data integrity audit:',
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to complete the data integrity audit.';

        setAuditError(
          message
        );
      } finally {
        setAuditRunning(
          false
        );
      }
    };

  /*
   * ------------------------------------------------------------
   * Filtering
   * ------------------------------------------------------------
   */

  const filteredUsers =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      return users.filter(
        (user) => {
          if (
            roleFilter !==
              'ALL' &&
            user.role !==
              roleFilter
          ) {
            return false;
          }

          if (
            statusFilter ===
              'ACTIVE' &&
            !user.active
          ) {
            return false;
          }

          if (
            statusFilter ===
              'INACTIVE' &&
            user.active
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return (
            user.displayName
              .toLowerCase()
              .includes(
                query
              ) ||
            user.email
              .toLowerCase()
              .includes(
                query
              ) ||
            user.jobTitle
              ?.toLowerCase()
              .includes(
                query
              ) ||
            user.department
              ?.toLowerCase()
              .includes(
                query
              ) ||
            user.uid
              .toLowerCase()
              .includes(
                query
              )
          );
        }
      );
    }, [
      users,
      searchQuery,
      roleFilter,
      statusFilter,
    ]);

  const activeUsers =
    users.filter(
      (user) => user.active
    ).length;

  const inactiveUsers =
    users.length -
    activeUsers;

  const integrityIssueCount =
    auditResult?.summary
      .totalIssues || 0;

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />

          <span className="text-sm">
            Loading user directory...
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <UserCog className="w-4 h-4" />
              </div>

              User & Access Management
            </h1>

            <p className="text-xs text-neutral-400 mt-1">
              Manage authorised user profiles,
              enterprise roles, account status,
              and Phase 3 data integrity checks.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <button
                onClick={
                  openCreateUserModal
                }
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />

                Create User
              </button>
            )}

            <button
              onClick={
                handleRefresh
              }
              disabled={
                refreshing
              }
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  refreshing
                    ? 'animate-spin'
                    : ''
                }`}
              />

              Refresh Users
            </button>

            {isAdmin && (
              <button
                onClick={
                  handleRunIntegrityAudit
                }
                disabled={
                  auditRunning
                }
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                {auditRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}

                {auditRunning
                  ? 'Running Audit...'
                  : 'Run Data Integrity Audit'}
              </button>
            )}
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111115]/90 border border-white/10 rounded-2xl p-5">
            <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">
              Total Users
            </span>

            <p className="text-2xl font-black text-white mt-1">
              {users.length}
            </p>

            <div className="flex items-center gap-1.5 mt-2 text-xs text-indigo-300">
              <UserRound className="w-3.5 h-3.5" />
              Registered profiles
            </div>
          </div>

          <div className="bg-[#111115]/90 border border-white/10 rounded-2xl p-5">
            <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">
              Active Users
            </span>

            <p className="text-2xl font-black text-emerald-400 mt-1">
              {activeUsers}
            </p>

            <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-300">
              <UserCheck className="w-3.5 h-3.5" />
              Currently authorised
            </div>
          </div>

          <div className="bg-[#111115]/90 border border-white/10 rounded-2xl p-5">
            <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">
              Inactive Users
            </span>

            <p className="text-2xl font-black text-amber-400 mt-1">
              {inactiveUsers}
            </p>

            <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-300">
              <UserX className="w-3.5 h-3.5" />
              Access disabled
            </div>
          </div>

          <div className="bg-[#111115]/90 border border-white/10 rounded-2xl p-5">
            <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">
              Integrity Issues
            </span>

            <p
              className={`text-2xl font-black mt-1 ${
                integrityIssueCount >
                0
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }`}
            >
              {auditResult
                ? integrityIssueCount
                : '—'}
            </p>

            <div className="flex items-center gap-1.5 mt-2 text-xs text-neutral-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Latest audit result
            </div>
          </div>
        </div>

        {/* Audit Error */}
        {auditError && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />

              <div>
                <h3 className="text-sm font-bold text-rose-300">
                  Data Integrity Audit Failed
                </h3>

                <p className="text-xs text-neutral-300 mt-1">
                  {auditError}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Audit Results */}
        {auditResult && (
          <div
            className={`rounded-2xl border p-5 ${
              integrityIssueCount >
              0
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-emerald-500/20 bg-emerald-500/5'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex items-start gap-3">
                {integrityIssueCount >
                0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}

                <div>
                  <h3 className="text-sm font-bold text-white">
                    {integrityIssueCount >
                    0
                      ? 'Data Integrity Findings Detected'
                      : 'Data Integrity Check Passed'}
                  </h3>

                  <p className="text-xs text-neutral-400 mt-1">
                    Audit completed successfully.
                    Ownership, assignment, UID
                    references, and audit metadata
                    were checked across the configured
                    collections.
                  </p>
                </div>
              </div>

              <div className="text-xs text-neutral-400">
                Checked:{' '}
                <span className="font-semibold text-white">
                  {new Date(
                    auditResult.completedAt
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            {auditResult.issues
              .length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-neutral-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5">
                        Collection
                      </th>

                      <th className="px-3 py-2.5">
                        Document
                      </th>

                      <th className="px-3 py-2.5">
                        Field
                      </th>

                      <th className="px-3 py-2.5">
                        Finding
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/5">
                    {auditResult.issues.map(
                      (
                        issue,
                        index
                      ) => (
                        <tr
                          key={`${issue.collection}-${issue.documentId}-${issue.field}-${index}`}
                          className="text-neutral-300"
                        >
                          <td className="px-3 py-3 font-medium text-indigo-300">
                            {
                              issue.collection
                            }
                          </td>

                          <td className="px-3 py-3 font-mono text-[10px] text-neutral-400">
                            {
                              issue.documentId
                            }
                          </td>

                          <td className="px-3 py-3 font-medium text-white">
                            {issue.field}
                          </td>

                          <td className="px-3 py-3">
                            {issue.message}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-[#111115]/90 border border-white/10 rounded-2xl p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />

            <input
              type="text"
              value={
                searchQuery
              }
              onChange={(
                event
              ) =>
                setSearchQuery(
                  event.target
                    .value
                )
              }
              placeholder="Search name, email, department, or UID..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={
                roleFilter
              }
              onChange={(
                event
              ) =>
                setRoleFilter(
                  event.target
                    .value as RoleFilter
                )
              }
              className="px-3 py-2 text-xs rounded-xl bg-[#16161c] border border-white/10 text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">
                All Roles
              </option>

              {ROLE_OPTIONS.map(
                (role) => (
                  <option
                    key={role}
                    value={role}
                  >
                    {
                      ROLE_LABELS[
                        role
                      ]
                    }
                  </option>
                )
              )}
            </select>

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target
                    .value as StatusFilter
                )
              }
              className="px-3 py-2 text-xs rounded-xl bg-[#16161c] border border-white/10 text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">
                All Statuses
              </option>

              <option value="ACTIVE">
                Active
              </option>

              <option value="INACTIVE">
                Inactive
              </option>
            </select>
          </div>
        </div>

        {/* User Table */}
        <div className="bg-[#111115]/90 border border-white/10 rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-neutral-400 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3.5">
                    User
                  </th>

                  <th className="px-3 py-3.5">
                    Department
                  </th>

                  <th className="px-3 py-3.5">
                    Role
                  </th>

                  <th className="px-3 py-3.5">
                    Status
                  </th>

                  <th className="px-3 py-3.5">
                    Firebase UID
                  </th>

                  <th className="px-4 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {filteredUsers.map(
                  (user) => {
                    const isUpdating =
                      updatingUserId ===
                      user.uid;

                    return (
                      <tr
                        key={
                          user.uid
                        }
                        className="hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold">
                              {user.displayName
                                .charAt(
                                  0
                                )
                                .toUpperCase()}
                            </div>

                            <div>
                              <div className="font-bold text-white">
                                {
                                  user.displayName
                                }
                              </div>

                              <div className="text-neutral-500 mt-0.5">
                                {
                                  user.email
                                }
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <div className="text-neutral-200">
                            {user.department ||
                              '—'}
                          </div>

                          <div className="text-neutral-500 mt-0.5">
                            {user.jobTitle ||
                              '—'}
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          {isAdmin ? (
                            <select
                              value={
                                user.role
                              }
                              disabled={
                                isUpdating
                              }
                              onChange={(
                                event
                              ) =>
                                handleRoleChange(
                                  user,
                                  event
                                    .target
                                    .value as UserRole
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg text-xs bg-[#181820] border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                              {ROLE_OPTIONS.map(
                                (
                                  role
                                ) => (
                                  <option
                                    key={
                                      role
                                    }
                                    value={
                                      role
                                    }
                                  >
                                    {
                                      ROLE_LABELS[
                                        role
                                      ]
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          ) : (
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-bold ${
                                ROLE_BADGE_CLASSES[
                                  user.role
                                ]
                              }`}
                            >
                              {
                                ROLE_LABELS[
                                  user.role
                                ]
                              }
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${
                              user.active
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                user.active
                                  ? 'bg-emerald-400'
                                  : 'bg-rose-400'
                              }`}
                            />

                            {user.active
                              ? 'ACTIVE'
                              : 'INACTIVE'}
                          </span>
                        </td>

                        <td className="px-3 py-4">
                          <code className="text-[10px] text-neutral-500 break-all">
                            {
                              user.uid
                            }
                          </code>
                        </td>

                        <td className="px-4 py-4 text-right">
                          {isAdmin && (
                            <div className="inline-flex items-center justify-end gap-2">
                              {/* Edit Profile */}
                              <button
                                type="button"
                                onClick={() => openEditUserModal(user)}
                                title="Edit user profile"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-neutral-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                              >
                                <Pencil className="w-3 h-3 text-indigo-400" />
                                Edit
                              </button>

                              {/* Send Reset Email */}
                              <button
                                type="button"
                                onClick={() => handleSendPasswordReset(user.email)}
                                disabled={resetPasswordLoadingEmail === user.email}
                                title={`Send password reset email to ${user.email}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-neutral-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                              >
                                {resetPasswordLoadingEmail === user.email ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                                ) : (
                                  <KeyRound className="w-3 h-3 text-amber-400" />
                                )}
                                Reset PW
                              </button>

                              {/* Activate / Deactivate */}
                              <button
                                onClick={() =>
                                  handleActiveChange(
                                    user,
                                    !user.active
                                  )
                                }
                                disabled={
                                  isUpdating
                                }
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all disabled:opacity-50 cursor-pointer ${
                                  user.active
                                    ? 'text-rose-300 bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10'
                                    : 'text-emerald-300 bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                                }`}
                              >
                                {isUpdating ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : user.active ? (
                                  <UserX className="w-3 h-3" />
                                ) : (
                                  <UserCheck className="w-3 h-3" />
                                )}

                                {user.active
                                  ? 'Deactivate'
                                  : 'Activate'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}

                {filteredUsers.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        6
                      }
                      className="px-4 py-12 text-center text-neutral-500"
                    >
                      No users match
                      the current
                      filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ====================================================== */}
      {/* CREATE USER MODAL                                      */}
      {/* ====================================================== */}

      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserCog className="w-5 h-5" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Create Enterprise User
                  </h2>

                  <p className="text-xs text-slate-500 mt-0.5">
                    Create a Firebase Authentication account
                    and enterprise user profile.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreateUserModal(
                    false
                  )
                }
                disabled={
                  createUserLoading
                }
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={
                handleCreateUser
              }
              className="p-6 space-y-4"
            >
              {createUserError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />

                  <span>
                    {
                      createUserError
                    }
                  </span>
                </div>
              )}

              {/* Detected Existing User Banner with Quick Actions */}
              {detectedExistingUser && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        Existing User Found: {detectedExistingUser.displayName} ({detectedExistingUser.email})
                      </p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Current Role: <span className="font-semibold">{ROLE_LABELS[detectedExistingUser.role]}</span> • Department: <span className="font-semibold">{detectedExistingUser.department || '—'}</span> • Status: <span className="font-semibold">{detectedExistingUser.active ? 'Active' : 'Inactive'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200">
                    <button
                      type="button"
                      disabled={updatingExistingFromModal}
                      onClick={handleUpdateExistingFromCreateModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {updatingExistingFromModal ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Apply Form Values to Existing Profile
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendPasswordReset(detectedExistingUser.email)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      Send Reset Email
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery(detectedExistingUser.email);
                        setShowCreateUserModal(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-800 hover:text-amber-950 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View in Table
                    </button>
                  </div>
                </div>
              )}

              {createUserSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />

                  <div>
                    <p className="font-semibold">
                      {
                        createUserSuccess
                      }
                    </p>

                    {temporaryPassword && (
                      <div className="mt-2">
                        <span className="font-semibold">
                          Temporary password:
                        </span>

                        <code className="ml-1 px-2 py-1 rounded bg-white border border-emerald-200 text-slate-800 select-all">
                          {
                            temporaryPassword
                          }
                        </code>
                      </div>
                    )}

                    <p className="mt-2 text-[11px]">
                      Keep this temporary
                      password secure. The user
                      should change it immediately.
                    </p>
                  </div>
                </div>
              )}

              {/* Display Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Display Name *
                </label>

                <input
                  type="text"
                  required
                  value={
                    newUserDisplayName
                  }
                  onChange={(event) =>
                    setNewUserDisplayName(
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>

                <input
                  type="email"
                  required
                  value={
                    newUserEmail
                  }
                  onChange={(event) =>
                    setNewUserEmail(
                      event.target
                        .value
                    )
                  }
                  placeholder="john.doe@stk.com.pg"
                  className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Enterprise Role *
                </label>

                <select
                  required
                  value={
                    newUserRole
                  }
                  onChange={(event) =>
                    setNewUserRole(
                      event.target
                        .value as UserRole
                    )
                  }
                  className="w-full px-3 py-2 text-sm text-slate-900 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {ROLE_OPTIONS.map(
                    (role) => (
                      <option
                        key={
                          role
                        }
                        value={
                          role
                        }
                      >
                        {
                          ROLE_LABELS[
                            role
                          ]
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Job Title + Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Job Title *
                  </label>

                  <input
                    type="text"
                    required
                    value={
                      newUserJobTitle
                    }
                    onChange={(
                      event
                    ) =>
                      setNewUserJobTitle(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="e.g. Account Manager"
                    className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department *
                  </label>

                  <input
                    type="text"
                    required
                    value={
                      newUserDepartment
                    }
                    onChange={(
                      event
                    ) =>
                      setNewUserDepartment(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="e.g. Account Management"
                    className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Account Active
                  </p>

                  <p className="text-[11px] text-slate-500">
                    Active users can access the
                    application according to their role.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={
                    newUserActive
                  }
                  onChange={(event) =>
                    setNewUserActive(
                      event.target
                        .checked
                    )
                  }
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Password Reset */}
              <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                <input
                  id="sendResetEmail"
                  type="checkbox"
                  checked={
                    sendResetEmail
                  }
                  onChange={(event) =>
                    setSendResetEmail(
                      event.target
                        .checked
                    )
                  }
                  className="w-4 h-4 mt-0.5 accent-indigo-600 cursor-pointer"
                />

                <label
                  htmlFor="sendResetEmail"
                  className="cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-indigo-950">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    Send password-reset email
                  </span>

                  <span className="block text-[11px] text-indigo-700 mt-0.5">
                    The account is created with a temporary
                    password and the user is prompted to set
                    their own password.
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowCreateUserModal(
                      false
                    )
                  }
                  disabled={
                    createUserLoading
                  }
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    createUserLoading
                  }
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {createUserLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating User...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* EDIT USER MODAL                                        */}
      {/* ====================================================== */}

      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Edit User Profile
                  </h2>

                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingUser.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditUserModal(false)}
                disabled={editLoading}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-semibold">{editSuccess}</span>
                </div>
              )}

              {/* Display Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Email (Readonly) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={editingUser.email}
                  className="w-full px-3 py-2 text-sm text-slate-500 bg-slate-100 rounded-lg border border-slate-200 cursor-not-allowed"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Enterprise Role *
                </label>
                <select
                  required
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm text-slate-900 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Job Title + Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editJobTitle}
                    onChange={(e) => setEditJobTitle(e.target.value)}
                    placeholder="e.g. Account Manager"
                    className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    placeholder="e.g. Account Management"
                    className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Account Active
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Active users can log in and access system resources.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Password Reset Action */}
              <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-950">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                    Reset Password
                  </span>
                  <span className="block text-[11px] text-indigo-700 mt-0.5">
                    Send a password reset link to {editingUser.email}.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSendPasswordReset(editingUser.email)}
                  disabled={resetPasswordLoadingEmail === editingUser.email}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {resetPasswordLoadingEmail === editingUser.email ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  Send Reset Link
                </button>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  disabled={editLoading}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={editLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {editLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* TOAST NOTIFICATION BANNER                              */}
      {/* ====================================================== */}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-100'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-100'
                : 'bg-indigo-950/90 border-indigo-500/30 text-indigo-100'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : toastMessage.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs flex-1 font-medium">{toastMessage.text}</div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-white/60 hover:text-white transition-colors cursor-pointer p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};