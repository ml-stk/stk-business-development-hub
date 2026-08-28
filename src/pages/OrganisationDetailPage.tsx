import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  useParams,
  useNavigate,
  Link,
} from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import {
  organisationService,
} from '../services/organisationService';

import {
  contactService,
} from '../services/contactService';

import {
  engagementService,
} from '../services/engagementService';

import {
  opportunityService,
} from '../services/opportunityService';

import {
  taskService,
} from '../services/taskService';

import {
  Organisation,
  Contact,
  Engagement,
  Opportunity,
  Task,
} from '../types';

import {
  OrgCategoryBadge,
  OrgStatusBadge,
  PriorityBadge,
  TaskStatusBadge,
  OpportunityStatusBadge,
  PipelineStageBadge,
  EngagementStatusBadge,
} from '../components/common/StatusBadge';

import {
  LoadingSpinner,
} from '../components/common/LoadingSpinner';

import {
  CommandChainTree,
} from '../components/hierarchy/CommandChainTree';

import {
  OrganisationFormModal,
} from '../components/organisations/OrganisationFormModal';

import {
  ContactFormModal,
} from '../components/contacts/ContactFormModal';

import {
  EngagementFormModal,
} from '../components/engagements/EngagementFormModal';

import {
  OpportunityFormModal,
} from '../components/opportunities/OpportunityFormModal';

import {
  TaskFormModal,
} from '../components/tasks/TaskFormModal';

import {
  Building2,
  Users,
  Network,
  CalendarDays,
  TrendingUp,
  CheckSquare,
  Globe,
  MapPin,
  Tag,
  Edit2,
  Plus,
  ArrowLeft,
  ExternalLink,
  FileText,
  User,
} from 'lucide-react';

export const OrganisationDetailPage: React.FC =
  () => {
    const { id } =
      useParams<{ id: string }>();

    const navigate =
      useNavigate();

    const {
      currentUser,
      allUsers,
      isAdmin,
    } = useAuth();

    const [loading, setLoading] =
      useState(true);

    const [
      organisation,
      setOrganisation,
    ] =
      useState<Organisation | null>(
        null
      );

    const [
      allOrgs,
      setAllOrgs,
    ] =
      useState<Organisation[]>([]);

    const [
      contacts,
      setContacts,
    ] =
      useState<Contact[]>([]);

    const [
      engagements,
      setEngagements,
    ] =
      useState<Engagement[]>([]);

    const [
      opportunities,
      setOpportunities,
    ] =
      useState<Opportunity[]>([]);

    const [
      tasks,
      setTasks,
    ] =
      useState<Task[]>([]);

    type ActiveTab =
      | 'OVERVIEW'
      | 'COMMAND_CHAIN'
      | 'CONTACTS'
      | 'ENGAGEMENTS'
      | 'OPPORTUNITIES'
      | 'TASKS';

    const [
      activeTab,
      setActiveTab,
    ] =
      useState<ActiveTab>(
        'COMMAND_CHAIN'
      );

    // Organisation modal
    const [
      showEditOrgModal,
      setShowEditOrgModal,
    ] =
      useState(false);

    // Contact modal
    const [
      showContactModal,
      setShowContactModal,
    ] =
      useState(false);

    const [
      editingContact,
      setEditingContact,
    ] =
      useState<Contact | null>(
        null
      );

    // Engagement modal
    const [
      showEngageModal,
      setShowEngageModal,
    ] =
      useState(false);

    const [
      editingEngage,
      setEditingEngage,
    ] =
      useState<Engagement | null>(
        null
      );

    // Opportunity modal
    const [
      showOppModal,
      setShowOppModal,
    ] =
      useState(false);

    const [
      editingOpp,
      setEditingOpp,
    ] =
      useState<Opportunity | null>(
        null
      );

    // Task modal
    const [
      showTaskModal,
      setShowTaskModal,
    ] =
      useState(false);

    const [
      editingTask,
      setEditingTask,
    ] =
      useState<Task | null>(
        null
      );

    /**
     * Load the complete organisation detail context.
     *
     * All child collections are explicitly queried using
     * the selected organisation ID. This prevents accidental
     * mixing of records from another organisation.
     */
    const loadData =
      useCallback(
        async () => {
          if (!id) {
            return;
          }

          setLoading(true);

          try {
            const [
              org,
              orgList,
              contactList,
              engageList,
              oppList,
              taskList,
            ] =
              await Promise.all([
                organisationService.getById(
                  id
                ),

                organisationService.getAll(),

                contactService.getByOrganisation(
                  id
                ),

                engagementService.getByOrganisation(
                  id
                ),

                opportunityService.getByOrganisation(
                  id
                ),

                taskService.getByOrganisation(
                  id,
                  currentUser
                ),
              ]);

            setOrganisation(
              org
            );

            setAllOrgs(
              orgList
            );

            setContacts(
              contactList
            );

            setEngagements(
              engageList
            );

            setOpportunities(
              oppList
            );

            setTasks(
              taskList
            );
          } catch (error) {
            console.error(
              'Error loading organisation detail:',
              error
            );
          } finally {
            setLoading(false);
          }
        },
        [
          id,
          currentUser,
        ]
      );

    useEffect(() => {
      void loadData();
    }, [loadData]);

    if (loading) {
      return (
        <LoadingSpinner
          text="Loading organisation profile & command chain..."
        />
      );
    }

    if (!organisation) {
      return (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />

          <h2 className="text-base font-bold text-slate-800">
            Organisation Not Found
          </h2>

          <p className="text-xs text-slate-500 mt-1 mb-4">
            The requested target organisation does
            not exist or has been deleted.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate('/organisations')
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Back to Organisations
          </button>
        </div>
      );
    }

    const assignedBDM =
      allUsers.find(
        (user) =>
          user.uid ===
          organisation.assignedBDMId
      );

    const openOppsValue =
      opportunities
        .filter(
          (opportunity) =>
            opportunity.status ===
            'OPEN'
        )
        .reduce(
          (
            sum,
            opportunity
          ) =>
            sum +
            (opportunity.estimatedValue ||
              0),
          0
        );

    const canEditOrganisation =
      Boolean(
        currentUser &&
          (
            isAdmin ||
            currentUser.role ===
              'BDM_MANAGER' ||
            (
              currentUser.role ===
                'BDM' &&
              organisation.assignedBDMId ===
                currentUser.uid
            )
          )
      );

    return (
      <div className="space-y-6">

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link
            to="/organisations"
            className="hover:text-indigo-600 transition-colors flex items-center gap-1 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Target Organisations
          </Link>

          <span>/</span>

          <span className="font-semibold text-slate-900 truncate">
            {organisation.name}
          </span>
        </div>

        {/* Organisation Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">

            <div className="flex items-start gap-4">

              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-black shadow-md shadow-indigo-600/30 shrink-0">
                {organisation.name
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div>

                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    {organisation.name}
                  </h1>

                  <OrgCategoryBadge
                    category={
                      organisation.category
                    }
                  />

                  <OrgStatusBadge
                    status={
                      organisation.status
                    }
                  />

                  <PriorityBadge
                    priority={
                      organisation.priority
                    }
                  />
                </div>

                {/* Aliases */}
                {organisation.aliases &&
                  organisation.aliases.length >
                    0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-400">
                        Aliases:
                      </span>

                      {organisation.aliases.map(
                        (
                          alias
                        ) => (
                          <span
                            key={alias}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium"
                          >
                            {alias}
                          </span>
                        )
                      )}
                    </div>
                  )}

                {/* Organisation metadata */}
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 flex-wrap">

                  <span className="font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {organisation.sector}
                  </span>

                  {organisation.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {organisation.location}
                    </span>
                  )}

                  {organisation.website && (
                    <a
                      href={
                        organisation.website.startsWith(
                          'http://'
                        ) ||
                        organisation.website.startsWith(
                          'https://'
                        )
                          ? organisation.website
                          : `https://${organisation.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
                    >
                      <Globe className="w-3.5 h-3.5" />

                      <span className="max-w-xs truncate">
                        {organisation.website}
                      </span>

                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  )}

                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    BDM:{' '}
                    {assignedBDM?.displayName ||
                      'Unassigned'}
                  </span>
                </div>
              </div>
            </div>

            {/* Organisation actions */}
            <div className="flex items-center gap-2 flex-wrap self-start">

              <button
                type="button"
                onClick={() => {
                  setEditingEngage(
                    null
                  );
                  setShowEngageModal(
                    true
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
                Log Engagement
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingOpp(
                    null
                  );
                  setShowOppModal(
                    true
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                Add Opportunity
              </button>

              {canEditOrganisation && (
                <button
                  type="button"
                  onClick={() =>
                    setShowEditOrgModal(
                      true
                    )
                  }
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Edit organisation profile"
                  aria-label="Edit organisation profile"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Stakeholders
            </span>

            <span className="text-lg font-black text-slate-900">
              {contacts.length}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Engagements
            </span>

            <span className="text-lg font-black text-slate-900">
              {engagements.length}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Opportunities
            </span>

            <span className="text-lg font-black text-slate-900">
              {opportunities.length}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Open Pipeline
            </span>

            <span className="text-lg font-black text-slate-900">
              {organisationCurrencyLabel(
                openOppsValue
              )}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                'COMMAND_CHAIN'
              )
            }
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab ===
              'COMMAND_CHAIN'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>
              Command-Chain Tree
            </span>

            <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700 font-bold">
              {contacts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                'CONTACTS'
              )
            }
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab ===
              'CONTACTS'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />

            <span>
              All Stakeholders
            </span>

            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
              {contacts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                'ENGAGEMENTS'
              )
            }
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab ===
              'ENGAGEMENTS'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarDays className="w-4 h-4" />

            <span>
              Engagement History
            </span>

            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
              {engagements.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                'OPPORTUNITIES'
              )
            }
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab ===
              'OPPORTUNITIES'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />

            <span>
              Opportunities
            </span>

            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-bold">
              {opportunities.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                'TASKS'
              )
            }
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab ===
              'TASKS'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CheckSquare className="w-4 h-4" />

            <span>
              Action Items
            </span>

            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
              {tasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                'OVERVIEW'
              )
            }
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab ===
              'OVERVIEW'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />

            <span>
              Profile & Notes
            </span>
          </button>
        </div>

        {/* Command Chain */}
        {activeTab ===
          'COMMAND_CHAIN' && (
          <div className="space-y-4">

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Interactive Executive Command-Chain
              </h3>

              <button
                type="button"
                onClick={() => {
                  setEditingContact(
                    null
                  );
                  setShowContactModal(
                    true
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Stakeholder
              </button>
            </div>

            <CommandChainTree
              contacts={contacts}
              onEditContact={(
                selectedContact
              ) => {
                setEditingContact(
                  selectedContact
                );
                setShowContactModal(
                  true
                );
              }}
            />
          </div>
        )}

        {/* Contacts */}
        {activeTab ===
          'CONTACTS' && (
          <div className="space-y-4">

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                All Contacts & Stakeholders (
                {contacts.length})
              </h3>

              <button
                type="button"
                onClick={() => {
                  setEditingContact(
                    null
                  );
                  setShowContactModal(
                    true
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Contact
              </button>
            </div>

            {contacts.length ===
            0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />

                <p className="text-xs text-slate-500">
                  No contacts added yet.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">

                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                      <tr>
                        <th className="py-3 px-4">
                          Contact Name
                        </th>

                        <th className="py-3 px-3">
                          Job Title & Dept
                        </th>

                        <th className="py-3 px-3">
                          Reports To
                        </th>

                        <th className="py-3 px-3">
                          Decision Role
                        </th>

                        <th className="py-3 px-3">
                          Influence
                        </th>

                        <th className="py-3 px-3">
                          Communication
                        </th>

                        <th className="py-3 px-4 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {contacts.map(
                        (
                          contact
                        ) => {
                          const manager =
                            contacts.find(
                              (
                                candidate
                              ) =>
                                candidate.id ===
                                contact.reportsToContactId
                            );

                          return (
                            <tr
                              key={
                                contact.id
                              }
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-3.5 px-4 font-bold text-slate-900">
                                {
                                  contact.fullName
                                }
                              </td>

                              <td className="py-3.5 px-3">
                                <span className="text-slate-800 font-medium">
                                  {
                                    contact.jobTitle
                                  }
                                </span>

                                {contact.department && (
                                  <span className="block text-[11px] text-slate-500">
                                    {
                                      contact.department
                                    }
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-3 text-slate-600">
                                {manager ? (
                                  <span className="font-semibold text-indigo-600">
                                    {
                                      manager.fullName
                                    }
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">
                                    None (Root)
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-3">
                                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold text-[11px] border border-purple-200">
                                  {contact.decisionRole.replace(
                                    /_/g,
                                    ' '
                                  )}
                                </span>
                              </td>

                              <td className="py-3.5 px-3 font-semibold text-slate-700">
                                {
                                  contact.influenceLevel
                                }
                              </td>

                              <td className="py-3.5 px-3">
                                {contact.email && (
                                  <div className="text-slate-600 truncate max-w-xs">
                                    {
                                      contact.email
                                    }
                                  </div>
                                )}

                                {contact.mobile && (
                                  <div className="text-slate-500 text-[11px]">
                                    {
                                      contact.mobile
                                    }
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingContact(
                                      contact
                                    );
                                    setShowContactModal(
                                      true
                                    );
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title={`Edit ${contact.fullName}`}
                                  aria-label={`Edit ${contact.fullName}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Engagements */}
        {activeTab ===
          'ENGAGEMENTS' && (
          <div className="space-y-4">

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Engagement History & Client Meetings (
                {engagements.length})
              </h3>

              <button
                type="button"
                onClick={() => {
                  setEditingEngage(
                    null
                  );
                  setShowEngageModal(
                    true
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Engagement
              </button>
            </div>

            {engagements.length ===
            0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <CalendarDays className="w-8 h-8 text-slate-400 mx-auto mb-2" />

                <p className="text-xs text-slate-500">
                  No engagements logged yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {engagements.map(
                  (
                    engagement
                  ) => {
                    const contact =
                      contacts.find(
                        (
                          candidate
                        ) =>
                          candidate.id ===
                          engagement.contactId
                      );

                    const assignedUser =
                      allUsers.find(
                        (
                          user
                        ) =>
                          user.uid ===
                          engagement.assignedTo
                      );

                    const assignedLabel =
                      assignedUser?.displayName ||
                      engagement.assignedToName ||
                      engagement.assignedTo ||
                      'Unknown User';

                    return (
                      <div
                        key={
                          engagement.id
                        }
                        className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-indigo-200 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {engagement.engagementType.replace(
                                /_/g,
                                ' '
                              )}
                            </span>

                            <EngagementStatusBadge
                              status={
                                engagement.status
                              }
                            />

                            <span className="text-xs font-semibold text-slate-700">
                              Purpose:{' '}
                              {engagement.purpose.replace(
                                /_/g,
                                ' '
                              )}
                            </span>
                          </div>

                          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                            {new Date(
                              engagement.engagementDate
                            ).toLocaleDateString(
                              [],
                              {
                                month:
                                  'short',
                                day:
                                  'numeric',
                                year:
                                  'numeric',
                              }
                            )}
                          </span>
                        </div>

                        <div className="mt-2.5">
                          <p className="text-xs font-bold text-slate-900">
                            Discussion Details:
                          </p>

                          <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-line">
                            {
                              engagement.details
                            }
                          </p>
                        </div>

                        <div className="mt-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-xs font-bold text-slate-800">
                            Outcome & Agreed Next Steps:
                          </p>

                          <p className="text-xs text-slate-700 mt-0.5">
                            {
                              engagement.outcome
                            }
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">

                          <div className="flex items-center gap-3 flex-wrap">
                            <span>
                              Engaged By:{' '}
                              <strong className="text-slate-700">
                                {
                                  assignedLabel
                                }
                              </strong>
                            </span>

                            {contact && (
                              <span>
                                Stakeholder:{' '}
                                <strong className="text-slate-700">
                                  {
                                    contact.fullName
                                  }
                                </strong>
                              </span>
                            )}
                          </div>

                          {engagement.nextEngagementDate && (
                            <span className="text-indigo-600 font-semibold">
                              Next Follow-Up:{' '}
                              {new Date(
                                engagement.nextEngagementDate
                              ).toLocaleDateString(
                                [],
                                {
                                  month:
                                    'short',
                                  day:
                                    'numeric',
                                  year:
                                    'numeric',
                                }
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        )}

        {/* Opportunities */}
        {activeTab ===
          'OPPORTUNITIES' && (
          <div className="space-y-4">

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Commercial Opportunities (
                {opportunities.length})
              </h3>

              <button
                type="button"
                onClick={() => {
                  setEditingOpp(
                    null
                  );
                  setShowOppModal(
                    true
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Opportunity
              </button>
            </div>

            {opportunities.length ===
            0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <TrendingUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />

                <p className="text-xs text-slate-500">
                  No opportunities uncovered yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {opportunities.map(
                  (
                    opportunity
                  ) => (
                    <div
                      key={
                        opportunity.id
                      }
                      className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-indigo-200 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <OpportunityStatusBadge
                            status={
                              opportunity.status
                            }
                          />

                          <PipelineStageBadge
                            stage={
                              opportunity.pipelineStage
                            }
                          />
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 mt-2">
                          {
                            opportunity.title
                          }
                        </h4>

                        <p className="text-xs font-semibold text-indigo-700 mt-1">
                          {
                            opportunity.solutionCategory
                          }
                        </p>

                        {opportunity.description && (
                          <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
                            {
                              opportunity.description
                            }
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Estimated Value
                          </span>

                          <span className="text-sm font-black text-slate-900">
                            {
                              opportunity.currency
                            }{' '}
                            {(
                              opportunity.estimatedValue ||
                              0
                            ).toLocaleString()}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingOpp(
                              opportunity
                            );
                            setShowOppModal(
                              true
                            );
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Opportunity"
                          aria-label={`Edit ${opportunity.title}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Tasks */}
        {activeTab ===
          'TASKS' && (
          <div className="space-y-4">

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Target Action Items & Worklist (
                {tasks.length})
              </h3>

              <button
                type="button"
                onClick={() => {
                  setEditingTask(
                    null
                  );
                  setShowTaskModal(
                    true
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Action Item
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <CheckSquare className="w-8 h-8 text-slate-400 mx-auto mb-2" />

                <p className="text-xs text-slate-500">
                  No action items assigned to this target.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100">
                {tasks.map(
                  (
                    task
                  ) => (
                    <div
                      key={task.id}
                      className="p-4 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-900">
                            {task.title}
                          </h4>

                          <PriorityBadge
                            priority={
                              task.priority
                            }
                          />

                          <TaskStatusBadge
                            status={
                              task.status
                            }
                          />
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-600 mt-1">
                            {
                              task.description
                            }
                          </p>
                        )}

                        <span className="text-[11px] text-slate-400 mt-1 block">
                          Due:{' '}
                          {new Date(
                            task.dueDate
                          ).toLocaleDateString(
                            [],
                            {
                              month:
                                'short',
                              day:
                                'numeric',
                              year:
                                'numeric',
                            }
                          )}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingTask(
                            task
                          );
                          setShowTaskModal(
                            true
                          );
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit task"
                        aria-label={`Edit ${task.title}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Overview */}
        {activeTab ===
          'OVERVIEW' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Business Scope & Description
              </h3>

              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                {organisation.description ||
                  'No description provided.'}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Strategic Target Notes & Competitor Intelligence
              </h3>

              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                {organisation.notes ||
                  'No internal strategic notes recorded.'}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 md:col-span-2">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Record Metadata
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">

                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">
                    Created By
                  </span>

                  <span className="text-slate-700 font-medium">
                    {resolveUserLabel(
                      organisation.createdBy,
                      allUsers
                    )}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">
                    Created
                  </span>

                  <span className="text-slate-700 font-medium">
                    {formatDate(
                      organisation.createdAt
                    )}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">
                    Last Updated By
                  </span>

                  <span className="text-slate-700 font-medium">
                    {resolveUserLabel(
                      organisation.updatedBy,
                      allUsers
                    )}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">
                    Last Updated
                  </span>

                  <span className="text-slate-700 font-medium">
                    {formatDate(
                      organisation.updatedAt
                    )}
                  </span>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Organisation Modal */}
        <OrganisationFormModal
          isOpen={
            showEditOrgModal
          }
          organisation={
            organisation
          }
          existingOrgs={
            allOrgs
          }
          onClose={() =>
            setShowEditOrgModal(
              false
            )
          }
          onSuccess={(
            updated
          ) => {
            setOrganisation(
              updated
            );
            setShowEditOrgModal(
              false
            );
          }}
        />

        {/* Contact Modal */}
        <ContactFormModal
          isOpen={
            showContactModal
          }
          contact={
            editingContact
          }
          defaultOrganisationId={
            organisation.id
          }
          organisations={[
            organisation,
          ]}
          onClose={() => {
            setShowContactModal(
              false
            );
            setEditingContact(
              null
            );
          }}
          onSuccess={(
            saved
          ) => {
            setContacts(
              (previous) =>
                editingContact
                  ? previous.map(
                      (
                        contact
                      ) =>
                        contact.id ===
                        saved.id
                          ? saved
                          : contact
                    )
                  : [
                      ...previous,
                      saved,
                    ]
            );

            setShowContactModal(
              false
            );
            setEditingContact(
              null
            );
          }}
        />

        {/* Engagement Modal */}
        <EngagementFormModal
          isOpen={
            showEngageModal
          }
          engagement={
            editingEngage
          }
          defaultOrganisationId={
            organisation.id
          }
          organisations={[
            organisation,
          ]}
          onClose={() => {
            setShowEngageModal(
              false
            );
            setEditingEngage(
              null
            );
          }}
          onSuccess={(
            saved
          ) => {
            setEngagements(
              (previous) =>
                editingEngage
                  ? previous.map(
                      (
                        engagement
                      ) =>
                        engagement.id ===
                        saved.id
                          ? saved
                          : engagement
                    )
                  : [
                      saved,
                      ...previous,
                    ]
            );

            setOrganisation(
              (previous) =>
                previous
                  ? {
                      ...previous,
                      lastEngagementDate:
                        saved.engagementDate,
                    }
                  : null
            );

            setShowEngageModal(
              false
            );
            setEditingEngage(
              null
            );
          }}
        />

        {/* Opportunity Modal */}
        <OpportunityFormModal
          isOpen={
            showOppModal
          }
          opportunity={
            editingOpp
          }
          defaultOrganisationId={
            organisation.id
          }
          organisations={[
            organisation,
          ]}
          onClose={() => {
            setShowOppModal(
              false
            );
            setEditingOpp(
              null
            );
          }}
          onSuccess={(
            saved
          ) => {
            setOpportunities(
              (previous) =>
                editingOpp
                  ? previous.map(
                      (
                        opportunity
                      ) =>
                        opportunity.id ===
                        saved.id
                          ? saved
                          : opportunity
                    )
                  : [
                      saved,
                      ...previous,
                    ]
            );

            setShowOppModal(
              false
            );
            setEditingOpp(
              null
            );
          }}
        />

        {/* Task Modal */}
        <TaskFormModal
          isOpen={
            showTaskModal
          }
          task={
            editingTask
          }
          defaultOrganisationId={
            organisation.id
          }
          organisations={[
            organisation,
          ]}
          onClose={() => {
            setShowTaskModal(
              false
            );
            setEditingTask(
              null
            );
          }}
          onSuccess={(
            saved
          ) => {
            setTasks(
              (previous) =>
                editingTask
                  ? previous.map(
                      (
                        task
                      ) =>
                        task.id ===
                        saved.id
                          ? saved
                          : task
                    )
                  : [
                      saved,
                      ...previous,
                    ]
            );

            setShowTaskModal(
              false
            );
            setEditingTask(
              null
            );
          }}
        />
      </div>
    );
  };

/**
 * Formats a Firestore/application ISO date safely.
 */
const formatDate = (
  value?: string | null
): string => {
  if (!value) {
    return 'Unknown';
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return 'Unknown';
  }

  return parsed.toLocaleDateString(
    [],
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );
};

/**
 * Resolve an authoritative UID to a
 * human-readable display name.
 *
 * Legacy display-name values are returned
 * unchanged so existing records remain readable.
 */
const resolveUserLabel = (
  identity:
    | string
    | null
    | undefined,
  users: Array<{
    uid: string;
    displayName: string;
  }>
): string => {
  if (!identity) {
    return 'Unknown';
  }

  const user =
    users.find(
      (candidate) =>
        candidate.uid ===
        identity
    );

  return (
    user?.displayName ||
    identity
  );
};

/**
 * Displays the organisation's open-pipeline
 * value using its configured currency.
 *
 * The organisation record itself does not contain
 * a currency, so PGK remains the application's
 * existing default for aggregate target reporting.
 */
const organisationCurrencyLabel = (
  value: number
): string => {
  return `PGK ${(
    value / 1000000
  ).toFixed(2)}M`;
};