import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { taskService } from '../services/taskService';
import { organisationService } from '../services/organisationService';
import { Task, Organisation, TaskStatus } from '../types';
import { TaskStatusBadge, PriorityBadge } from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import {
  CheckSquare,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Trash2,
  Edit2,
  Building2,
  User,
  Ban,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const WorklistPage: React.FC = () => {
  const { currentUser, allUsers, isAdmin, isBDMManager } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedStatusTab, setSelectedStatusTab] = useState<
    'PENDING' | 'OVERDUE' | 'TODAY' | 'COMPLETED'
  >('PENDING');

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManageAllTasks = isAdmin || isBDMManager;

  const isClosedTask = (status: TaskStatus) =>
    status === 'COMPLETED' || status === 'CANCELLED';

  const isActiveTask = (status: TaskStatus) => !isClosedTask(status);

  const getLocalDateString = (dateValue?: string | null): string => {
    if (!dateValue) return '';

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const getTodayString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const loadData = async () => {
    setLoading(true);

    try {
      const [tList, oList] = await Promise.all([
        taskService.getTasksForUser(currentUser),
        organisationService.getAll(),
      ]);

      setTasks(tList);
      setOrganisations(oList);
    } catch (error) {
      console.error('Error loading worklist:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid, currentUser?.role]);

  const canManageTask = (task: Task): boolean => {
    if (!currentUser) return false;

    return (
      canManageAllTasks ||
      task.createdBy === currentUser.uid ||
      task.assignedTo === currentUser.uid
    );
  };

  const handleToggleTaskStatus = async (task: Task) => {
    if (!currentUser || !canManageTask(task)) return;

    // Cancelled tasks must be managed explicitly through the edit form.
    if (task.status === 'CANCELLED') return;

    const isNowCompleted = task.status !== 'COMPLETED';

    const newStatus: TaskStatus = isNowCompleted ? 'COMPLETED' : 'OPEN';
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

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: newStatus,
                completedDate,
                completedBy,
                updatedBy,
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      );
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTask || !currentUser) return;

    if (!canManageTask(deletingTask)) {
      console.warn('User does not have permission to delete this task.');
      setDeletingTask(null);
      return;
    }

    setIsDeleting(true);

    try {
      await taskService.delete(deletingTask.id);
      setTasks((prev) =>
        prev.filter((task) => task.id !== deletingTask.id)
      );
      setDeletingTask(null);
    } catch (error) {
      console.error('Error deleting task:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSnooze = async (
    task: Task,
    daysToAdd: number
  ) => {
    if (!currentUser || !canManageTask(task)) return;
    if (isClosedTask(task.status)) return;

    const currentDue = new Date(task.dueDate);

    if (Number.isNaN(currentDue.getTime())) {
      console.error('Cannot snooze task with an invalid due date.');
      return;
    }

    currentDue.setDate(
      currentDue.getDate() + daysToAdd
    );

    const newDueISO = currentDue.toISOString();
    const updatedBy = currentUser.uid;

    try {
      await taskService.update(task.id, {
        dueDate: newDueISO,
        updatedBy,
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                dueDate: newDueISO,
                updatedBy,
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      );
    } catch (error) {
      console.error('Error snoozing task:', error);
    }
  };

  if (loading) {
    return (
      <LoadingSpinner text="Loading My Worklist actions..." />
    );
  }

  const todayStr = getTodayString();

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // User filter
    if (
      canManageAllTasks &&
      selectedUserFilter !== 'ALL' &&
      task.assignedTo !== selectedUserFilter
    ) {
      return false;
    }

    // Priority filter
    if (
      selectedPriority !== 'ALL' &&
      task.priority !== selectedPriority
    ) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();

      const org = organisations.find(
        (organisation) =>
          organisation.id === task.organisationId
      );

      const matchTitle = task.title
        .toLowerCase()
        .includes(query);

      const matchDescription =
        task.description
          ?.toLowerCase()
          .includes(query) ?? false;

      const matchOrganisation =
        org?.name
          .toLowerCase()
          .includes(query) ?? false;

      const assignedUser = allUsers.find(
        (user) => user.uid === task.assignedTo
      );

      const matchAssignee =
        assignedUser?.displayName
          .toLowerCase()
          .includes(query) ?? false;

      if (
        !matchTitle &&
        !matchDescription &&
        !matchOrganisation &&
        !matchAssignee
      ) {
        return false;
      }
    }

    const taskDueStr = getLocalDateString(task.dueDate);

    // Status Tab filter
    switch (selectedStatusTab) {
      case 'COMPLETED':
        return isClosedTask(task.status);

      case 'OVERDUE':
        return (
          isActiveTask(task.status) &&
          taskDueStr !== '' &&
          taskDueStr < todayStr
        );

      case 'TODAY':
        return (
          isActiveTask(task.status) &&
          taskDueStr === todayStr
        );

      case 'PENDING':
      default:
        return isActiveTask(task.status);
    }
  });

  const overdueCount = tasks.filter((task) => {
    const taskDueStr = getLocalDateString(task.dueDate);

    return (
      isActiveTask(task.status) &&
      taskDueStr !== '' &&
      taskDueStr < todayStr
    );
  }).length;

  const todayCount = tasks.filter((task) => {
    const taskDueStr = getLocalDateString(task.dueDate);

    return (
      isActiveTask(task.status) &&
      taskDueStr === todayStr
    );
  }).length;

  const openCount = tasks.filter((task) =>
    isActiveTask(task.status)
  ).length;

  const completedCount = tasks.filter((task) =>
    isClosedTask(task.status)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CheckSquare className="w-4 h-4" />
            </div>
            My Worklist & Actions
          </h1>

          <p className="text-xs text-neutral-400 mt-0.5">
            Manage target follow-ups, deliverable deadlines,
            and overdue action items
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTask(null);
            setShowTaskModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 border border-indigo-500/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create New Action Item
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 overflow-x-auto pb-px">
        <button
          onClick={() =>
            setSelectedStatusTab('PENDING')
          }
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            selectedStatusTab === 'PENDING'
              ? 'border-indigo-500 text-white bg-white/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span>All Pending Actions</span>

          <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-neutral-200">
            {openCount}
          </span>
        </button>

        <button
          onClick={() =>
            setSelectedStatusTab('OVERDUE')
          }
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            selectedStatusTab === 'OVERDUE'
              ? 'border-rose-500 text-rose-300 bg-rose-500/10'
              : 'border-transparent text-neutral-400 hover:text-rose-300'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />

          <span>Overdue</span>

          {overdueCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
              {overdueCount}
            </span>
          )}
        </button>

        <button
          onClick={() =>
            setSelectedStatusTab('TODAY')
          }
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            selectedStatusTab === 'TODAY'
              ? 'border-amber-500 text-amber-300 bg-amber-500/10'
              : 'border-transparent text-neutral-400 hover:text-amber-300'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-400" />

          <span>Due Today</span>

          {todayCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              {todayCount}
            </span>
          )}
        </button>

        <button
          onClick={() =>
            setSelectedStatusTab('COMPLETED')
          }
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            selectedStatusTab === 'COMPLETED'
              ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />

          <span>Closed</span>

          <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-neutral-200">
            {completedCount}
          </span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />

          <input
            type="text"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
            placeholder="Search action items or targets..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(event) =>
              setSelectedPriority(event.target.value)
            }
            className="px-3 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">
              All Priorities
            </option>
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

          {/* Assignee Filter - Management roles only */}
          {canManageAllTasks && (
            <select
              value={selectedUserFilter}
              onChange={(event) =>
                setSelectedUserFilter(event.target.value)
              }
              className="px-3 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">
                All Assignees
              </option>

              {allUsers.map((user) => (
                <option
                  key={user.uid}
                  value={user.uid}
                >
                  {user.displayName}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          title="No action items found"
          description="There are no tasks matching your selected filters."
          icon={
            <CheckSquare className="w-8 h-8 text-neutral-400" />
          }
          action={{
            label: 'Create Action Item',
            onClick: () => {
              setEditingTask(null);
              setShowTaskModal(true);
            },
          }}
        />
      ) : (
        <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg divide-y divide-white/5 overflow-hidden">
          {filteredTasks.map((task) => {
            const organisation = organisations.find(
              (org) =>
                org.id === task.organisationId
            );

            const assignedUser = allUsers.find(
              (user) =>
                user.uid === task.assignedTo
            );

            const isCompleted =
              task.status === 'COMPLETED';

            const isCancelled =
              task.status === 'CANCELLED';

            const isClosed =
              isClosedTask(task.status);

            const taskDueStr =
              getLocalDateString(task.dueDate);

            let formattedDate = 'No date';

            if (task.dueDate) {
              const dueDate = new Date(
                task.dueDate
              );

              if (!Number.isNaN(dueDate.getTime())) {
                formattedDate =
                  dueDate.toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
              }
            }

            const isOverdue =
              isActiveTask(task.status) &&
              taskDueStr !== '' &&
              taskDueStr < todayStr;

            const isDueToday =
              isActiveTask(task.status) &&
              taskDueStr === todayStr;

            const userCanManage =
              canManageTask(task);

            return (
              <div
                key={task.id}
                className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/5 ${
                  isOverdue
                    ? 'bg-rose-500/5'
                    : isCancelled
                    ? 'bg-neutral-500/5'
                    : ''
                }`}
              >
                {/* Left Task Information */}
                <div className="flex items-start gap-3 min-w-0">
                  {!isCancelled ? (
                    <button
                      onClick={() =>
                        handleToggleTaskStatus(task)
                      }
                      disabled={!userCanManage}
                      className={`mt-0.5 p-1 rounded-lg transition-colors shrink-0 ${
                        userCanManage
                          ? 'hover:bg-white/10 text-neutral-400 hover:text-indigo-400 cursor-pointer'
                          : 'text-neutral-600 cursor-not-allowed'
                      }`}
                      title={
                        !userCanManage
                          ? 'You do not have permission to update this task'
                          : isCompleted
                          ? 'Mark open'
                          : 'Mark completed'
                      }
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-lg border-2 border-white/20 hover:border-indigo-500 flex items-center justify-center transition-colors" />
                      )}
                    </button>
                  ) : (
                    <div
                      className="mt-1 p-1 text-neutral-500 shrink-0"
                      title="Cancelled task"
                    >
                      <Ban className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-sm font-semibold ${
                          isClosed
                            ? 'line-through text-neutral-500'
                            : 'text-white'
                        }`}
                      >
                        {task.title}
                      </h3>

                      <PriorityBadge
                        priority={task.priority}
                      />

                      <TaskStatusBadge
                        status={task.status}
                      />
                    </div>

                    {task.description && (
                      <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-4 text-xs text-neutral-400 flex-wrap">
                      {organisation && (
                        <Link
                          to={`/organisations/${organisation.id}`}
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          {organisation.name}
                        </Link>
                      )}

                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-neutral-500" />

                        {assignedUser?.displayName ||
                          task.assignedTo}
                      </span>

                      <span
                        className={`flex items-center gap-1 font-semibold ${
                          isOverdue
                            ? 'text-rose-400'
                            : isDueToday
                            ? 'text-amber-400'
                            : isCancelled
                            ? 'text-neutral-500'
                            : 'text-neutral-400'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />

                        Due: {formattedDate}

                        {isOverdue &&
                          ' (Overdue)'}

                        {isDueToday &&
                          ' (Today)'}

                        {isCancelled &&
                          ' (Cancelled)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                {userCanManage && (
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!isClosed && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            handleSnooze(task, 1)
                          }
                          className="px-2 py-1 text-[11px] font-medium text-neutral-300 hover:text-white hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer"
                          title="Snooze +1 Day"
                        >
                          +1 Day
                        </button>

                        <button
                          onClick={() =>
                            handleSnooze(task, 7)
                          }
                          className="px-2 py-1 text-[11px] font-medium text-neutral-300 hover:text-white hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer"
                          title="Snooze +1 Week"
                        >
                          +1 Week
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setEditingTask(task);
                        setShowTaskModal(true);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                      title="Edit action item"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() =>
                        setDeletingTask(task)
                      }
                      className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete action item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Task Form Modal */}
      <TaskFormModal
        isOpen={showTaskModal}
        task={editingTask}
        organisations={organisations}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
        }}
        onSuccess={(savedTask) => {
          if (editingTask) {
            setTasks((prev) =>
              prev.map((task) =>
                task.id === savedTask.id
                  ? savedTask
                  : task
              )
            );
          } else {
            setTasks((prev) => [
              savedTask,
              ...prev,
            ]);
          }
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deletingTask}
        title="Delete Action Item?"
        message={`Are you sure you want to delete "${deletingTask?.title}"?`}
        confirmLabel="Delete Task"
        variant="danger"
        onConfirm={handleDeleteTask}
        onCancel={() =>
          setDeletingTask(null)
        }
        isProcessing={isDeleting}
      />
    </div>
  );
};