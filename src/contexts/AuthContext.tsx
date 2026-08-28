import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
} from 'firebase/firestore';

import { auth, db } from '../config/firebase';
import { UserProfile, UserRole } from '../types';
import { SEED_USERS } from '../services/seedService';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: User | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;

  allUsers: UserProfile[];
  refreshUsers: () => Promise<UserProfile[]>;

  /*
   * Development-only persona switching.
   * This has no effect on Firebase Authentication or Firestore
   * authorization and must never be treated as a security control.
   */
  switchPersona: (user: UserProfile) => void;

  signInWithGoogle: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;

  signup: (
    email: string,
    pass: string,
    displayName: string,
    role: UserRole,
    jobTitle: string,
    department: string
  ) => Promise<void>;

  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;

  /*
   * UI/UX role helper only.
   * Firestore Security Rules remain the authoritative
   * authorization boundary.
   */
  hasRole: (allowedRoles: UserRole[]) => boolean;

  isBDM: boolean;
  isAccountManager: boolean;
  isBDMManager: boolean;
  isAdmin: boolean;
}

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

const LOCAL_STORAGE_PERSONA_KEY =
  'stk_active_persona_uid';

/**
 * Safe default profile for newly authenticated users.
 *
 * IMPORTANT:
 * The role is deliberately hard-coded to BDM.
 * Elevated roles must be granted administratively.
 */
const buildDefaultUserProfile = (
  fbUser: User
): UserProfile => {
  const now =
    new Date().toISOString();

  return {
    uid: fbUser.uid,
    displayName:
      fbUser.displayName ||
      fbUser.email?.split('@')[0] ||
      'STK Team Member',
    email:
      fbUser.email || '',
    role: 'BDM',
    jobTitle:
      'Business Development Specialist',
    department:
      'Business Development',
    active: true,
    photoURL:
      fbUser.photoURL || null,
    createdAt: now,
    updatedAt: now,
  };
};

export const AuthProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] =
    useState<User | null>(null);

  const [currentUser, setCurrentUser] =
    useState<UserProfile | null>(null);

  const [allUsers, setAllUsers] =
    useState<UserProfile[]>([]);

  const [authError, setAuthError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState<boolean>(true);

  /*
   * Keep the most recently successful directory
   * outside React callback dependencies.
   *
   * This prevents refreshUsers() from being recreated
   * whenever the user list changes.
   */
  const allUsersRef =
    useRef<UserProfile[]>([]);

  useEffect(() => {
    allUsersRef.current = allUsers;
  }, [allUsers]);

  const clearAuthError = () => {
    setAuthError(null);
  };

  /**
   * Fetch the authoritative enterprise user directory
   * from Firestore.
   *
   * IMPORTANT:
   * This callback is intentionally stable.
   *
   * Authenticated sessions must never fall back to SEED_USERS.
   * The real Firestore directory is required so newly-created
   * Account Managers, BDMs, and BDM Managers appear immediately.
   */
  const refreshUsers = useCallback(
    async (): Promise<UserProfile[]> => {
      if (!auth.currentUser) {
        setAllUsers([]);
        allUsersRef.current = [];
        return [];
      }

      try {
        const snapshot =
          await getDocs(
            collection(db, 'users')
          );

        const users =
          snapshot.docs
            .map(
              (document) =>
                ({
                  uid: document.id,
                  ...document.data(),
                }) as UserProfile
            )
            .filter(
              (user) =>
                !!user.uid
            )
            .sort((a, b) =>
              (a.displayName || '')
                .localeCompare(
                  b.displayName || ''
                )
            );

        allUsersRef.current =
          users;

        setAllUsers(users);

        return users;
      } catch (error) {
        console.error(
          'Unable to refresh enterprise user directory:',
          error
        );

        /*
         * Preserve the last successfully loaded directory
         * during transient Firestore failures.
         *
         * This is NOT a security fallback.
         */
        return allUsersRef.current;
      }
    },
    []
  );

  /**
   * Synchronize Firebase Authentication state with
   * the canonical Firestore user profile.
   */
  useEffect(() => {
    let isMounted = true;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (fbUser) => {
          if (!isMounted) {
            return;
          }

          setFirebaseUser(fbUser);
          setAuthError(null);

          /*
           * ============================================================
           * UNAUTHENTICATED
           * ============================================================
           */
          if (!fbUser) {
            /*
             * Development-only persona support.
             *
             * This does not authenticate against Firebase and
             * cannot authorize Firestore operations.
             */
            if (import.meta.env.DEV) {
              const savedPersonaUid =
                localStorage.getItem(
                  LOCAL_STORAGE_PERSONA_KEY
                );

              const foundPersona =
                SEED_USERS.find(
                  (user) =>
                    user.uid ===
                    savedPersonaUid
                );

              if (foundPersona) {
                setCurrentUser(
                  foundPersona
                );
              } else {
                const defaultDevUser =
                  SEED_USERS.find(
                    (user) =>
                      user.role ===
                      'BDM'
                  ) ||
                  SEED_USERS[0] ||
                  null;

                setCurrentUser(
                  defaultDevUser
                );
              }

              allUsersRef.current =
                SEED_USERS;

              setAllUsers(
                SEED_USERS
              );
            } else {
              setCurrentUser(null);
              allUsersRef.current =
                [];
              setAllUsers([]);
            }

            setLoading(false);
            return;
          }

          /*
           * ============================================================
           * AUTHENTICATED
           * ============================================================
           */

          try {
            const userRef =
              doc(
                db,
                'users',
                fbUser.uid
              );

            const userDoc =
              await getDoc(
                userRef
              );

            /*
             * ==========================================================
             * EXISTING USER PROFILE
             * ==========================================================
             */
            if (userDoc.exists()) {
              const profileData =
                {
                  uid:
                    userDoc.id,
                  ...userDoc.data(),
                } as UserProfile;

              /*
               * Profile document ID must always
               * equal Firebase Authentication UID.
               */
              if (
                userDoc.id !==
                fbUser.uid
              ) {
                console.error(
                  'User profile UID mismatch detected.'
                );

                setCurrentUser(
                  null
                );

                setAuthError(
                  'Your user profile is invalid. Please contact an administrator.'
                );

                setLoading(false);
                return;
              }

              /*
               * Firestore active status is authoritative.
               */
              if (
                profileData.active !==
                true
              ) {
                console.warn(
                  `Inactive user attempted application access: ${fbUser.uid}`
                );

                setCurrentUser(
                  null
                );

                setAuthError(
                  'Your STK Business Development Hub account is inactive. Please contact an administrator.'
                );

                setLoading(false);
                return;
              }

              setCurrentUser(
                profileData
              );
            } else {
              /*
               * ========================================================
               * SELF-PROVISIONING
               * ========================================================
               *
               * New self-registered users receive BDM only.
               */
              const newProfile =
                buildDefaultUserProfile(
                  fbUser
                );

              await setDoc(
                userRef,
                newProfile
              );

              setCurrentUser(
                newProfile
              );
            }

            /*
             * Load the authoritative Firestore user directory.
             *
             * Do NOT use SEED_USERS here.
             */
            await refreshUsers();
          } catch (error) {
            console.error(
              'Error synchronizing authenticated user profile:',
              error
            );

            setCurrentUser(
              null
            );

            allUsersRef.current =
              [];

            setAllUsers([]);

            setAuthError(
              'Unable to load your STK Business Development Hub profile. Please try again or contact an administrator.'
            );
          } finally {
            if (isMounted) {
              setLoading(false);
            }
          }
        }
      );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [refreshUsers]);

  /**
   * Development-only persona switcher.
   */
  const switchPersona = (
    user: UserProfile
  ) => {
    if (!import.meta.env.DEV) {
      console.warn(
        'switchPersona() is disabled outside development mode.'
      );
      return;
    }

    setCurrentUser(user);

    localStorage.setItem(
      LOCAL_STORAGE_PERSONA_KEY,
      user.uid
    );
  };

  /**
   * Google Authentication
   */
  const signInWithGoogle =
    async () => {
      setLoading(true);
      setAuthError(null);

      try {
        const provider =
          new GoogleAuthProvider();

        provider.setCustomParameters({
          prompt: 'select_account',
        });

        await signInWithPopup(
          auth,
          provider
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Google Sign-In failed';

        setAuthError(message);
        throw error;
      } finally {
        setLoading(false);
      }
    };

  /**
   * Email/password login
   */
  const login = async (
    email: string,
    pass: string
  ) => {
    setLoading(true);
    setAuthError(null);

    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        pass
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Sign in failed';

      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Self-registration.
   *
   * The requested role is ignored.
   * All self-registered accounts begin as BDM.
   */
  const signup = async (
    email: string,
    pass: string,
    displayName: string,
    _role?: UserRole,
    jobTitle?: string,
    department?: string
  ) => {
    setLoading(true);
    setAuthError(null);

    try {
      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          pass
        );

      const now =
        new Date().toISOString();

      const profile: UserProfile = {
        uid:
          credential.user.uid,

        displayName:
          displayName.trim() ||
          credential.user.email?.split(
            '@'
          )[0] ||
          'User',

        email:
          credential.user.email ||
          email.trim(),

        role: 'BDM',

        jobTitle:
          jobTitle?.trim() ||
          'Business Development Specialist',

        department:
          department?.trim() ||
          'Business Development',

        active: true,

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
        profile
      );

      setCurrentUser(
        profile
      );

      /*
       * Refresh the actual Firestore directory,
       * so the newly-created user is immediately visible.
       */
      await refreshUsers();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Registration failed';

      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Password reset
   */
  const resetPassword =
    async (email: string) => {
      setLoading(true);
      setAuthError(null);

      try {
        await sendPasswordResetEmail(
          auth,
          email.trim()
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Password reset failed';

        setAuthError(message);
        throw error;
      } finally {
        setLoading(false);
      }
    };

  /**
   * Logout
   */
  const logout = async () => {
    setLoading(true);
    setAuthError(null);

    try {
      await signOut(auth);

      localStorage.removeItem(
        LOCAL_STORAGE_PERSONA_KEY
      );

      allUsersRef.current =
        [];

      setCurrentUser(null);
      setFirebaseUser(null);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Client-side role helper only.
   *
   * Firestore Security Rules remain authoritative.
   */
  const hasRole = (
    allowedRoles: UserRole[]
  ): boolean => {
    if (
      !currentUser ||
      currentUser.active !== true
    ) {
      return false;
    }

    if (
      currentUser.role ===
      'ADMIN'
    ) {
      return true;
    }

    return allowedRoles.includes(
      currentUser.role
    );
  };

  /*
   * Convenience role flags.
   */
  const role =
    currentUser?.role;

  const isBDM =
    role === 'BDM';

  const isAccountManager =
    role ===
    'ACCOUNT_MANAGER';

  const isBDMManager =
    role ===
    'BDM_MANAGER';

  const isAdmin =
    role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,

        loading,
        authError,
        clearAuthError,

        allUsers,
        refreshUsers,

        switchPersona,

        signInWithGoogle,
        login,
        signup,
        resetPassword,
        logout,

        hasRole,

        isBDM,
        isAccountManager,
        isBDMManager,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
};