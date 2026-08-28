import React, { useState, useEffect } from 'react';
import { X, Building2, AlertCircle, Plus } from 'lucide-react';
import {
  Organisation,
  OrgCategory,
  OrgPriority,
  OrgStatus,
} from '../../types';
import {
  organisationService,
  DuplicateMatch,
} from '../../services/organisationService';
import { settingsService } from '../../services/settingsService';
import { useAuth } from '../../contexts/AuthContext';
import { DuplicateWarningModal } from '../common/DuplicateWarningModal';
import { useNavigate } from 'react-router-dom';

interface OrganisationFormModalProps {
  isOpen: boolean;
  organisation?: Organisation | null;
  existingOrgs: Organisation[];
  onClose: () => void;
  onSuccess: (savedOrg: Organisation) => void;
}

export const OrganisationFormModal: React.FC<
  OrganisationFormModalProps
> = ({
  isOpen,
  organisation,
  existingOrgs,
  onClose,
  onSuccess,
}) => {
  const { currentUser, allUsers } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [newAliasInput, setNewAliasInput] = useState('');

  const [category, setCategory] =
    useState<OrgCategory>('PRIMARY');

  const [sector, setSector] = useState('');

  const [priority, setPriority] =
    useState<OrgPriority>('HIGH');

  const [status, setStatus] =
    useState<OrgStatus>('ACTIVE');

  const [assignedBDMId, setAssignedBDMId] =
    useState<string>('');

  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const [availableSectors, setAvailableSectors] =
    useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  // Duplicate warning state
  const [duplicateMatches, setDuplicateMatches] =
    useState<DuplicateMatch[]>([]);

  const [showDuplicateModal, setShowDuplicateModal] =
    useState(false);

  /**
   * Load available industry sectors from master settings.
   */
  useEffect(() => {
    let cancelled = false;

    const loadSectors = async () => {
      try {
        const sectors =
          await settingsService.getByKey('sectors');

        if (cancelled) {
          return;
        }

        setAvailableSectors(sectors);

        if (
          !organisation &&
          sectors.length > 0
        ) {
          setSector(sectors[0]);
        }
      } catch (error) {
        console.error(
          'Error loading organisation sectors:',
          error
        );

        if (!cancelled) {
          setAvailableSectors([]);
        }
      }
    };

    void loadSectors();

    return () => {
      cancelled = true;
    };
  }, [organisation]);

  /**
   * Load or reset form state whenever the modal is opened
   * or the selected organisation changes.
   */
  useEffect(() => {
    if (organisation) {
      setName(organisation.name);
      setAliases(organisation.aliases || []);
      setNewAliasInput('');

      setCategory(
        organisation.category
      );

      setSector(
        organisation.sector
      );

      setPriority(
        organisation.priority
      );

      setStatus(
        organisation.status
      );

      setAssignedBDMId(
        organisation.assignedBDMId || ''
      );

      setLocation(
        organisation.location || ''
      );

      setWebsite(
        organisation.website || ''
      );

      setDescription(
        organisation.description || ''
      );

      setNotes(
        organisation.notes || ''
      );
    } else {
      setName('');
      setAliases([]);
      setNewAliasInput('');

      setCategory('PRIMARY');

      setPriority('HIGH');

      setStatus('ACTIVE');

      setAssignedBDMId(
        currentUser?.role === 'BDM'
          ? currentUser.uid
          : ''
      );

      setLocation('');
      setWebsite('');
      setDescription('');
      setNotes('');
    }

    setErrorMessage(null);
    setDuplicateMatches([]);
    setShowDuplicateModal(false);
  }, [
    organisation,
    isOpen,
    currentUser,
  ]);

  if (!isOpen) {
    return null;
  }

  /**
   * Add an alias while preventing duplicate aliases.
   */
  const handleAddAlias = () => {
    const trimmed =
      newAliasInput.trim();

    if (!trimmed) {
      return;
    }

    const alreadyExists =
      aliases.some(
        (alias) =>
          alias.toLowerCase() ===
          trimmed.toLowerCase()
      );

    if (!alreadyExists) {
      setAliases([
        ...aliases,
        trimmed,
      ]);
    }

    setNewAliasInput('');
  };

  /**
   * Remove an alias by index.
   */
  const handleRemoveAlias = (
    index: number
  ) => {
    setAliases(
      aliases.filter(
        (_, aliasIndex) =>
          aliasIndex !== index
      )
    );
  };

  /**
   * Submit create or update operation.
   *
   * forceCreate bypasses duplicate detection after the user
   * explicitly chooses to proceed.
   */
  const handleFormSubmit = async (
    event: React.FormEvent,
    forceCreate = false
  ) => {
    event.preventDefault();

    setErrorMessage(null);

    /**
     * Firebase Authentication UID is mandatory for all
     * organisation create/update operations.
     */
    if (!currentUser?.uid) {
      setErrorMessage(
        'Your authenticated user identity could not be established. Please sign in again.'
      );
      return;
    }

    const trimmedName =
      name.trim();

    if (!trimmedName) {
      setErrorMessage(
        'Organisation Name is required.'
      );
      return;
    }

    if (!sector) {
      setErrorMessage(
        'Industry Sector is required.'
      );
      return;
    }

    /**
     * Check for potentially duplicate organisations only
     * when creating a new record.
     */
    if (
      !organisation &&
      !forceCreate
    ) {
      const dupes =
        organisationService.checkDuplicates(
          trimmedName,
          aliases,
          existingOrgs
        );

      if (dupes.length > 0) {
        setDuplicateMatches(dupes);
        setShowDuplicateModal(true);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (organisation) {
        /**
         * UPDATE
         */
        await organisationService.update(
          organisation.id,
          {
            name: trimmedName,

            aliases,

            category,

            sector,

            priority,

            status,

            assignedBDMId:
              assignedBDMId || null,

            location:
              location.trim(),

            website:
              website.trim(),

            description:
              description.trim(),

            notes:
              notes.trim(),

            updatedBy:
              currentUser.uid,
          }
        );

        onSuccess({
          ...organisation,

          name: trimmedName,

          aliases,

          category,

          sector,

          priority,

          status,

          assignedBDMId:
            assignedBDMId || null,

          location:
            location.trim(),

          website:
            website.trim(),

          description:
            description.trim(),

          notes:
            notes.trim(),

          updatedBy:
            currentUser.uid,

          updatedAt:
            new Date().toISOString(),
        });
      } else {
        /**
         * CREATE
         */
        const created =
          await organisationService.create({
            name: trimmedName,

            aliases,

            category,

            sector,

            priority,

            status,

            assignedBDMId:
              assignedBDMId || null,

            location:
              location.trim(),

            website:
              website.trim(),

            description:
              description.trim(),

            notes:
              notes.trim(),

            lastEngagementDate:
              null,

            nextFollowUpDate:
              null,

            createdBy:
              currentUser.uid,

            updatedBy:
              currentUser.uid,
          });

        onSuccess(created);
      }

      onClose();
    } catch (error: unknown) {
      console.error(
        'Error saving organisation:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to save organisation.';

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Users eligible to own a BDM target organisation.
   */
  const bdmUsers =
    allUsers.filter(
      (user) =>
        user.role === 'BDM' ||
        user.role === 'BDM_MANAGER'
    );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">

          {/* Modal Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {organisation
                    ? 'Edit Target Organisation'
                    : 'Add Target Organisation'}
                </h3>

                <p className="text-xs text-slate-500">
                  Maintain canonical target details and
                  legacy name aliases
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={(event) =>
              handleFormSubmit(event)
            }
            className="mt-4 space-y-4"
          >
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />

                <span>
                  {errorMessage}
                </span>
              </div>
            )}

            {/* Canonical Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Canonical Organisation Name *
              </label>

              <input
                type="text"
                required
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="e.g. Kumul Petroleum Holdings Limited"
                className="text-slate-900 placeholder:text-slate-400 w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Aliases */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Known Aliases / Legacy Search Terms
              </label>

              <p className="text-[11px] text-slate-500 mb-1.5">
                Helps match legacy spreadsheet names,
                for example "Kumul Petroleum" or
                "KPHL".
              </p>

              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newAliasInput}
                  onChange={(event) =>
                    setNewAliasInput(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter'
                    ) {
                      event.preventDefault();
                      handleAddAlias();
                    }
                  }}
                  placeholder="Enter alias (e.g. OTML) and click Add"
                  className="text-slate-900 placeholder:text-slate-400 flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <button
                  type="button"
                  onClick={handleAddAlias}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  Add Alias
                </button>
              </div>

              {aliases.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {aliases.map(
                    (alias, index) => (
                      <span
                        key={alias}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs border border-slate-200"
                      >
                        {alias}

                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveAlias(
                              index
                            )
                          }
                          disabled={
                            isSubmitting
                          }
                          className="text-slate-400 hover:text-rose-600 p-0.5 disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Category & Sector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Category *
                </label>

                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value as OrgCategory
                    )
                  }
                  className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="PRIMARY">
                    PRIMARY (Tier-1 Strategic Target)
                  </option>

                  <option value="SECONDARY">
                    SECONDARY (Tier-2 Standard Target)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Industry Sector *
                </label>

                <select
                  required
                  value={sector}
                  onChange={(event) =>
                    setSector(
                      event.target.value
                    )
                  }
                  className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">
                    -- Select Sector --
                  </option>

                  {availableSectors.map(
                    (availableSector) => (
                      <option
                        key={availableSector}
                        value={availableSector}
                      >
                        {availableSector}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* Priority, Status & Assigned BDM */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Priority *
                </label>

                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(
                      event.target.value as OrgPriority
                    )
                  }
                  className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="HIGH">
                    High Priority
                  </option>

                  <option value="MEDIUM">
                    Medium Priority
                  </option>

                  <option value="LOW">
                    Low Priority
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Status *
                </label>

                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value as OrgStatus
                    )
                  }
                  className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="ACTIVE">
                    Active Target
                  </option>

                  <option value="ON_HOLD">
                    On Hold
                  </option>

                  <option value="INACTIVE">
                    Inactive
                  </option>

                  <option value="ARCHIVED">
                    Archived
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned BDM Owner
                </label>

                <select
                  value={assignedBDMId}
                  onChange={(event) =>
                    setAssignedBDMId(
                      event.target.value
                    )
                  }
                  className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">
                    Unassigned
                  </option>

                  {bdmUsers.map(
                    (user) => (
                      <option
                        key={user.uid}
                        value={user.uid}
                      >
                        {user.displayName} (
                        {user.role})
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* Location & Website */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Location / Office Address
                </label>

                <input
                  type="text"
                  value={location}
                  onChange={(event) =>
                    setLocation(
                      event.target.value
                    )
                  }
                  placeholder="e.g. Port Moresby, NCD, Papua New Guinea"
                  className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Website URL
                </label>

                <input
                  type="url"
                  value={website}
                  onChange={(event) =>
                    setWebsite(
                      event.target.value
                    )
                  }
                  placeholder="https://example.com"
                  className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Organisation Description & Business Scope
              </label>

              <textarea
                rows={2}
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                placeholder="Core business operations, key facilities, industry footprint..."
                className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Internal Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Internal BD Strategy Notes
              </label>

              <textarea
                rows={2}
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value
                  )
                }
                placeholder="Strategic target notes, known IT roadmap, competitor presence..."
                className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
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
                  !currentUser?.uid
                }
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Saving...'
                  : organisation
                  ? 'Update Organisation'
                  : 'Create Organisation'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Duplicate Warning Modal */}
      <DuplicateWarningModal
        isOpen={showDuplicateModal}
        candidateName={name}
        matches={duplicateMatches}
        onCancel={() =>
          setShowDuplicateModal(false)
        }
        onProceedAnyway={() => {
          setShowDuplicateModal(false);

          void handleFormSubmit(
            {
              preventDefault: () => {},
            } as React.FormEvent,
            true
          );
        }}
        onSelectExisting={(orgId) => {
          setShowDuplicateModal(false);
          onClose();

          navigate(
            `/organisations/${orgId}`
          );
        }}
      />
    </>
  );
};