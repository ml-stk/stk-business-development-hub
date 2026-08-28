import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { organisationService } from '../services/organisationService';
import { taskService } from '../services/taskService';
import { opportunityService } from '../services/opportunityService';
import { engagementService } from '../services/engagementService';
import {
  Organisation,
  Task,
  TaskStatus,
  Opportunity,
  Engagement,
} from '../types';
import { StatCard } from '../components/common/StatCard';
import {
  TaskStatusBadge,
  PriorityBadge,
  OrgCategoryBadge,
} from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  Building2,
  TrendingUp,
  CheckSquare,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Plus,
  Clock,
  Target,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OrganisationFormModal } from '../components/organisations/OrganisationFormModal';
import { EngagementFormModal } from '../components/engagements/EngagementFormModal';
import { OpportunityFormModal } from '../components/opportunities/OpportunityFormModal';

export const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);

  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showEngageModal, setShowEngageModal] = useState(false);
  const [showOppModal, setShowOppModal] = useState(false);

  const loadData = async () => {
    setLoading(true);

    try {
      const [
        orgList,
        taskList,
        oppList,
        engageList,
      ] = await Promise.all([
        organisationService.getAll(),
        taskService.getTasksForUser(currentUser),
        opportunityService.getAll(),
        engagementService.getAll(),
      ]);

      setOrganisations(orgList);
      setTasks(taskList);
      setOpportunities(oppList);
      setEngagements(engageList);
    } catch (error) {
      console.error(
        'Error loading dashboard data:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid, currentUser?.role]);

  const handleToggleTask = async (task: Task) => {
    if (!currentUser) {
      return;
    }

    const isNowCompleted =
      task.status !== 'COMPLETED';

    const newStatus: TaskStatus =
      isNowCompleted
        ? 'COMPLETED'
        : 'OPEN';

    const completedDate = isNowCompleted
      ? new Date().toISOString()
      : null;

    const completedBy = isNowCompleted
      ? currentUser.uid
      : null;

    const updatedBy = currentUser.uid;

    try {
      await taskService.update(task.id, {
        status: newStatus,
        completedDate,
        completedBy,
        updatedBy,
      });

      setTasks((previous) =>
        previous.map((existingTask) =>
          existingTask.id === task.id
            ? {
                ...existingTask,
                status: newStatus,
                completedDate,
                completedBy,
                updatedBy,
                updatedAt:
                  new Date().toISOString(),
              }
            : existingTask
        )
      );
    } catch (error) {
      console.error(
        'Error updating task status:',
        error
      );
    }
  };

  if (loading) {
    return (
      <LoadingSpinner text="Loading Business Development intelligence..." />
    );
  }

  const primaryOrgs = organisations.filter(
    (organisation) =>
      organisation.category === 'PRIMARY'
  );

  const secondaryOrgs = organisations.filter(
    (organisation) =>
      organisation.category === 'SECONDARY'
  );

  const openOpps = opportunities.filter(
    (opportunity) =>
      opportunity.status === 'OPEN'
  );

  const wonOpps = opportunities.filter(
    (opportunity) =>
      opportunity.status === 'WON'
  );

  const totalOpenValue =
    openOpps.reduce(
      (sum, opportunity) =>
        sum +
        (opportunity.estimatedValue || 0),
      0
    );

  const totalWonValue =
    wonOpps.reduce(
      (sum, opportunity) =>
        sum +
        (opportunity.estimatedValue || 0),
      0
    );

  const now = new Date();
  const todayStr =
    now.toISOString().split('T')[0];

  const overdueTasks = tasks.filter((task) => {
    if (
      !task ||
      task.status === 'COMPLETED' ||
      task.status === 'CANCELLED'
    ) {
      return false;
    }

    if (!task.dueDate) {
      return false;
    }

    const date = new Date(task.dueDate);

    if (isNaN(date.getTime())) {
      return false;
    }

    return (
      date.toISOString().split('T')[0] <
      todayStr
    );
  });

  const todayTasks = tasks.filter((task) => {
    if (
      !task ||
      task.status === 'COMPLETED' ||
      task.status === 'CANCELLED'
    ) {
      return false;
    }

    if (!task.dueDate) {
      return false;
    }

    const date = new Date(task.dueDate);

    if (isNaN(date.getTime())) {
      return false;
    }

    return (
      date.toISOString().split('T')[0] ===
      todayStr
    );
  });

  const recentEngagements = [
    ...engagements,
  ]
    .sort((a, b) => {
      const timeA =
        a.engagementDate
          ? new Date(
              a.engagementDate
            ).getTime()
          : 0;

      const timeB =
        b.engagementDate
          ? new Date(
              b.engagementDate
            ).getTime()
          : 0;

      return (
        (isNaN(timeB) ? 0 : timeB) -
        (isNaN(timeA) ? 0 : timeA)
      );
    })
    .slice(0, 5);

  const formatCurrency = (value: number) => {
    if (
      isNaN(value) ||
      value === null ||
      value === undefined
    ) {
      return 'PGK 0.00M';
    }

    return `PGK ${(value / 1000000).toFixed(2)}M`;
  };

  return (
    <div className="space-y-6">
      {/* Welcome / Command Centre */}
      <div className="relative overflow-hidden bg-[#0E2A47] rounded-3xl border border-[#24465F] p-6 shadow-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#49BFAE]/70 to-transparent" />

        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-[#1F5F8B]/20 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Welcome back,{' '}
                {currentUser?.displayName}
              </h1>

              {currentUser?.jobTitle && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#1F5F8B] text-[#D7F5EF] border border-[#2F86B8]/50">
                  {currentUser.jobTitle}
                </span>
              )}
            </div>

            <p className="text-xs text-[#B7C8D5] mt-1">
              STK Business Development Command
              Center • Enterprise Targets &
              Opportunity Pipelines
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() =>
                setShowOrgModal(true)
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#D7E6F0] bg-[#123B5D] hover:bg-[#1F5F8B] border border-[#2F86B8]/40 rounded-xl transition-all cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-[#49BFAE]" />
              + New Target
            </button>

            <button
              type="button"
              onClick={() =>
                setShowEngageModal(true)
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#D7E6F0] bg-[#123B5D] hover:bg-[#1F5F8B] border border-[#2F86B8]/40 rounded-xl transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#49BFAE]" />
              Log Engagement
            </button>

            <button
              type="button"
              onClick={() =>
                setShowOppModal(true)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#2878A8] hover:bg-[#2F86B8] rounded-xl shadow-lg shadow-[#1F5F8B]/30 border border-[#49BFAE]/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Opportunity
            </button>
          </div>
        </div>
      </div>

      {/* Overdue Alert */}
      {overdueTasks.length > 0 && (
        <div className="bg-rose-950/30 border border-rose-400/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-200 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-rose-300 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-200">
                Action Required:{' '}
                {overdueTasks.length} Overdue Task
                {overdueTasks.length > 1
                  ? 's'
                  : ''}
              </h4>

              <p className="text-xs text-rose-300/80 mt-0.5">
                Critical target follow-ups require
                immediate attention.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate('/worklist')
            }
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-rose-200 hover:text-white bg-rose-500/15 border border-rose-400/30 px-3 py-1.5 rounded-xl hover:bg-rose-500/25 transition-all cursor-pointer"
          >
            View Worklist
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Target Orgs"
          value={organisations.length}
          subtitle={`${primaryOrgs.length} Primary • ${secondaryOrgs.length} Secondary`}
          icon={
            <Building2 className="w-5 h-5" />
          }
          iconBgColor="bg-[#1F5F8B]/30"
          iconTextColor="text-[#49BFAE]"
          onClick={() =>
            navigate('/organisations')
          }
        />

        <StatCard
          title="Active Pipeline Value"
          value={formatCurrency(
            totalOpenValue
          )}
          subtitle={`${openOpps.length} Open commercial opportunities`}
          icon={
            <TrendingUp className="w-5 h-5" />
          }
          iconBgColor="bg-[#123B5D]"
          iconTextColor="text-[#49BFAE]"
          onClick={() =>
            navigate('/opportunities')
          }
        />

        <StatCard
          title="Action Items Due"
          value={
            overdueTasks.length +
            todayTasks.length
          }
          subtitle={`${overdueTasks.length} Overdue • ${todayTasks.length} Due today`}
          icon={
            <Clock className="w-5 h-5" />
          }
          iconBgColor={
            overdueTasks.length > 0
              ? 'bg-rose-500/15'
              : 'bg-amber-500/15'
          }
          iconTextColor={
            overdueTasks.length > 0
              ? 'text-rose-300'
              : 'text-amber-300'
          }
          onClick={() =>
            navigate('/worklist')
          }
        />

        <StatCard
          title="Total Deals Closed"
          value={formatCurrency(
            totalWonValue
          )}
          subtitle={`${wonOpps.length} Won contracts to date`}
          icon={
            <Target className="w-5 h-5" />
          }
          iconBgColor="bg-[#1F5F8B]/30"
          iconTextColor="text-[#49BFAE]"
          onClick={() =>
            navigate('/opportunities')
          }
        />
      </div>

      {/* Action Items / Strategic Targets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Worklist */}
        <div className="relative overflow-hidden bg-[#0E2A47] rounded-3xl border border-[#24465F] p-5 sm:p-6 shadow-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2F86B8]/60 to-transparent" />

          <div className="relative flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#24465F]">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#49BFAE]" />

                  <h3 className="text-sm font-bold text-white">
                    Urgent Action Items
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate('/worklist')
                  }
                  className="text-xs text-[#49BFAE] hover:text-white font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  View all ({tasks.length})
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="mt-3 divide-y divide-[#24465F]/70">
                {tasks
                  .filter(
                    (task) =>
                      task.status !==
                      'COMPLETED'
                  )
                  .slice(0, 5).length === 0 ? (
                  <p className="py-8 text-center text-xs text-[#8EA5B5]">
                    No open action items. Great
                    job.
                  </p>
                ) : (
                  tasks
                    .filter(
                      (task) =>
                        task.status !==
                        'COMPLETED'
                    )
                    .slice(0, 5)
                    .map((task) => {
                      const organisation =
                        organisations.find(
                          (org) =>
                            org.id ===
                            task.organisationId
                        );

                      const isOverdue =
                        Boolean(
                          task.dueDate &&
                            !isNaN(
                              new Date(
                                task.dueDate
                              ).getTime()
                            ) &&
                            new Date(
                              task.dueDate
                            )
                              .toISOString()
                              .split(
                                'T'
                              )[0] <
                              todayStr
                        );

                      return (
                        <div
                          key={task.id}
                          className="py-3 flex items-start justify-between gap-3 hover:bg-[#123B5D]/60 rounded-xl px-2.5 transition-colors"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={
                                task.status ===
                                'COMPLETED'
                              }
                              onChange={() =>
                                handleToggleTask(
                                  task
                                )
                              }
                              className="w-4 h-4 mt-0.5 rounded bg-[#123B5D] border-[#48708A] text-[#49BFAE] focus:ring-[#49BFAE] cursor-pointer"
                            />

                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {task.title}
                              </p>

                              <p className="text-[11px] text-[#8EA5B5] mt-0.5 truncate">
                                Target:{' '}
                                <span className="font-medium text-[#D7E6F0]">
                                  {organisation?.name ||
                                    'Unknown'}
                                </span>
                              </p>

                              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                <PriorityBadge
                                  priority={
                                    task.priority
                                  }
                                />

                                <span
                                  className={[
                                    'text-[10px] font-semibold px-2 py-0.5 rounded-lg border',
                                    isOverdue
                                      ? 'bg-rose-500/10 text-rose-300 border-rose-400/30'
                                      : 'bg-[#123B5D] text-[#B7C8D5] border-[#2F86B8]/30',
                                  ].join(' ')}
                                >
                                  {isOverdue
                                    ? 'Overdue: '
                                    : 'Due: '}

                                  {task.dueDate &&
                                  !isNaN(
                                    new Date(
                                      task.dueDate
                                    ).getTime()
                                  )
                                    ? new Date(
                                        task.dueDate
                                      ).toLocaleDateString(
                                        [],
                                        {
                                          month:
                                            'short',
                                          day:
                                            'numeric',
                                        }
                                      )
                                    : 'No due date'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-[#24465F]">
              <button
                type="button"
                onClick={() =>
                  navigate('/worklist')
                }
                className="w-full py-2.5 text-center text-xs font-semibold text-[#C6D6E1] hover:text-white bg-[#123B5D] hover:bg-[#1F5F8B] border border-[#2F86B8]/30 rounded-xl transition-all cursor-pointer"
              >
                Open Full My Worklist Engine
              </button>
            </div>
          </div>
        </div>

        {/* Strategic Targets */}
        <div className="relative overflow-hidden bg-[#0E2A47] rounded-3xl border border-[#24465F] p-5 sm:p-6 shadow-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#49BFAE]/50 to-transparent" />

          <div className="relative flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#24465F]">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#49BFAE]" />

                  <h3 className="text-sm font-bold text-white">
                    Strategic Target Organisations
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate('/organisations')
                  }
                  className="text-xs text-[#49BFAE] hover:text-white font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  View all ({organisations.length})
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="mt-3 divide-y divide-[#24465F]/70">
                {primaryOrgs
                  .slice(0, 5)
                  .map((organisation) => (
                    <div
                      key={organisation.id}
                      onClick={() =>
                        navigate(
                          `/organisations/${organisation.id}`
                        )
                      }
                      className="py-3 flex items-center justify-between gap-3 hover:bg-[#123B5D]/60 rounded-xl px-2.5 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-white truncate">
                            {organisation.name}
                          </h4>

                          <OrgCategoryBadge
                            category={
                              organisation.category
                            }
                          />
                        </div>

                        <p className="text-[11px] text-[#8EA5B5] mt-0.5 truncate">
                          {organisation.sector} •{' '}
                          {organisation.location ||
                            'Papua New Guinea'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <PriorityBadge
                          priority={
                            organisation.priority
                          }
                        />

                        <span className="text-[10px] text-[#8EA5B5] block mt-1">
                          {organisation.lastEngagementDate &&
                          !isNaN(
                            new Date(
                              organisation.lastEngagementDate
                            ).getTime()
                          )
                            ? `Last: ${new Date(
                                organisation.lastEngagementDate
                              ).toLocaleDateString(
                                [],
                                {
                                  month:
                                    'short',
                                  day: 'numeric',
                                }
                              )}`
                            : 'No engagements yet'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-[#24465F]">
              <button
                type="button"
                onClick={() =>
                  navigate('/organisations')
                }
                className="w-full py-2.5 text-center text-xs font-semibold text-[#C6D6E1] hover:text-white bg-[#123B5D] hover:bg-[#1F5F8B] border border-[#2F86B8]/30 rounded-xl transition-all cursor-pointer"
              >
                Explore All Target Organisations & Aliases
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Engagements */}
      <div className="relative overflow-hidden bg-[#0E2A47] rounded-3xl border border-[#24465F] p-5 sm:p-6 shadow-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2878A8]/60 to-transparent" />

        <div className="relative">
          <div className="flex items-center justify-between pb-3 border-b border-[#24465F]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#49BFAE]" />

              <h3 className="text-sm font-bold text-white">
                Latest BD Engagements Logged
              </h3>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate('/engagements')
              }
              className="text-xs text-[#49BFAE] hover:text-white font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              View all ({engagements.length})
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {recentEngagements.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#8EA5B5]">
              No recent engagements logged.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentEngagements.map(
                (engagement) => {
                  const organisation =
                    organisations.find(
                      (org) =>
                        org.id ===
                        engagement.organisationId
                    );

                  return (
                    <div
                      key={engagement.id}
                      onClick={() =>
                        navigate('/engagements')
                      }
                      className="p-4 rounded-2xl border border-[#24465F] bg-[#0B2034] hover:bg-[#123B5D] hover:border-[#2F86B8]/50 transition-all cursor-pointer flex flex-col justify-between shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-[#8EA5B5] mb-1">
                          <span className="font-semibold text-[#D7F5EF] bg-[#1F5F8B] px-2 py-0.5 rounded-lg border border-[#2F86B8]/50">
                            {(
                              engagement.engagementType ||
                              'MEETING'
                            ).replace(
                              /_/g,
                              ' '
                            )}
                          </span>

                          <span>
                            {engagement.engagementDate &&
                            !isNaN(
                              new Date(
                                engagement.engagementDate
                              ).getTime()
                            )
                              ? new Date(
                                  engagement.engagementDate
                                ).toLocaleDateString(
                                  [],
                                  {
                                    month:
                                      'short',
                                    day:
                                      'numeric',
                                  }
                                )
                              : 'Recent'}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-white truncate mt-2">
                          {organisation?.name ||
                            'Organisation'}
                        </h4>

                        <p className="text-xs text-[#B7C8D5] mt-1 line-clamp-2">
                          {engagement.details}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#24465F] flex items-center justify-between text-[11px] text-[#8EA5B5]">
                        <span className="truncate">
                          By:{' '}
                          {engagement.assignedTo}
                        </span>

                        <span className="text-[#49BFAE] font-medium">
                          {engagement.status.replace(
                            /_/g,
                            ' '
                          )}
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <OrganisationFormModal
        isOpen={showOrgModal}
        existingOrgs={organisations}
        onClose={() =>
          setShowOrgModal(false)
        }
        onSuccess={(newOrganisation) => {
          setOrganisations((previous) => [
            newOrganisation,
            ...previous,
          ]);
        }}
      />

      <EngagementFormModal
        isOpen={showEngageModal}
        organisations={organisations}
        onClose={() =>
          setShowEngageModal(false)
        }
        onSuccess={(saved) => {
          setEngagements((previous) => [
            saved,
            ...previous,
          ]);
        }}
      />

      <OpportunityFormModal
        isOpen={showOppModal}
        organisations={organisations}
        onClose={() =>
          setShowOppModal(false)
        }
        onSuccess={(saved) => {
          setOpportunities((previous) => [
            saved,
            ...previous,
          ]);
        }}
      />
    </div>
  );
};