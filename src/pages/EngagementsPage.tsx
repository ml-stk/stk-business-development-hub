import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  engagementService,
  calculateDaysUntilNext,
} from '../services/engagementService';
import { organisationService } from '../services/organisationService';
import { contactService } from '../services/contactService';
import { authorizationService } from '../services/authorizationService';
import {
  Engagement,
  Organisation,
  Contact,
} from '../types';
import { EngagementStatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { EngagementFormModal } from '../components/engagements/EngagementFormModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import {
  CalendarDays,
  Plus,
  Search,
  Building2,
  Clock,
  Edit2,
  Trash2,
  Calendar,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DEFAULT_ENGAGEMENT_TYPES,
} from '../services/masterDataDefaults';

export const EngagementsPage: React.FC = () => {
  const { currentUser, allUsers } = useAuth();

  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] =
    useState<string>('ALL');

  // Modals
  const [showEngageModal, setShowEngageModal] = useState(false);
  const [editingEngage, setEditingEngage] =
    useState<Engagement | null>(null);
  const [deletingEngage, setDeletingEngage] =
    useState<Engagement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);

    try {
      const [eList, oList, cList] = await Promise.all([
        engagementService.getAll(),
        organisationService.getAll(),
        contactService.getAll(),
      ]);

      setEngagements(eList);
      setOrganisations(oList);
      setContacts(cList);
    } catch (e) {
      console.error('Error loading engagements:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteEngagement = async () => {
    if (!deletingEngage || !currentUser) return;

    const canDelete =
      authorizationService.canDeleteEngagement(
        currentUser,
        deletingEngage
      );

    if (!canDelete) {
      console.warn(
        `Unauthorized engagement delete attempt by ${currentUser.uid} for engagement ${deletingEngage.id}`
      );

      setDeletingEngage(null);
      return;
    }

    setIsDeleting(true);

    try {
      await engagementService.delete(deletingEngage.id);

      setEngagements((prev) =>
        prev.filter((engagement) => engagement.id !== deletingEngage.id)
      );

      setDeletingEngage(null);
    } catch (e) {
      console.error('Error deleting engagement:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading engagements log..." />;
  }

  const filteredEngagements = engagements.filter((e) => {
    if (
      selectedOrgFilter !== 'ALL' &&
      e.organisationId !== selectedOrgFilter
    ) {
      return false;
    }

    if (
      selectedTypeFilter !== 'ALL' &&
      e.engagementType !== selectedTypeFilter
    ) {
      return false;
    }

    if (
      selectedStatusFilter !== 'ALL' &&
      e.status !== selectedStatusFilter
    ) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();

      const org = organisations.find(
        (o) => o.id === e.organisationId
      );

      const assignedUser = allUsers.find(
        (u) => u.uid === e.assignedTo
      );

      const assignedLabel =
        assignedUser?.displayName ||
        e.assignedToName ||
        e.assignedTo ||
        '';

      const matchDetails = e.details
        ?.toLowerCase()
        .includes(q);

      const matchOutcome = e.outcome
        ?.toLowerCase()
        .includes(q);

      const matchAssigned = assignedLabel
        .toLowerCase()
        .includes(q);

      const matchOrg = org?.name
        ?.toLowerCase()
        .includes(q);

      if (
        !matchDetails &&
        !matchOutcome &&
        !matchAssigned &&
        !matchOrg
      ) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CalendarDays className="w-4 h-4" />
            </div>
            Engagements & Meetings Log
          </h1>

          <p className="text-xs text-neutral-400 mt-0.5">
            Complete chronological record of all stakeholder discoveries,
            presentations, and client follow-ups
          </p>
        </div>

        <button
          onClick={() => {
            setEditingEngage(null);
            setShowEngageModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 border border-indigo-500/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Log Engagement
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search discussion notes, outcomes, BD owner..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* Organisation Filter */}
          <select
            value={selectedOrgFilter}
            onChange={(e) =>
              setSelectedOrgFilter(e.target.value)
            }
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">
              All Organisations ({organisations.length})
            </option>

            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          {/* Engagement Type Filter */}
          <select
            value={selectedTypeFilter}
            onChange={(e) =>
              setSelectedTypeFilter(e.target.value)
            }
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Types</option>

            {DEFAULT_ENGAGEMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) =>
              setSelectedStatusFilter(e.target.value)
            }
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="OPEN">Open</option>
            <option value="ON_HOLD">On Hold</option>
          </select>
        </div>
      </div>

      {/* Engagement Timeline */}
      {filteredEngagements.length === 0 ? (
        <EmptyState
          title="No engagements recorded"
          description="Try adjusting your filters or record a new engagement."
          icon={
            <CalendarDays className="w-8 h-8 text-neutral-400" />
          }
          action={{
            label: 'Log Engagement',
            onClick: () => setShowEngageModal(true),
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredEngagements.map((eng) => {
            const org = organisations.find(
              (o) => o.id === eng.organisationId
            );

            const contact = contacts.find(
              (c) => c.id === eng.contactId
            );

            const daysUntil =
              calculateDaysUntilNext(
                eng.nextEngagementDate
              );

            const canEditEngagement =
              currentUser
                ? authorizationService.canEditEngagement(
                    currentUser,
                    eng
                  )
                : false;

            const canDeleteEngagement =
              currentUser
                ? authorizationService.canDeleteEngagement(
                    currentUser,
                    eng
                  )
                : false;

            const assignedUser = allUsers.find(
              (u) => u.uid === eng.assignedTo
            );

            const displayLabel =
              assignedUser?.displayName ||
              eng.assignedToName ||
              eng.assignedTo;

            return (
              <div
                key={eng.id}
                className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-lg hover:border-indigo-500/40 transition-all space-y-3 relative overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

                {/* Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {org && (
                      <Link
                        to={`/organisations/${org.id}`}
                        className="text-sm font-bold text-white hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                      >
                        <Building2 className="w-4 h-4 text-indigo-400" />
                        {org.name}
                      </Link>
                    )}

                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {eng.engagementType.replace(/_/g, ' ')}
                    </span>

                    <EngagementStatusBadge status={eng.status} />

                    {eng.engagementCycle && (
                      <span className="text-xs font-medium text-neutral-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                        Cycle #{eng.engagementCycle}
                        {eng.engagementCycleDescription
                          ? ` • ${eng.engagementCycleDescription}`
                          : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-neutral-500" />

                      {new Date(
                        eng.engagementDate
                      ).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>

                    {/* Edit action */}
                    {canEditEngagement && (
                      <button
                        onClick={() => {
                          setEditingEngage(eng);
                          setShowEngageModal(true);
                        }}
                        className="p-1.5 text-neutral-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        title="Edit engagement"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete action */}
                    {canDeleteEngagement && (
                      <button
                        onClick={() =>
                          setDeletingEngage(eng)
                        }
                        className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete engagement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Purpose & Details */}
                <div>
                  <span className="text-xs font-bold text-indigo-300 block mb-1">
                    Purpose:{' '}
                    {eng.purpose.replace(/_/g, ' ')}
                  </span>

                  <p className="text-xs text-neutral-300 whitespace-pre-line leading-relaxed">
                    {eng.details}
                  </p>
                </div>

                {/* Outcome */}
                <div className="p-3.5 bg-white/5 rounded-xl border border-white/10">
                  <span className="text-xs font-bold text-white block mb-0.5">
                    Outcome & Agreed Deliverables:
                  </span>

                  <p className="text-xs text-neutral-300">
                    {eng.outcome}
                  </p>
                </div>

                {/* Footer Metadata */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-neutral-400 gap-2">
                  <div className="flex items-center gap-4">
                    <span>
                      Engaged by:{' '}
                      <strong className="text-neutral-200">
                        {displayLabel}
                      </strong>
                    </span>

                    {contact && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-neutral-500" />

                        Stakeholder:{' '}
                        <strong className="text-neutral-200">
                          {contact.fullName}
                        </strong>{' '}
                        ({contact.jobTitle})
                      </span>
                    )}
                  </div>

                  {eng.nextEngagementDate && (
                    <div className="flex items-center gap-1.5 font-medium text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />

                      <span>
                        Next Follow-Up:{' '}
                        {new Date(
                          eng.nextEngagementDate
                        ).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>

                      {daysUntil !== null && (
                        <span className="text-[11px] font-bold text-indigo-200 ml-1">
                          (
                          {daysUntil === 0
                            ? 'Today'
                            : daysUntil > 0
                              ? `in ${daysUntil}d`
                              : `${Math.abs(daysUntil)}d ago`}
                          )
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <EngagementFormModal
        isOpen={showEngageModal}
        engagement={editingEngage}
        organisations={organisations}
        onClose={() => {
          setShowEngageModal(false);
          setEditingEngage(null);
        }}
        onSuccess={(saved) => {
          if (editingEngage) {
            setEngagements((prev) =>
              prev.map((engagement) =>
                engagement.id === saved.id
                  ? saved
                  : engagement
              )
            );
          } else {
            setEngagements((prev) => [
              saved,
              ...prev,
            ]);
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingEngage}
        title="Delete Engagement Record?"
        message="Are you sure you want to remove this engagement record from the historical audit log?"
        confirmLabel="Delete Record"
        variant="danger"
        onConfirm={handleDeleteEngagement}
        onCancel={() => setDeletingEngage(null)}
        isProcessing={isDeleting}
      />
    </div>
  );
};