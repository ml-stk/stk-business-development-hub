import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { organisationService } from '../services/organisationService';
import { settingsService } from '../services/settingsService';
import {
  Organisation,
} from '../types';
import {
  OrgCategoryBadge,
  OrgStatusBadge,
  PriorityBadge,
} from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { OrganisationFormModal } from '../components/organisations/OrganisationFormModal';
import { EngagementFormModal } from '../components/engagements/EngagementFormModal';
import { OpportunityFormModal } from '../components/opportunities/OpportunityFormModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import {
  canCreateEngagement,
  canCreateOpportunity,
  canCreateOrganisation,
  canDeleteOrganisation,
  canEditOrganisation,
} from '../services/authorizationService';
import {
  Building2,
  Plus,
  Search,
  Calendar,
  TrendingUp,
  Edit2,
  Trash2,
  ChevronRight,
  Tag,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const OrganisationsPage: React.FC = () => {
  const {
    currentUser,
    allUsers,
  } = useAuth();

  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] =
    useState<'ALL' | 'PRIMARY' | 'SECONDARY'>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [selectedBDM, setSelectedBDM] = useState<string>('ALL');

  // Modals
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<Organisation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick Engagement & Opportunity Modals
  const [targetForEngagement, setTargetForEngagement] =
    useState<Organisation | null>(null);

  const [targetForOpp, setTargetForOpp] =
    useState<Organisation | null>(null);

  const loadData = async () => {
    setLoading(true);

    try {
      const [orgs, sectors] = await Promise.all([
        organisationService.getAll(),
        settingsService.getByKey('sectors'),
      ]);

      setOrganisations(orgs);
      setAvailableSectors(sectors);
    } catch (e) {
      console.error('Error loading organisations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteOrganisation = async () => {
    if (!deletingOrg) {
      return;
    }

    if (!canDeleteOrganisation(currentUser, deletingOrg)) {
      console.warn(
        'Unauthorized organisation deletion attempt.'
      );
      return;
    }

    setIsDeleting(true);

    try {
      await organisationService.delete(deletingOrg.id);

      setOrganisations((prev) =>
        prev.filter((o) => o.id !== deletingOrg.id)
      );

      setDeletingOrg(null);
    } catch (e) {
      console.error(
        'Error deleting organisation:',
        e
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const canAddOrganisation =
    canCreateOrganisation(currentUser);

  const canLogEngagement =
    canCreateEngagement(currentUser);

  const canCreateOpp =
    canCreateOpportunity(currentUser);

  if (loading) {
    return (
      <LoadingSpinner text="Loading target organisations..." />
    );
  }

  // Filter organisations
  const filteredOrganisations = organisations.filter((org) => {
    // Category Tab
    if (
      selectedCategoryTab !== 'ALL' &&
      org.category !== selectedCategoryTab
    ) {
      return false;
    }

    // Sector
    if (
      selectedSector !== 'ALL' &&
      org.sector !== selectedSector
    ) {
      return false;
    }

    // Priority
    if (
      selectedPriority !== 'ALL' &&
      org.priority !== selectedPriority
    ) {
      return false;
    }

    // Status
    if (
      selectedStatus !== 'ALL' &&
      org.status !== selectedStatus
    ) {
      return false;
    }

    // Assigned BDM
    if (
      selectedBDM !== 'ALL' &&
      org.assignedBDMId !== selectedBDM
    ) {
      return false;
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();

      const matchName = org.name
        .toLowerCase()
        .includes(q);

      const matchAliases =
        org.aliases?.some((alias) =>
          alias.toLowerCase().includes(q)
        );

      const matchSector = org.sector
        .toLowerCase()
        .includes(q);

      const matchLoc = org.location
        ?.toLowerCase()
        .includes(q);

      if (
        !matchName &&
        !matchAliases &&
        !matchSector &&
        !matchLoc
      ) {
        return false;
      }
    }

    return true;
  });

  const primaryCount = organisations.filter(
    (o) => o.category === 'PRIMARY'
  ).length;

  const secondaryCount = organisations.filter(
    (o) => o.category === 'SECONDARY'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Building2 className="w-4 h-4" />
            </div>

            Target Organisations
          </h1>

          <p className="text-xs text-neutral-400 mt-0.5">
            Canonical enterprise targets, legacy aliases, and strategic account ownership
          </p>
        </div>

        {canAddOrganisation && (
          <button
            onClick={() => {
              setEditingOrg(null);
              setShowOrgModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 border border-indigo-500/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Target Organisation
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 overflow-x-auto pb-px">
        <button
          onClick={() => setSelectedCategoryTab('ALL')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            selectedCategoryTab === 'ALL'
              ? 'border-indigo-500 text-white bg-white/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span>All Organisations</span>

          <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-neutral-200 font-bold">
            {organisations.length}
          </span>
        </button>

        <button
          onClick={() => setSelectedCategoryTab('PRIMARY')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            selectedCategoryTab === 'PRIMARY'
              ? 'border-indigo-500 text-white bg-white/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span>PRIMARY Strategic Targets</span>

          <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-bold">
            {primaryCount}
          </span>
        </button>

        <button
          onClick={() => setSelectedCategoryTab('SECONDARY')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            selectedCategoryTab === 'SECONDARY'
              ? 'border-indigo-500 text-white bg-white/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span>SECONDARY Standard Targets</span>

          <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-neutral-200 font-bold">
            {secondaryCount}
          </span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />

          <input
            type="text"
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(e.target.value)
            }
            placeholder="Search by name, alias (e.g. KPHL), or sector..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* Sector */}
          <select
            value={selectedSector}
            onChange={(e) =>
              setSelectedSector(e.target.value)
            }
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Sectors</option>

            {availableSectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>

          {/* Priority */}
          <select
            value={selectedPriority}
            onChange={(e) =>
              setSelectedPriority(e.target.value)
            }
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">
              Medium Priority
            </option>
            <option value="LOW">Low Priority</option>
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) =>
              setSelectedStatus(e.target.value)
            }
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Targets</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* BDM */}
          <select
            value={selectedBDM}
            onChange={(e) =>
              setSelectedBDM(e.target.value)
            }
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Assigned BDMs</option>

            {allUsers
              .filter(
                (user) =>
                  user.role === 'BDM' ||
                  user.role === 'BDM_MANAGER'
              )
              .map((user) => (
                <option
                  key={user.uid}
                  value={user.uid}
                >
                  {user.displayName}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Organisations Table */}
      {filteredOrganisations.length === 0 ? (
        <EmptyState
          title="No organisations match the criteria"
          description="Try clearing your filters or create a new target organisation."
          icon={
            <Building2 className="w-8 h-8 text-neutral-400" />
          }
          action={
            canAddOrganisation
              ? {
                  label: 'Add Target Organisation',
                  onClick: () =>
                    setShowOrgModal(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-neutral-400 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">
                    Canonical Target Name & Aliases
                  </th>

                  <th className="py-3.5 px-3">
                    Category
                  </th>

                  <th className="py-3.5 px-3">
                    Sector
                  </th>

                  <th className="py-3.5 px-3">
                    Priority
                  </th>

                  <th className="py-3.5 px-3">
                    Status
                  </th>

                  <th className="py-3.5 px-3">
                    Assigned BDM
                  </th>

                  <th className="py-3.5 px-3">
                    Last Engagement
                  </th>

                  <th className="py-3.5 px-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {filteredOrganisations.map((org) => {
                  const bdm = allUsers.find(
                    (user) =>
                      user.uid === org.assignedBDMId
                  );

                  const canEdit =
                    canEditOrganisation(
                      currentUser,
                      org
                    );

                  const canDelete =
                    canDeleteOrganisation(
                      currentUser,
                      org
                    );

                  return (
                    <tr
                      key={org.id}
                      className="hover:bg-white/5 transition-colors group cursor-pointer"
                      onClick={() =>
                        navigate(
                          `/organisations/${org.id}`
                        )
                      }
                    >
                      {/* Name & Aliases */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                            {org.name
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <h3 className="font-bold text-white group-hover:text-indigo-400 transition-colors text-sm truncate">
                              {org.name}
                            </h3>

                            {org.aliases &&
                              org.aliases.length >
                                0 && (
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">
                                    <Tag className="w-2.5 h-2.5" />
                                    Aliases:{' '}
                                    {org.aliases.join(
                                      ', '
                                    )}
                                  </span>
                                </div>
                              )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <OrgCategoryBadge
                          category={org.category}
                        />
                      </td>

                      {/* Sector */}
                      <td className="py-3.5 px-3 text-neutral-300 font-medium whitespace-nowrap">
                        {org.sector}
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <PriorityBadge
                          priority={org.priority}
                        />
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <OrgStatusBadge
                          status={org.status}
                        />
                      </td>

                      {/* Assigned BDM */}
                      <td className="py-3.5 px-3 text-neutral-300 whitespace-nowrap">
                        {bdm?.displayName || (
                          <span className="text-neutral-500 italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Last Engagement */}
                      <td className="py-3.5 px-3 text-neutral-400 whitespace-nowrap">
                        {org.lastEngagementDate ? (
                          new Date(
                            org.lastEngagementDate
                          ).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        ) : (
                          <span className="text-neutral-500 italic">
                            None logged
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <div className="flex items-center justify-end gap-1">
                          {canLogEngagement && (
                            <button
                              onClick={() =>
                                setTargetForEngagement(
                                  org
                                )
                              }
                              className="p-1.5 text-neutral-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                              title="Log engagement"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                          )}

                          {canCreateOpp && (
                            <button
                              onClick={() =>
                                setTargetForOpp(org)
                              }
                              className="p-1.5 text-neutral-400 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                              title="Add opportunity deal"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </button>
                          )}

                          {canEdit && (
                            <button
                              onClick={() => {
                                setEditingOrg(org);
                                setShowOrgModal(true);
                              }}
                              className="p-1.5 text-neutral-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                              title="Edit organisation"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() =>
                                setDeletingOrg(org)
                              }
                              className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete organisation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() =>
                              navigate(
                                `/organisations/${org.id}`
                              )
                            }
                            className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                            title="View complete target profile"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <OrganisationFormModal
        isOpen={showOrgModal}
        organisation={editingOrg}
        existingOrgs={organisations}
        onClose={() => {
          setShowOrgModal(false);
          setEditingOrg(null);
        }}
        onSuccess={(saved) => {
          if (editingOrg) {
            setOrganisations((prev) =>
              prev.map((organisation) =>
                organisation.id === saved.id
                  ? saved
                  : organisation
              )
            );
          } else {
            setOrganisations((prev) => [
              saved,
              ...prev,
            ]);
          }
        }}
      />

      {/* Quick Log Engagement Modal */}
      <EngagementFormModal
        isOpen={!!targetForEngagement}
        defaultOrganisationId={
          targetForEngagement?.id
        }
        organisations={organisations}
        onClose={() =>
          setTargetForEngagement(null)
        }
        onSuccess={(saved) => {
          setOrganisations((prev) =>
            prev.map((organisation) =>
              organisation.id === saved.organisationId
                ? {
                    ...organisation,
                    lastEngagementDate:
                      saved.engagementDate,
                  }
                : organisation
            )
          );

          setTargetForEngagement(null);
        }}
      />

      {/* Quick Add Opportunity Modal */}
      <OpportunityFormModal
        isOpen={!!targetForOpp}
        defaultOrganisationId={targetForOpp?.id}
        organisations={organisations}
        onClose={() => setTargetForOpp(null)}
        onSuccess={() =>
          setTargetForOpp(null)
        }
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingOrg}
        title="Delete Target Organisation?"
        message={`Are you sure you want to delete "${deletingOrg?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Organisation"
        variant="danger"
        onConfirm={handleDeleteOrganisation}
        onCancel={() => setDeletingOrg(null)}
        isProcessing={isDeleting}
      />
    </div>
  );
};