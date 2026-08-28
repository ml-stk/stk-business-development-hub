import React, {
  useState,
  useEffect,
} from 'react';
import {
  X,
  CheckSquare,
  AlertCircle,
  User,
  Lock,
} from 'lucide-react';
import {
  Task,
  Organisation,
  Contact,
  TaskPriority,
  TaskStatus,
} from '../../types';
import { taskService } from '../../services/taskService';
import { contactService } from '../../services/contactService';
import { useAuth } from '../../contexts/AuthContext';

interface TaskFormModalProps {
  isOpen: boolean;
  task?: Task | null;
  defaultOrganisationId?: string;
  organisations: Organisation[];
  onClose: () => void;
  onSuccess: (savedTask: Task) => void;
}

export const TaskFormModal: React.FC<
  TaskFormModalProps
> = ({
  isOpen,
  task,
  defaultOrganisationId,
  organisations,
  onClose,
  onSuccess,
}) => {
  const {
    currentUser,
    allUsers,
    isAdmin,
    isBDMManager,
  } = useAuth();

  const canReassign =
    isAdmin || isBDMManager;

  const [organisationId, setOrganisationId] =
    useState('');

  const [contactId, setContactId] =
    useState('');

  const [assignedTo, setAssignedTo] =
    useState('');

  const [title, setTitle] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [dueDate, setDueDate] =
    useState('');

  const [priority, setPriority] =
    useState<TaskPriority>('HIGH');

  const [status, setStatus] =
    useState<TaskStatus>('OPEN');

  const [contacts, setContacts] =
    useState<Contact[]>([]);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const toDateInput = (
    iso?: string | null
  ) => {
    if (!iso) return '';

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!isOpen) return;

    if (task) {
      setOrganisationId(
        task.organisationId
      );

      setContactId(
        task.contactId || ''
      );

      setAssignedTo(
        task.assignedTo
      );

      setTitle(task.title);

      setDescription(
        task.description || ''
      );

      setDueDate(
        toDateInput(task.dueDate)
      );

      setPriority(
        task.priority
      );

      setStatus(
        task.status
      );
    } else {
      const defaultOrg =
        defaultOrganisationId ||
        organisations[0]?.id ||
        '';

      setOrganisationId(defaultOrg);
      setContactId('');

      setAssignedTo(
        currentUser?.uid || ''
      );

      setTitle('');
      setDescription('');

      setDueDate(
        toDateInput(
          new Date().toISOString()
        )
      );

      setPriority('HIGH');
      setStatus('OPEN');
    }

    setErrorMessage(null);
  }, [
    task,
    defaultOrganisationId,
    organisations,
    isOpen,
    currentUser?.uid,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadContacts = async () => {
      if (!organisationId) {
        if (!cancelled) {
          setContacts([]);
        }

        return;
      }

      try {
        const contactList =
          await contactService.getByOrganisation(
            organisationId
          );

        if (!cancelled) {
          setContacts(contactList);
        }
      } catch (error) {
        console.error(
          'Error loading organisation contacts:',
          error
        );

        if (!cancelled) {
          setContacts([]);
        }
      }
    };

    loadContacts();

    return () => {
      cancelled = true;
    };
  }, [organisationId]);

  if (!isOpen) return null;

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setErrorMessage(null);

    if (!currentUser) {
      setErrorMessage(
        'Authentication is required to save tasks.'
      );
      return;
    }

    if (!organisationId) {
      setErrorMessage(
        'Please select a Target Organisation.'
      );
      return;
    }

    if (!title.trim()) {
      setErrorMessage(
        'Task Action Title is required.'
      );
      return;
    }

    if (!dueDate) {
      setErrorMessage(
        'Due Date is required.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Store date as local midnight.
      const dueDateISO =
        new Date(
          `${dueDate}T00:00:00`
        ).toISOString();

      const currentUid =
        currentUser.uid;

      const finalAssignedTo =
        canReassign
          ? assignedTo || currentUid
          : task
          ? task.assignedTo
          : currentUid;

      if (task) {
        const isCompleted =
          status === 'COMPLETED';

        const completedDate =
          isCompleted
            ? task.completedDate ||
              new Date().toISOString()
            : null;

        const completedBy =
          isCompleted
            ? task.completedBy ||
              currentUid
            : null;

        await taskService.update(
          task.id,
          {
            organisationId,
            contactId:
              contactId || null,
            assignedTo:
              finalAssignedTo,
            title:
              title.trim(),
            description:
              description.trim(),
            dueDate:
              dueDateISO,
            priority,
            status,
            completedDate,
            completedBy,
            updatedBy:
              currentUid,
          }
        );

        onSuccess({
          ...task,
          organisationId,
          contactId:
            contactId || null,
          assignedTo:
            finalAssignedTo,
          title:
            title.trim(),
          description:
            description.trim(),
          dueDate:
            dueDateISO,
          priority,
          status,
          completedDate,
          completedBy,
          updatedBy:
            currentUid,
          updatedAt:
            new Date().toISOString(),
        });
      } else {
        const isCompleted =
          status === 'COMPLETED';

        const created =
          await taskService.create({
            organisationId,
            contactId:
              contactId || null,
            engagementId: null,
            opportunityId: null,
            assignedTo:
              finalAssignedTo,
            title:
              title.trim(),
            description:
              description.trim(),
            dueDate:
              dueDateISO,
            priority,
            status,
            completedDate:
              isCompleted
                ? new Date().toISOString()
                : null,
            completedBy:
              isCompleted
                ? currentUid
                : null,
            createdBy:
              currentUid,
            updatedBy:
              currentUid,
          });

        onSuccess(created);
      }

      onClose();
    } catch (error: any) {
      console.error(
        'Error saving task:',
        error
      );

      setErrorMessage(
        error?.message ||
          'Failed to save task.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const assignedUser =
    allUsers.find(
      (user) =>
        user.uid === assignedTo
    ) || currentUser;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckSquare className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {task
                  ? 'Edit Action Item'
                  : 'New Follow-Up Action Item'}
              </h3>

              <p className="text-xs text-slate-500">
                Create and manage target follow-up actions
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
          onSubmit={handleSubmit}
          className="mt-4 space-y-4"
        >
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Organisation */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Target Organisation *
            </label>

            <select
              required
              disabled={
                !!defaultOrganisationId &&
                !task
              }
              value={organisationId}
              onChange={(event) => {
                setOrganisationId(
                  event.target.value
                );
                setContactId('');
              }}
              className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-100 disabled:text-slate-600"
            >
              <option value="">
                -- Select Organisation --
              </option>

              {organisations.map(
                (organisation) => (
                  <option
                    key={organisation.id}
                    value={organisation.id}
                  >
                    {organisation.name}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Related Contact */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Related Stakeholder Contact
              (Optional)
            </label>

            <select
              value={contactId}
              onChange={(event) =>
                setContactId(
                  event.target.value
                )
              }
              className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">
                -- General Organisation Action --
              </option>

              {contacts.map((contact) => (
                <option
                  key={contact.id}
                  value={contact.id}
                >
                  {contact.fullName}
                  {contact.jobTitle
                    ? ` (${contact.jobTitle})`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Task Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Task Action Title *
            </label>

            <input
              type="text"
              required
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value
                )
              }
              placeholder="e.g. Deliver revised Managed SOC pricing schedule"
              className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Action Description / Deliverable
            </label>

            <textarea
              rows={3}
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              placeholder="Specific deliverables, discussion points, or preparation notes..."
              className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-y"
            />
          </div>

          {/* Due Date and Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Due Date *
              </label>

              <input
                type="date"
                required
                value={dueDate}
                onChange={(event) =>
                  setDueDate(
                    event.target.value
                  )
                }
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Priority *
              </label>

              <select
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target
                      .value as TaskPriority
                  )
                }
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
          </div>

          {/* Assigned Owner */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Assigned Owner *
            </label>

            {canReassign ? (
              <select
                value={assignedTo}
                onChange={(event) =>
                  setAssignedTo(
                    event.target.value
                  )
                }
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {allUsers.map((user) => (
                  <option
                    key={user.uid}
                    value={user.uid}
                  >
                    {user.displayName}
                    {user.role
                      ? ` (${user.role})`
                      : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full px-3 py-2 text-sm text-slate-700 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />

                  <span className="truncate">
                    {assignedUser?.displayName ||
                      'Current User'}
                  </span>
                </span>

                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
            )}

            {!canReassign && (
              <p className="text-[11px] text-slate-500 mt-1">
                Action ownership can only be
                reassigned by an Administrator or
                BDM Manager.
              </p>
            )}
          </div>

          {/* Status - Edit Mode */}
          {task && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Status
              </label>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target
                      .value as TaskStatus
                  )
                }
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="OPEN">
                  Open
                </option>

                <option value="IN_PROGRESS">
                  In Progress
                </option>

                <option value="COMPLETED">
                  Completed
                </option>

                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>
            </div>
          )}

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
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting
                ? 'Saving...'
                : task
                ? 'Update Action'
                : 'Create Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};