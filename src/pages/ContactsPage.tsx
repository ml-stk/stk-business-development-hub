import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { contactService } from '../services/contactService';
import { organisationService } from '../services/organisationService';
import { Contact, Organisation } from '../types';
import {
  DecisionRoleBadge,
  InfluenceBadge,
  RelationshipBadge,
} from '../components/common/PriorityBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { ContactFormModal } from '../components/contacts/ContactFormModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import {
  canCreateContact,
  canEditContact,
  canDeleteContact,
} from '../services/authorizationService';
import {
  Users,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ContactsPage: React.FC = () => {
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgFilter, setSelectedOrgFilter] =
    useState<string>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] =
    useState<string>('ALL');
  const [selectedInfluence, setSelectedInfluence] =
    useState<string>('ALL');

  // Modals
  const [showContactModal, setShowContactModal] =
    useState(false);
  const [editingContact, setEditingContact] =
    useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] =
    useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);

    try {
      const [contactList, organisationList] =
        await Promise.all([
          contactService.getAll(),
          organisationService.getAll(),
        ]);

      setContacts(contactList);
      setOrganisations(organisationList);
    } catch (error) {
      console.error(
        'Error loading contacts:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteContact = async () => {
    if (!deletingContact) {
      return;
    }

    if (
      !canDeleteContact(
        currentUser,
        deletingContact
      )
    ) {
      console.warn(
        'Unauthorized contact deletion attempt.'
      );
      return;
    }

    setIsDeleting(true);

    try {
      await contactService.delete(
        deletingContact.id
      );

      setContacts((previous) =>
        previous.filter(
          (contact) =>
            contact.id !== deletingContact.id
        )
      );

      setDeletingContact(null);
    } catch (error) {
      console.error(
        'Error deleting contact:',
        error
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const canAddContact = canCreateContact(
    currentUser
  );

  if (loading) {
    return (
      <LoadingSpinner text="Loading stakeholder contacts directory..." />
    );
  }

  const filteredContacts = contacts.filter(
    (contact) => {
      if (
        selectedOrgFilter !== 'ALL' &&
        contact.organisationId !==
          selectedOrgFilter
      ) {
        return false;
      }

      if (
        selectedRoleFilter !== 'ALL' &&
        contact.decisionRole !==
          selectedRoleFilter
      ) {
        return false;
      }

      if (
        selectedInfluence !== 'ALL' &&
        contact.influenceLevel !==
          selectedInfluence
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const query =
          searchQuery.toLowerCase();

        const organisation =
          organisations.find(
            (org) =>
              org.id ===
              contact.organisationId
          );

        const matchName =
          contact.fullName
            .toLowerCase()
            .includes(query);

        const matchJob =
          contact.jobTitle
            ?.toLowerCase()
            .includes(query);

        const matchEmail =
          contact.email
            ?.toLowerCase()
            .includes(query);

        const matchPhone =
          contact.mobile?.includes(query) ||
          contact.landline?.includes(query);

        const matchOrganisation =
          organisation?.name
            .toLowerCase()
            .includes(query);

        if (
          !matchName &&
          !matchJob &&
          !matchEmail &&
          !matchPhone &&
          !matchOrganisation
        ) {
          return false;
        }
      }

      return true;
    }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Users className="w-4 h-4" />
            </div>

            Stakeholder Directory
          </h1>

          <p className="text-xs text-neutral-400 mt-0.5">
            Maintain executive and operational contacts,
            decision roles, and hierarchy links
          </p>
        </div>

        {canAddContact && (
          <button
            onClick={() => {
              setEditingContact(null);
              setShowContactModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 border border-indigo-500/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Stakeholder Contact
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#111115]/90 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />

          <input
            type="text"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
            placeholder="Search contacts, job title, email, phone..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* Organisation filter */}
          <select
            value={selectedOrgFilter}
            onChange={(event) =>
              setSelectedOrgFilter(
                event.target.value
              )
            }
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">
              All Organisations (
              {organisations.length})
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

          {/* Decision Role */}
          <select
            value={selectedRoleFilter}
            onChange={(event) =>
              setSelectedRoleFilter(
                event.target.value
              )
            }
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">
              All Decision Roles
            </option>
            <option value="DECISION_MAKER">
              Decision Maker
            </option>
            <option value="INFLUENCER">
              Influencer
            </option>
            <option value="TECHNICAL_EVALUATOR">
              Technical Evaluator
            </option>
            <option value="PROCUREMENT">
              Procurement
            </option>
            <option value="GATEKEEPER">
              Gatekeeper
            </option>
            <option value="USER">
              End User
            </option>
          </select>

          {/* Influence */}
          <select
            value={selectedInfluence}
            onChange={(event) =>
              setSelectedInfluence(
                event.target.value
              )
            }
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#16161c] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">
              All Influence Levels
            </option>
            <option value="HIGH">
              High Influence
            </option>
            <option value="MEDIUM">
              Medium Influence
            </option>
            <option value="LOW">
              Low Influence
            </option>
          </select>
        </div>
      </div>

      {/* Contacts Table */}
      {filteredContacts.length === 0 ? (
        <EmptyState
          title="No contacts found"
          description="Try adjusting your search or filters, or add a new stakeholder."
          icon={
            <Users className="w-8 h-8 text-neutral-400" />
          }
          action={
            canAddContact
              ? {
                  label:
                    'Add Stakeholder Contact',
                  onClick: () =>
                    setShowContactModal(true),
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
                    Contact Name
                  </th>

                  <th className="py-3.5 px-3">
                    Organisation
                  </th>

                  <th className="py-3.5 px-3">
                    Job Title & Dept
                  </th>

                  <th className="py-3.5 px-3">
                    Decision Role
                  </th>

                  <th className="py-3.5 px-3">
                    Influence & Relationship
                  </th>

                  <th className="py-3.5 px-3">
                    Direct Contact
                  </th>

                  <th className="py-3.5 px-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {filteredContacts.map(
                  (contact) => {
                    const organisation =
                      organisations.find(
                        (org) =>
                          org.id ===
                          contact.organisationId
                      );

                    const canEdit =
                      canEditContact(
                        currentUser,
                        contact
                      );

                    const canDelete =
                      canDeleteContact(
                        currentUser,
                        contact
                      );

                    return (
                      <tr
                        key={contact.id}
                        className="hover:bg-white/5 transition-colors"
                      >
                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/20 shrink-0">
                              {contact.fullName
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>

                            <span className="font-bold text-white text-sm">
                              {contact.fullName}
                            </span>
                          </div>
                        </td>

                        {/* Organisation */}
                        <td className="py-3.5 px-3">
                          {organisation ? (
                            <Link
                              to={`/organisations/${organisation.id}`}
                              className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              {
                                organisation.name
                              }
                            </Link>
                          ) : (
                            <span className="text-neutral-500 italic">
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Job Title */}
                        <td className="py-3.5 px-3">
                          <span className="text-neutral-200 font-medium">
                            {contact.jobTitle}
                          </span>

                          {contact.department && (
                            <span className="block text-[11px] text-neutral-400">
                              {
                                contact.department
                              }
                            </span>
                          )}
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <DecisionRoleBadge
                            role={
                              contact.decisionRole
                            }
                          />
                        </td>

                        {/* Influence & Strength */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <InfluenceBadge
                              level={
                                contact.influenceLevel
                              }
                            />

                            <RelationshipBadge
                              strength={
                                contact.relationshipStrength
                              }
                            />
                          </div>
                        </td>

                        {/* Contact Info */}
                        <td className="py-3.5 px-3">
                          {contact.email && (
                            <a
                              href={`mailto:${contact.email}`}
                              className="flex items-center gap-1 text-neutral-300 hover:text-indigo-400 transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5 text-neutral-400" />
                              {contact.email}
                            </a>
                          )}

                          {contact.mobile && (
                            <a
                              href={`tel:${contact.mobile}`}
                              className="flex items-center gap-1 text-neutral-400 text-[11px] hover:text-indigo-400 transition-colors mt-0.5"
                            >
                              <Phone className="w-3.5 h-3.5 text-neutral-400" />
                              {contact.mobile}
                            </a>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setEditingContact(
                                    contact
                                  );
                                  setShowContactModal(
                                    true
                                  );
                                }}
                                className="p-1.5 text-neutral-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                                title="Edit Contact"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}

                            {canDelete && (
                              <button
                                onClick={() =>
                                  setDeletingContact(
                                    contact
                                  )
                                }
                                className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Delete Contact"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
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

      {/* Modal */}
      <ContactFormModal
        isOpen={showContactModal}
        contact={editingContact}
        organisations={organisations}
        onClose={() => {
          setShowContactModal(false);
          setEditingContact(null);
        }}
        onSuccess={(saved) => {
          if (editingContact) {
            setContacts((previous) =>
              previous.map((contact) =>
                contact.id === saved.id
                  ? saved
                  : contact
              )
            );
          } else {
            setContacts((previous) => [
              saved,
              ...previous,
            ]);
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingContact}
        title="Delete Stakeholder Contact?"
        message={`Are you sure you want to delete "${deletingContact?.fullName}"?`}
        confirmLabel="Delete Contact"
        variant="danger"
        onConfirm={handleDeleteContact}
        onCancel={() =>
          setDeletingContact(null)
        }
        isProcessing={isDeleting}
      />
    </div>
  );
};