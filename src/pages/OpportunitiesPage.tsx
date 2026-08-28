import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { opportunityService } from '../services/opportunityService';
import { organisationService } from '../services/organisationService';
import {
  Opportunity,
  Organisation,
  OpportunityStatus,
  PipelineStage,
} from '../types';
import {
  OpportunityStatusBadge,
  PipelineStageBadge,
} from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { OpportunityFormModal } from '../components/opportunities/OpportunityFormModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { PIPELINE_STAGES } from '../services/masterDataDefaults';
import {
  TrendingUp,
  Plus,
  Search,
  LayoutGrid,
  List,
  Building2,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const OpportunitiesPage: React.FC = () => {
  const { currentUser, allUsers, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);

  // View state: Table vs Kanban
  const [viewMode, setViewMode] = useState<'KANBAN' | 'TABLE'>('KANBAN');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] =
    useState<string>('OPEN');
  const [selectedStageFilter, setSelectedStageFilter] =
    useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>('ALL');
  const [selectedBDMFilter, setSelectedBDMFilter] =
    useState<string>('ALL');

  // Modals
  const [showOppModal, setShowOppModal] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [deletingOpp, setDeletingOpp] = useState<Opportunity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);

    try {
      const [oppList, orgList] = await Promise.all([
        opportunityService.getAll(),
        organisationService.getAll(),
      ]);

      setOpportunities(oppList);
      setOrganisations(orgList);
    } catch (e) {
      console.error('Error loading opportunities:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Update the pipeline stage for an opportunity.
   *
   * IMPORTANT:
   * updatedBy is always the Firebase Authentication UID.
   * displayName must never be written into authorization,
   * ownership, assignment, or audit identity fields.
   */
  const handleStageChange = async (
    opp: Opportunity,
    newStage: PipelineStage
  ) => {
    if (!currentUser?.uid) {
      console.error(
        'Unable to update opportunity: authenticated Firebase user UID is unavailable.'
      );
      return;
    }

    let newStatus: OpportunityStatus = opp.status;
    let closedDate = opp.closedDate;

    if (newStage === 'CLOSED') {
      newStatus = 'WON';
      closedDate = new Date().toISOString();
    }

    const updatedBy = currentUser.uid;

    await opportunityService.update(opp.id, {
      pipelineStage: newStage,
      status: newStatus,
      closedDate,
      updatedBy,
    });

    setOpportunities((prev) =>
      prev.map((o) =>
        o.id === opp.id
          ? {
              ...o,
              pipelineStage: newStage,
              status: newStatus,
              closedDate,
              updatedBy,
            }
          : o
      )
    );
  };

  const handleDeleteOpportunity = async () => {
    if (!deletingOpp) return;

    setIsDeleting(true);

    try {
      await opportunityService.delete(deletingOpp.id);

      setOpportunities((prev) =>
        prev.filter((o) => o.id !== deletingOpp.id)
      );

      setDeletingOpp(null);
    } catch (e) {
      console.error('Error deleting opportunity:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <LoadingSpinner text="Loading commercial opportunity pipelines..." />
    );
  }

  // Filtered opportunities
  const filteredOpportunities = opportunities.filter((opp) => {
    if (
      selectedStatusFilter !== 'ALL' &&
      opp.status !== selectedStatusFilter
    ) {
      return false;
    }

    if (
      selectedStageFilter !== 'ALL' &&
      opp.pipelineStage !== selectedStageFilter
    ) {
      return false;
    }

    if (
      selectedCategoryFilter !== 'ALL' &&
      opp.solutionCategory !== selectedCategoryFilter
    ) {
      return false;
    }

    if (
      selectedBDMFilter !== 'ALL' &&
      opp.bdmOwnerId !== selectedBDMFilter
    ) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();

      const org = organisations.find(
        (o) => o.id === opp.organisationId
      );

      const matchTitle = opp.title.toLowerCase().includes(q);
      const matchCat = opp.solutionCategory.toLowerCase().includes(q);
      const matchOrg = org?.name.toLowerCase().includes(q);

      if (!matchTitle && !matchCat && !matchOrg) {
        return false;
      }
    }

    return true;
  });

  // Calculate Metrics
  const openDeals = opportunities.filter((o) => o.status === 'OPEN');
  const wonDeals = opportunities.filter((o) => o.status === 'WON');
  const lostDeals = opportunities.filter((o) => o.status === 'LOST');

  const totalOpenValue = openDeals.reduce(
    (sum, o) => sum + (o.estimatedValue || 0),
    0
  );

  const totalWonValue = wonDeals.reduce(
    (sum, o) => sum + (o.estimatedValue || 0),
    0
  );

  const winRate =
    wonDeals.length + lostDeals.length > 0
      ? Math.round(
          (wonDeals.length /
            (wonDeals.length + lostDeals.length)) *
            100
        )
      : 0;

  // Categories list for filter
  const categories = Array.from(
    new Set(opportunities.map((o) => o.solutionCategory))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            Commercial Opportunities Pipeline
          </h1>

          <p className="text-xs text-neutral-400 mt-0.5">
            Track solution discovery, proposal staging, and account referrals
            across Papua New Guinea
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setViewMode('KANBAN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'KANBAN'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban Board
            </button>

            <button
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Table View
            </button>
          </div>

          <button
            onClick={() => {
              setEditingOpp(null);
              setShowOppModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 border border-indigo-500/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Opportunity
          </button>
        </div>
      </div>

      {/* KPI Bento Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-lg">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            Open Pipeline Value
          </span>

          <p className="text-2xl font-black text-white mt-1">
            PGK {(totalOpenValue / 1000000).toFixed(2)}M
          </p>

          <span className="text-[11px] text-indigo-400 font-medium mt-1 block">
            {openDeals.length} Active commercial opportunities
          </span>
        </div>

        <div className="relative overflow-hidden bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-lg">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            Total Deals Won
          </span>

          <p className="text-2xl font-black text-emerald-400 mt-1">
            PGK {(totalWonValue / 1000000).toFixed(2)}M
          </p>

          <span className="text-[11px] text-emerald-400 font-medium mt-1 block">
            {wonDeals.length} Closed-won contracts
          </span>
        </div>

        <div className="relative overflow-hidden bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-lg">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            Conversion / Win Rate
          </span>

          <p className="text-2xl font-black text-white mt-1">
            {winRate}%
          </p>

          <span className="text-[11px] text-neutral-400 font-medium mt-1 block">
            Based on completed deals
          </span>
        </div>

        <div className="relative overflow-hidden bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-lg">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            Average Deal Size
          </span>

          <p className="text-2xl font-black text-white mt-1">
            PGK{' '}
            {opportunities.length > 0
              ? (
                  (totalOpenValue + totalWonValue) /
                  (opportunities.length * 1000)
                ).toFixed(0) + 'k'
              : '0'}
          </p>

          <span className="text-[11px] text-neutral-400 font-medium mt-1 block">
            Across {opportunities.length} Total pipeline records
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search opportunities or solution..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open Pipeline</option>
            <option value="WON">Won Deals</option>
            <option value="LOST">Lost Deals</option>
            <option value="UNCONVERTED">Unconverted</option>
          </select>

          {/* Solution Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Solution Categories</option>

            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          {/* BDM Filter */}
          <select
            value={selectedBDMFilter}
            onChange={(e) => setSelectedBDMFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All BDMs</option>

            {allUsers
              .filter(
                (u) =>
                  u.role === 'BDM' ||
                  u.role === 'BDM_MANAGER'
              )
              .map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* VIEW: KANBAN BOARD */}
      {viewMode === 'KANBAN' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3.5 overflow-x-auto pb-4 items-start min-w-[1100px]">
          {PIPELINE_STAGES.map((stage) => {
            const stageOpps = filteredOpportunities.filter(
              (o) => o.pipelineStage === stage.id
            );

            const stageValue = stageOpps.reduce(
              (sum, o) => sum + (o.estimatedValue || 0),
              0
            );

            return (
              <div
                key={stage.id}
                className="bg-[#111115]/80 backdrop-blur-md rounded-2xl p-3 border border-white/10 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white truncate">
                      {stage.label}
                    </h3>

                    <span className="text-[10px] font-semibold text-neutral-400">
                      PGK {(stageValue / 1000).toFixed(0)}k
                    </span>
                  </div>

                  <span className="w-5 h-5 rounded-lg bg-white/10 text-neutral-200 text-xs font-bold flex items-center justify-center border border-white/10">
                    {stageOpps.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="mt-3 space-y-2.5 flex-1 overflow-y-auto">
                  {stageOpps.map((opp) => {
                    const org = organisations.find(
                      (o) => o.id === opp.organisationId
                    );

                    const bdm = allUsers.find(
                      (u) => u.uid === opp.bdmOwnerId
                    );

                    return (
                      <div
                        key={opp.id}
                        onClick={() => {
                          setEditingOpp(opp);
                          setShowOppModal(true);
                        }}
                        className="bg-[#181820]/90 p-3.5 rounded-xl border border-white/10 shadow-sm hover:border-indigo-500/40 hover:bg-[#1d1d28] transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                          <span className="font-semibold text-indigo-300 truncate max-w-[120px]">
                            {org?.name || 'Organisation'}
                          </span>

                          <OpportunityStatusBadge status={opp.status} />
                        </div>

                        <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-2">
                          {opp.title}
                        </h4>

                        <span className="text-[10px] text-neutral-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md inline-block mt-1.5 truncate max-w-full">
                          {opp.solutionCategory}
                        </span>

                        <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                          <span className="text-xs font-black text-white">
                            {opp.currency || 'PGK'}{' '}
                            {(opp.estimatedValue || 0).toLocaleString()}
                          </span>

                          <span className="text-[10px] text-neutral-400">
                            {bdm?.displayName
                              ? bdm.displayName.split(' ')[0]
                              : 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW: TABLE VIEW */}
      {viewMode === 'TABLE' && (
        <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-neutral-400 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">
                    Opportunity Title
                  </th>

                  <th className="py-3.5 px-3">
                    Target Organisation
                  </th>

                  <th className="py-3.5 px-3">
                    Solution Category
                  </th>

                  <th className="py-3.5 px-3">
                    Estimated Value
                  </th>

                  <th className="py-3.5 px-3">
                    Pipeline Stage
                  </th>

                  <th className="py-3.5 px-3">
                    Status
                  </th>

                  <th className="py-3.5 px-3">
                    BDM Owner
                  </th>

                  <th className="py-3.5 px-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {filteredOpportunities.map((opp) => {
                  const org = organisations.find(
                    (o) => o.id === opp.organisationId
                  );

                  const bdm = allUsers.find(
                    (u) => u.uid === opp.bdmOwnerId
                  );

                  return (
                    <tr
                      key={opp.id}
                      onClick={() => {
                        setEditingOpp(opp);
                        setShowOppModal(true);
                      }}
                      className="hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-bold text-white text-sm">
                        {opp.title}
                      </td>

                      <td className="py-3.5 px-3">
                        {org ? (
                          <Link
                            to={`/organisations/${org.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            {org.name}
                          </Link>
                        ) : (
                          <span className="text-neutral-500">
                            Unknown
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-medium text-neutral-300">
                        {opp.solutionCategory}
                      </td>

                      <td className="py-3.5 px-3 font-bold text-white text-sm whitespace-nowrap">
                        {opp.currency || 'PGK'}{' '}
                        {(opp.estimatedValue || 0).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <PipelineStageBadge
                          stage={opp.pipelineStage}
                        />
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <OpportunityStatusBadge
                          status={opp.status}
                        />
                      </td>

                      <td className="py-3.5 px-3 text-neutral-300 whitespace-nowrap">
                        {bdm?.displayName || 'Unassigned'}
                      </td>

                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingOpp(opp);
                              setShowOppModal(true);
                            }}
                            className="p-1.5 text-neutral-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                            title="Edit Opportunity"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() =>
                                setDeletingOpp(opp)
                              }
                              className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete Opportunity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Opportunity Modal */}
      <OpportunityFormModal
        isOpen={showOppModal}
        opportunity={editingOpp}
        organisations={organisations}
        onClose={() => {
          setShowOppModal(false);
          setEditingOpp(null);
        }}
        onSuccess={(saved) => {
          if (editingOpp) {
            setOpportunities((prev) =>
              prev.map((o) =>
                o.id === saved.id ? saved : o
              )
            );
          } else {
            setOpportunities((prev) => [
              saved,
              ...prev,
            ]);
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingOpp}
        title="Delete Opportunity Deal?"
        message={`Are you sure you want to delete "${deletingOpp?.title}"?`}
        confirmLabel="Delete Opportunity"
        variant="danger"
        onConfirm={handleDeleteOpportunity}
        onCancel={() => setDeletingOpp(null)}
        isProcessing={isDeleting}
      />
    </div>
  );
};