import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Calendar,
  AlertCircle,
  CheckSquare,
} from 'lucide-react';
import {
  Engagement,
  Organisation,
  Contact,
  EngagementType,
  EngagementPurpose,
  EngagementStatus,
  UserRole,
} from '../../types';
import {
  engagementService,
  calculateDaysUntilNext,
} from '../../services/engagementService';
import { contactService } from '../../services/contactService';
import { masterDataService } from '../../services/masterDataService';
import { useAuth } from '../../contexts/AuthContext';

interface EngagementFormModalProps {
  isOpen: boolean;
  engagement?: Engagement | null;
  defaultOrganisationId?: string;
  defaultContactId?: string;
  organisations: Organisation[];
  onClose: () => void;
  onSuccess: (saved: Engagement) => void;
}

interface MasterDataOption {
  value: string;
  label: string;
  isActive?: boolean;
}

const ASSIGNABLE_ENGAGEMENT_ROLES: UserRole[] = [
  'BDM',
  'BDM_MANAGER',
  'ACCOUNT_MANAGER',
];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  BDM_MANAGER: 'BDM Manager',
  BDM: 'Business Development Manager',
  ACCOUNT_MANAGER: 'Account Manager',
};

export const EngagementFormModal: React.FC<
  EngagementFormModalProps
> = ({
  isOpen,
  engagement,
  defaultOrganisationId,
  defaultContactId,
  organisations,
  onClose,
  onSuccess,
}) => {
  const {
    currentUser,
    allUsers,
    refreshUsers,
  } = useAuth();

  const [organisationId, setOrganisationId] =
    useState('');
  const [contactId, setContactId] =
    useState('');
  const [assignedTo, setAssignedTo] =
    useState('');

  const [engagementType, setEngagementType] =
    useState<EngagementType>('MEETING_ONSITE');

  const [engagementDate, setEngagementDate] =
    useState('');

  const [purpose, setPurpose] =
    useState<EngagementPurpose>(
      'OPPORTUNITY_DISCUSSION'
    );

  const [details, setDetails] =
    useState('');

  const [outcome, setOutcome] =
    useState('');

  const [status, setStatus] =
    useState<EngagementStatus>('COMPLETED');

  const [engagementCycle, setEngagementCycle] =
    useState<number | ''>('');

  const [
    engagementCycleDescription,
    setEngagementCycleDescription,
  ] = useState('');

  const [nextEngagementDate, setNextEngagementDate] =
    useState('');

  const [createFollowUpTask, setCreateFollowUpTask] =
    useState(true);

  const [contacts, setContacts] =
    useState<Contact[]>([]);

  const [engagementTypes, setEngagementTypes] =
    useState<MasterDataOption[]>([]);

  const [engagementPurposes, setEngagementPurposes] =
    useState<MasterDataOption[]>([]);

  const [loadingMasterData, setLoadingMasterData] =
    useState(false);

  const [refreshingUsers, setRefreshingUsers] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const toDateInput = (
    isoString?: string | null
  ) => {
    if (!isoString) return '';

    try {
      const date = new Date(isoString);

      if (Number.isNaN(date.getTime())) {
        return '';
      }

      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  /*
   * Only active users who are valid engagement assignees
   * are presented in the assignment dropdown.
   *
   * ADMIN is deliberately excluded as an operational assignee.
   */
  const assignableUsers = useMemo(() => {
    return allUsers
      .filter(
        (user) =>
          user.active === true &&
          ASSIGNABLE_ENGAGEMENT_ROLES.includes(
            user.role
          )
      )
      .sort((a, b) =>
        a.displayName.localeCompare(
          b.displayName
        )
      );
  }, [allUsers]);

  /*
   * Preserve an existing assignee when editing even if the
   * account has subsequently become inactive or its role has
   * changed. This avoids silently changing historical ownership.
   */
  const assignmentOptions = useMemo(() => {
    const options = [...assignableUsers];

    if (
      engagement?.assignedTo &&
      !options.some(
        (user) =>
          user.uid === engagement.assignedTo
      )
    ) {
      const existingUser = allUsers.find(
        (user) =>
          user.uid === engagement.assignedTo
      );

      if (existingUser) {
        options.push(existingUser);
      }
    }

    return options.sort((a, b) =>
      a.displayName.localeCompare(
        b.displayName
      )
    );
  }, [
    assignableUsers,
    engagement,
    allUsers,
  ]);

  const activeEngagementTypes = useMemo(
    () =>
      engagementTypes.filter(
        (item) =>
          item.isActive !== false
      ),
    [engagementTypes]
  );

  const activeEngagementPurposes = useMemo(
    () =>
      engagementPurposes.filter(
        (item) =>
          item.isActive !== false
      ),
    [engagementPurposes]
  );

  const engagementTypeOptions = useMemo(() => {
    const options = [
      ...activeEngagementTypes,
    ];

    if (
      engagementType &&
      !options.some(
        (option) =>
          option.value ===
          engagementType
      )
    ) {
      const existingOption =
        engagementTypes.find(
          (option) =>
            option.value ===
            engagementType
        );

      options.unshift({
        value: engagementType,
        label:
          existingOption?.label ||
          engagementType.replace(
            /_/g,
            ' '
          ),
        isActive: true,
      });
    }

    return options;
  }, [
    activeEngagementTypes,
    engagementType,
    engagementTypes,
  ]);

  const engagementPurposeOptions =
    useMemo(() => {
      const options = [
        ...activeEngagementPurposes,
      ];

      if (
        purpose &&
        !options.some(
          (option) =>
            option.value ===
            purpose
        )
      ) {
        const existingOption =
          engagementPurposes.find(
            (option) =>
              option.value ===
              purpose
          );

        options.unshift({
          value: purpose,
          label:
            existingOption?.label ||
            purpose.replace(
              /_/g,
              ' '
            ),
          isActive: true,
        });
      }

      return options;
    }, [
      activeEngagementPurposes,
      purpose,
      engagementPurposes,
    ]);

  /*
   * Refresh the enterprise directory whenever the modal opens.
   *
   * This is particularly important when an administrator has just
   * created an Account Manager and a BDM immediately attempts to
   * assign an engagement to that person.
   */
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const refreshUserDirectory = async () => {
      try {
        setRefreshingUsers(true);

        await refreshUsers();
      } catch (error) {
        console.warn(
          'Unable to refresh engagement assignee directory:',
          error
        );
      } finally {
        if (mounted) {
          setRefreshingUsers(false);
        }
      }
    };

    void refreshUserDirectory();

    return () => {
      mounted = false;
    };
  }, [isOpen, refreshUsers]);

  /*
   * Load master data.
   */
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const loadMasterData = async () => {
      setLoadingMasterData(true);

      try {
        const [
          types,
          purposes,
        ] = await Promise.all([
          masterDataService.getEngagementTypes(),
          masterDataService.getEngagementPurposes(),
        ]);

        if (!mounted) return;

        setEngagementTypes(types);
        setEngagementPurposes(
          purposes
        );
      } catch (error) {
        console.error(
          'Error loading engagement master data:',
          error
        );

        if (mounted) {
          setErrorMessage(
            'Unable to load engagement master data. Please refresh and try again.'
          );
        }
      } finally {
        if (mounted) {
          setLoadingMasterData(false);
        }
      }
    };

    void loadMasterData();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  /*
   * Initialise/reset form state.
   */
  useEffect(() => {
    if (!isOpen) return;

    if (engagement) {
      setOrganisationId(
        engagement.organisationId
      );

      setContactId(
        engagement.contactId || ''
      );

      setAssignedTo(
        engagement.assignedTo || ''
      );

      setEngagementType(
        engagement.engagementType
      );

      setEngagementDate(
        toDateInput(
          engagement.engagementDate
        )
      );

      setPurpose(
        engagement.purpose
      );

      setDetails(
        engagement.details
      );

      setOutcome(
        engagement.outcome
      );

      setStatus(
        engagement.status
      );

      setEngagementCycle(
        engagement.engagementCycle ??
          ''
      );

      setEngagementCycleDescription(
        engagement.engagementCycleDescription ||
          ''
      );

      setNextEngagementDate(
        toDateInput(
          engagement.nextEngagementDate
        )
      );

      setCreateFollowUpTask(false);
    } else {
      setOrganisationId(
        defaultOrganisationId ||
          organisations[0]?.id ||
          ''
      );

      setContactId(
        defaultContactId || ''
      );

      /*
       * New engagements default to the current authenticated
       * user. Assignment can then be changed to another active
       * BDM, BDM Manager, or Account Manager.
       */
      setAssignedTo(
        currentUser?.uid || ''
      );

      setEngagementType(
        'MEETING_ONSITE'
      );

      setEngagementDate(
        new Date()
          .toISOString()
          .split('T')[0]
      );

      setPurpose(
        'OPPORTUNITY_DISCUSSION'
      );

      setDetails('');
      setOutcome('');
      setStatus('COMPLETED');
      setEngagementCycle('');
      setEngagementCycleDescription('');
      setNextEngagementDate('');
      setCreateFollowUpTask(true);
    }

    setErrorMessage(null);
  }, [
    isOpen,
    engagement,
    defaultOrganisationId,
    defaultContactId,
    organisations,
    currentUser,
  ]);

  /*
   * If the current selection becomes invalid because the user
   * directory changes, retain the current value when editing,
   * otherwise default to the authenticated user.
   */
  useEffect(() => {
    if (!isOpen || engagement) {
      return;
    }

    if (
      assignedTo &&
      assignmentOptions.some(
        (user) =>
          user.uid === assignedTo
      )
    ) {
      return;
    }

    if (
      currentUser?.uid &&
      assignableUsers.some(
        (user) =>
          user.uid ===
          currentUser.uid
      )
    ) {
      setAssignedTo(
        currentUser.uid
      );
      return;
    }

    if (assignableUsers.length > 0) {
      setAssignedTo(
        assignableUsers[0].uid
      );
    }
  }, [
    isOpen,
    engagement,
    assignedTo,
    currentUser,
    assignableUsers,
    assignmentOptions,
  ]);

  /*
   * Load contacts for selected organisation.
   */
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const loadContacts = async () => {
      if (!organisationId) {
        if (mounted) {
          setContacts([]);
        }
        return;
      }

      try {
        const list =
          await contactService.getByOrganisation(
            organisationId
          );

        if (mounted) {
          setContacts(list);
        }
      } catch (error) {
        console.error(
          'Error loading organisation contacts:',
          error
        );

        if (mounted) {
          setContacts([]);
        }
      }
    };

    void loadContacts();

    return () => {
      mounted = false;
    };
  }, [
    organisationId,
    isOpen,
  ]);

  if (!isOpen) {
    return null;
  }

  const daysUntilNext =
    calculateDaysUntilNext(
      nextEngagementDate
    );

  const selectedAssignee =
    assignmentOptions.find(
      (user) =>
        user.uid === assignedTo
    );

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setErrorMessage(null);

    if (!currentUser?.uid) {
      setErrorMessage(
        'Your authenticated user identity could not be established. Please sign in again.'
      );
      return;
    }

    if (!organisationId) {
      setErrorMessage(
        'Please select an Organisation.'
      );
      return;
    }

    if (!assignedTo) {
      setErrorMessage(
        'Please select an engagement owner or assignee.'
      );
      return;
    }

    /*
     * Ensure the selected assignee is a valid enterprise user.
     *
     * When editing an existing engagement, an existing inactive
     * assignee may remain selectable for audit/history reasons.
     */
    const selectedUser =
      assignmentOptions.find(
        (user) =>
          user.uid === assignedTo
      );

    if (!selectedUser) {
      setErrorMessage(
        'The selected engagement assignee is no longer available. Refresh the user directory and try again.'
      );
      return;
    }

    if (
      selectedUser.active !== true &&
      !engagement
    ) {
      setErrorMessage(
        'New engagements can only be assigned to active users.'
      );
      return;
    }

    if (
      !ASSIGNABLE_ENGAGEMENT_ROLES.includes(
        selectedUser.role
      )
    ) {
      setErrorMessage(
        'Engagements may only be assigned to BDMs, BDM Managers, or Account Managers.'
      );
      return;
    }

    if (!engagementType) {
      setErrorMessage(
        'Please select an Engagement Type.'
      );
      return;
    }

    if (!purpose) {
      setErrorMessage(
        'Please select an Engagement Purpose.'
      );
      return;
    }

    if (!engagementDate) {
      setErrorMessage(
        'Please select the Engagement Date.'
      );
      return;
    }

    if (
      !details.trim() ||
      !outcome.trim()
    ) {
      setErrorMessage(
        'Engagement details and outcome summary are required.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const dateISO = new Date(
        engagementDate
      ).toISOString();

      const nextDateISO =
        nextEngagementDate
          ? new Date(
              nextEngagementDate
            ).toISOString()
          : null;

      /*
       * IMPORTANT:
       *
       * assignedTo = selected assignee Firebase UID
       * createdBy  = authenticated creator Firebase UID
       * updatedBy  = authenticated editor Firebase UID
       */
      const payload = {
        organisationId,
        contactId:
          contactId || null,

        assignedTo,

        engagementType,

        engagementDate:
          dateISO,

        purpose,

        details:
          details.trim(),

        outcome:
          outcome.trim(),

        status,

        engagementCycle:
          typeof engagementCycle ===
          'number'
            ? engagementCycle
            : null,

        engagementCycleDescription:
          engagementCycleDescription.trim() ||
          null,

        nextEngagementDate:
          nextDateISO,

        updatedBy:
          currentUser.uid,
      };

      if (engagement) {
        await engagementService.update(
          engagement.id,
          payload
        );

        onSuccess({
          ...engagement,
          ...payload,
          updatedAt:
            new Date().toISOString(),
        });
      } else {
        const result =
          await engagementService.create(
            {
              ...payload,
              createdBy:
                currentUser.uid,
            },
            {
              createFollowUpTask:
                createFollowUpTask &&
                !!nextDateISO,

              /*
               * Follow-up task follows the selected
               * engagement owner.
               */
              taskAssignedTo:
                assignedTo,

              taskTitle:
                `Follow up: ${purpose.replace(
                  /_/g,
                  ' '
                )} (${engagementType.replace(
                  /_/g,
                  ' '
                )})`,
            }
          );

        onSuccess(
          result.engagement
        );
      }

      onClose();
    } catch (error: unknown) {
      console.error(
        'Error saving engagement:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to save engagement record.';

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {engagement
                  ? 'Edit Business Engagement'
                  : 'Log Business Engagement'}
              </h3>

              <p className="text-xs text-slate-500">
                Record client meetings, calls,
                discoveries, outcomes, and ownership
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4"
        >
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Organisation & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Target Organisation *
              </label>

              <select
                required
                disabled={
                  (!!defaultOrganisationId &&
                    !engagement) ||
                  isSubmitting
                }
                value={organisationId}
                onChange={(e) => {
                  setOrganisationId(
                    e.target.value
                  );
                  setContactId('');
                }}
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-60"
              >
                <option value="">
                  -- Select Organisation --
                </option>

                {organisations.map(
                  (org) => (
                    <option
                      key={org.id}
                      value={org.id}
                    >
                      {org.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Stakeholder / Contact Engaged
              </label>

              <select
                value={contactId}
                disabled={
                  !organisationId ||
                  isSubmitting
                }
                onChange={(e) =>
                  setContactId(
                    e.target.value
                  )
                }
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-60"
              >
                <option value="">
                  -- General / Multiple Stakeholders --
                </option>

                {contacts.map(
                  (contact) => (
                    <option
                      key={contact.id}
                      value={contact.id}
                    >
                      {contact.fullName} (
                      {contact.jobTitle})
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* Type, Date, Assignee */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Engagement Type *
              </label>

              <select
                value={engagementType}
                disabled={
                  loadingMasterData ||
                  isSubmitting
                }
                onChange={(e) =>
                  setEngagementType(
                    e.target
                      .value as EngagementType
                  )
                }
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-60"
              >
                {engagementTypeOptions.length ===
                0 ? (
                  <option value="">
                    No engagement types configured
                  </option>
                ) : (
                  engagementTypeOptions.map(
                    (type) => (
                      <option
                        key={type.value}
                        value={type.value}
                      >
                        {type.label}
                      </option>
                    )
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Engagement Date *
              </label>

              <input
                type="date"
                required
                disabled={isSubmitting}
                value={engagementDate}
                onChange={(e) =>
                  setEngagementDate(
                    e.target.value
                  )
                }
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Engagement Owner / Assignee *
              </label>

              <select
                required
                disabled={
                  isSubmitting ||
                  refreshingUsers
                }
                value={assignedTo}
                onChange={(e) =>
                  setAssignedTo(
                    e.target.value
                  )
                }
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-60"
              >
                <option value="">
                  -- Select Owner / Assignee --
                </option>

                {assignmentOptions.map(
                  (user) => (
                    <option
                      key={user.uid}
                      value={user.uid}
                    >
                      {user.displayName} (
                      {ROLE_LABELS[
                        user.role
                      ] || user.role}
                      )
                      {user.active !== true
                        ? ' - Inactive'
                        : ''}
                    </option>
                  )
                )}
              </select>

              <p className="text-[10px] text-slate-500 mt-1">
                Assign to an active BDM, BDM Manager,
                or Account Manager.
                {selectedAssignee &&
                  ` Current: ${selectedAssignee.displayName}.`}
              </p>
            </div>
          </div>

          {/* Purpose & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Engagement Purpose *
              </label>

              <select
                value={purpose}
                disabled={
                  loadingMasterData ||
                  isSubmitting
                }
                onChange={(e) =>
                  setPurpose(
                    e.target
                      .value as EngagementPurpose
                  )
                }
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-60"
              >
                {engagementPurposeOptions.length ===
                0 ? (
                  <option value="">
                    No engagement purposes configured
                  </option>
                ) : (
                  engagementPurposeOptions.map(
                    (item) => (
                      <option
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </option>
                    )
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Engagement Status *
              </label>

              <select
                value={status}
                disabled={isSubmitting}
                onChange={(e) =>
                  setStatus(
                    e.target
                      .value as EngagementStatus
                  )
                }
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-60"
              >
                <option value="COMPLETED">
                  Completed
                </option>

                <option value="IN_PROGRESS">
                  In Progress
                </option>

                <option value="OPEN">
                  Open / Scheduled
                </option>

                <option value="CLOSED">
                  Closed
                </option>

                <option value="ON_HOLD">
                  On Hold
                </option>
              </select>
            </div>
          </div>

          {/* Details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Discussion Details *
            </label>

            <textarea
              required
              rows={3}
              disabled={isSubmitting}
              value={details}
              onChange={(e) =>
                setDetails(
                  e.target.value
                )
              }
              placeholder="What was discussed? Key pain points, business requirements, architectural scope..."
              className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Outcome Summary & Next Steps *
            </label>

            <textarea
              required
              rows={2}
              disabled={isSubmitting}
              value={outcome}
              onChange={(e) =>
                setOutcome(
                  e.target.value
                )
              }
              placeholder="What was agreed upon? Agreed timeline, quotation request, follow-up milestone..."
              className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          {/* Follow-Up */}
          <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">
                  Next Follow-Up / Engagement Date
                </label>

                <input
                  type="date"
                  disabled={isSubmitting}
                  value={nextEngagementDate}
                  onChange={(e) =>
                    setNextEngagementDate(
                      e.target.value
                    )
                  }
                  className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-60"
                />

                {daysUntilNext !== null && (
                  <p className="text-[11px] text-indigo-700 mt-1 font-medium">
                    {daysUntilNext === 0
                      ? 'Scheduled for today'
                      : daysUntilNext > 0
                      ? `In ${daysUntilNext} day(s)`
                      : `${Math.abs(
                          daysUntilNext
                        )} day(s) in the past`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">
                  Engagement Cycle / Phase
                  (Optional)
                </label>

                <input
                  type="number"
                  min="1"
                  disabled={isSubmitting}
                  placeholder="Cycle # (e.g. 1, 2, 3)"
                  value={engagementCycle}
                  onChange={(e) =>
                    setEngagementCycle(
                      e.target.value === ''
                        ? ''
                        : Number(
                            e.target.value
                          )
                    )
                  }
                  className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white mb-2 disabled:opacity-60"
                />

                <input
                  type="text"
                  disabled={isSubmitting}
                  placeholder="Cycle description (e.g. Executive Discovery)"
                  value={
                    engagementCycleDescription
                  }
                  onChange={(e) =>
                    setEngagementCycleDescription(
                      e.target.value
                    )
                  }
                  className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-1.5 text-xs rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-60"
                />
              </div>
            </div>

            {nextEngagementDate &&
              !engagement && (
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoTaskCheckbox"
                    disabled={isSubmitting}
                    checked={
                      createFollowUpTask
                    }
                    onChange={(e) =>
                      setCreateFollowUpTask(
                        e.target.checked
                      )
                    }
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-60"
                  />

                  <label
                    htmlFor="autoTaskCheckbox"
                    className="text-xs font-medium text-indigo-950 cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                    Automatically create a follow-up
                    action in My Worklist for this
                    target
                  </label>
                </div>
              )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                loadingMasterData ||
                refreshingUsers ||
                engagementTypeOptions.length ===
                  0 ||
                engagementPurposeOptions.length ===
                  0 ||
                !assignedTo
              }
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? 'Saving...'
                : refreshingUsers
                ? 'Refreshing Users...'
                : loadingMasterData
                ? 'Loading...'
                : engagement
                ? 'Update Engagement'
                : 'Save & Log Engagement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};