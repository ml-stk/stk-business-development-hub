import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { organisationService } from '../services/organisationService';
import { opportunityService } from '../services/opportunityService';
import { engagementService } from '../services/engagementService';
import { taskService } from '../services/taskService';
import { Organisation, Opportunity, Engagement, Task } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { StatCard } from '../components/common/StatCard';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Target,
  AlertCircle,
  Building2,
  Calendar,
  CheckSquare,
  Printer,
  Download,
  Filter,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ReportsPage: React.FC = () => {
  const { currentUser, allUsers } = useAuth();

  const [loading, setLoading] = useState(true);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [orgs, opps, engs, ts] = await Promise.all([
        organisationService.getAll(),
        opportunityService.getAll(),
        engagementService.getAll(),
        taskService.getTasksForUser(currentUser),
      ]);
      setOrganisations(orgs);
      setOpportunities(opps);
      setEngagements(engs);
      setTasks(ts);
    } catch (e) {
      console.error('Error loading reports:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid, currentUser?.role]);

  if (loading) {
    return <LoadingSpinner text="Generating executive intelligence & pipeline reports..." />;
  }

  // 1. Category Distribution
  const primaryOrgs = organisations.filter((o) => o.category === 'PRIMARY');
  const secondaryOrgs = organisations.filter((o) => o.category === 'SECONDARY');

  // 2. Sector Distribution
  const sectorCounts: { [sector: string]: number } = {};
  organisations.forEach((o) => {
    sectorCounts[o.sector] = (sectorCounts[o.sector] || 0) + 1;
  });

  // 3. Solution Category Pipeline Breakdown
  const solutionCategoryBreakdown: {
    [cat: string]: { totalValue: number; count: number };
  } = {};
  opportunities.forEach((opp) => {
    if (!solutionCategoryBreakdown[opp.solutionCategory]) {
      solutionCategoryBreakdown[opp.solutionCategory] = { totalValue: 0, count: 0 };
    }
    solutionCategoryBreakdown[opp.solutionCategory].totalValue += opp.estimatedValue || 0;
    solutionCategoryBreakdown[opp.solutionCategory].count += 1;
  });

  // 4. Win/Loss Analysis
  const wonOpps = opportunities.filter((o) => o.status === 'WON');
  const lostOpps = opportunities.filter((o) => o.status === 'LOST');
  const totalClosed = wonOpps.length + lostOpps.length;
  const winRate = totalClosed > 0 ? Math.round((wonOpps.length / totalClosed) * 100) : 0;

  // Loss reasons breakdown
  const lossReasonCounts: { [reason: string]: number } = {};
  lostOpps.forEach((o) => {
    const reason = o.lossReason || 'Unspecified';
    lossReasonCounts[reason] = (lossReasonCounts[reason] || 0) + 1;
  });

  // 5. Unengaged Targets (No engagement logged in 30+ days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

  const coldTargets = organisations.filter((o) => {
    if (o.status !== 'ACTIVE') return false;
    if (!o.lastEngagementDate) return true;
    return o.lastEngagementDate < thirtyDaysAgoISO;
  });

  // 6. BDM Activity Matrix
  const bdmUsers = allUsers.filter((u) => u.role === 'BDM' || u.role === 'BDM_MANAGER');
  const bdmPerformance = bdmUsers.map((user) => {
    const userOpps = opportunities.filter((o) => o.bdmOwnerId === user.uid);
    const userEngs = engagements.filter((e) => e.assignedTo === user.uid);
    const wonValue = userOpps
      .filter((o) => o.status === 'WON')
      .reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
    const openValue = userOpps
      .filter((o) => o.status === 'OPEN')
      .reduce((sum, o) => sum + (o.estimatedValue || 0), 0);

    return {
      user,
      engagementsCount: userEngs.length,
      oppsCount: userOpps.length,
      wonValue,
      openValue,
    };
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            Executive Reports & BD Analytics
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Commercial pipeline valuation, win/loss audit, target coverage, and BDM performance
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-300 bg-white/5 hover:bg-white/10 hover:text-white border border-white/10 rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print / Export Report
        </button>
      </div>

      {/* KPI Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Target Coverage"
          value={organisations.length}
          subtitle={`${primaryOrgs.length} Primary Targets • ${secondaryOrgs.length} Secondary`}
          icon={<Building2 className="w-5 h-5" />}
        />

        <StatCard
          title="Conversion Win Rate"
          value={`${winRate}%`}
          subtitle={`${wonOpps.length} Won / ${lostOpps.length} Lost to date`}
          icon={<Target className="w-5 h-5" />}
          iconBgColor="bg-emerald-500/10"
          iconTextColor="text-emerald-400"
        />

        <StatCard
          title="Cold Targets (30+ Days)"
          value={coldTargets.length}
          subtitle="Targets requiring urgent re-engagement"
          icon={<AlertCircle className="w-5 h-5" />}
          iconBgColor={coldTargets.length > 0 ? 'bg-amber-500/10' : 'bg-white/5'}
          iconTextColor={coldTargets.length > 0 ? 'text-amber-400' : 'text-neutral-400'}
        />

        <StatCard
          title="Total Engagements Logged"
          value={engagements.length}
          subtitle={`${tasks.filter((t) => t.status === 'COMPLETED').length} Action items executed`}
          icon={<Calendar className="w-5 h-5" />}
          iconBgColor="bg-purple-500/10"
          iconTextColor="text-purple-400"
        />
      </div>

      {/* Two Column Layout: Solution Pipeline Breakdown & Win/Loss Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Solution Categories Breakdown */}
        <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-lg relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
          <h3 className="text-sm font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            Opportunity Pipeline by Solution Category
          </h3>

          <div className="mt-4 space-y-3.5">
            {Object.entries(solutionCategoryBreakdown).map(([cat, data]) => {
              const maxVal = Math.max(
                ...Object.values(solutionCategoryBreakdown).map((d) => d.totalValue),
                1
              );
              const pct = Math.round((data.totalValue / maxVal) * 100);

              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-200">{cat}</span>
                    <span className="font-bold text-white">
                      PGK {(data.totalValue / 1000000).toFixed(2)}M ({data.count} deals)
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-500 shadow-sm shadow-indigo-500/50"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Win/Loss Analysis & Loss Reasons */}
        <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-lg relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
          <h3 className="text-sm font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-400" />
            Deal Win / Loss Audit & Reasons
          </h3>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <span className="text-xs font-semibold text-emerald-400 block">Deals Won</span>
                <span className="text-2xl font-bold text-emerald-300">{wonOpps.length}</span>
              </div>
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <span className="text-xs font-semibold text-rose-400 block">Deals Lost</span>
                <span className="text-2xl font-bold text-rose-300">{lostOpps.length}</span>
              </div>
            </div>

            {/* Reasons list */}
            <div>
              <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                Documented Loss Reasons (Audit Trail)
              </h4>
              {lostOpps.length === 0 ? (
                <p className="text-xs text-neutral-500 italic py-2">No lost deals recorded.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {lostOpps.map((o) => (
                    <div
                      key={o.id}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-white">
                        <span>{o.title}</span>
                        <span className="text-rose-400 font-semibold">
                          PGK {(o.estimatedValue || 0).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-neutral-400 mt-1">
                        Reason: <strong className="text-neutral-200 font-medium">{o.lossReason}</strong>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Target Coverage: Cold Targets Table */}
      <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Target Engagement Coverage Gap (Cold Targets: 30+ Days)
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Active enterprise targets that have not received an engagement touchpoint in over 30 days
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {coldTargets.length} Targets
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          {coldTargets.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-400">
              Outstanding coverage! All active targets have been engaged recently.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-neutral-400 font-bold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Target Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Sector</th>
                  <th className="py-2.5 px-3">Assigned BDM</th>
                  <th className="py-2.5 px-3">Last Engagement</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {coldTargets.map((org) => {
                  const bdm = allUsers.find((u) => u.uid === org.assignedBDMId);
                  return (
                    <tr key={org.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-bold text-white">{org.name}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {org.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-neutral-300">{org.sector}</td>
                      <td className="py-3 px-3 text-neutral-300">{bdm?.displayName || 'Unassigned'}</td>
                      <td className="py-3 px-3 text-rose-400 font-semibold">
                        {org.lastEngagementDate
                          ? new Date(org.lastEngagementDate).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Never Engaged'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to={`/organisations/${org.id}`}
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          View Target Profile →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* BDM Performance Activity Matrix */}
      <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 shadow-lg">
        <h3 className="text-sm font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-400" />
          BDM Team Performance & Activity Matrix
        </h3>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-neutral-400 font-bold uppercase">
              <tr>
                <th className="py-2.5 px-3">Team Member</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Engagements Logged</th>
                <th className="py-2.5 px-3">Opportunities Uncovered</th>
                <th className="py-2.5 px-3">Active Pipeline (PGK)</th>
                <th className="py-2.5 px-3">Closed-Won (PGK)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bdmPerformance.map((row) => (
                <tr key={row.user.uid} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-3 font-bold text-white">{row.user.displayName}</td>
                  <td className="py-3 px-3 text-neutral-400">{row.user.jobTitle}</td>
                  <td className="py-3 px-3 font-semibold text-neutral-200">
                    {row.engagementsCount}
                  </td>
                  <td className="py-3 px-3 font-semibold text-neutral-200">{row.oppsCount}</td>
                  <td className="py-3 px-3 font-bold text-white">
                    PGK {(row.openValue / 1000).toLocaleString()}k
                  </td>
                  <td className="py-3 px-3 font-bold text-emerald-400">
                    PGK {(row.wonValue / 1000).toLocaleString()}k
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
