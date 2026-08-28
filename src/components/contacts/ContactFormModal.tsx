import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import {
  Contact,
  Organisation,
  DecisionRole,
  InfluenceLevel,
  RelationshipStrength,
  ContactStatus,
} from '../../types';
import { contactService } from '../../services/contactService';
import { useAuth } from '../../contexts/AuthContext';
import {
  canCreateContact,
  canEditContact,
} from '../../services/authorizationService';

interface ContactFormModalProps {
  isOpen: boolean;
  contact?: Contact | null;
  defaultOrganisationId?: string;
  organisations: Organisation[];
  onClose: () => void;
  onSuccess: (savedContact: Contact) => void;
}

export const ContactFormModal: React.FC<
  ContactFormModalProps
> = ({
  isOpen,
  contact,
  defaultOrganisationId,
  organisations,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useAuth();

  const [organisationId, setOrganisationId] =
    useState('');

  const [firstName, setFirstName] =
    useState('');

  const [lastName, setLastName] =
    useState('');

  const [jobTitle, setJobTitle] =
    useState('');

  const [department, setDepartment] =
    useState('');

  const [mobile, setMobile] =
    useState('');

  const [landline, setLandline] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [gender, setGender] =
    useState('Male');

  const [reportsToContactId, setReportsToContactId] =
    useState('');

  const [decisionRole, setDecisionRole] =
    useState<DecisionRole>('DECISION_MAKER');

  const [influenceLevel, setInfluenceLevel] =
    useState<InfluenceLevel>('HIGH');

  const [
    relationshipStrength,
    setRelationshipStrength,
  ] = useState<RelationshipStrength>('STRONG');

  const [status, setStatus] =
    useState<ContactStatus>('ACTIVE');

  const [notes, setNotes] =
    useState('');

  const [orgContacts, setOrgContacts] =
    useState<Contact[]>([]);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const isEditing = Boolean(contact);

  /**
   * Load/reset form state.
   */
  useEffect(() => {
    if (contact) {
      /*
       * Existing organisation ownership is authoritative.
       *
       * This value must not be changed through the edit form.
       */
      setOrganisationId(
        contact.organisationId
      );

      setFirstName(
        contact.firstName
      );

      setLastName(
        contact.lastName
      );

      setJobTitle(
        contact.jobTitle
      );

      setDepartment(
        contact.department || ''
      );

      setMobile(
        contact.mobile || ''
      );

      setLandline(
        contact.landline || ''
      );

      setEmail(
        contact.email || ''
      );

      setGender(
        contact.gender || 'Male'
      );

      setReportsToContactId(
        contact.reportsToContactId || ''
      );

      setDecisionRole(
        contact.decisionRole
      );

      setInfluenceLevel(
        contact.influenceLevel
      );

      setRelationshipStrength(
        contact.relationshipStrength
      );

      setStatus(
        contact.status
      );

      setNotes(
        contact.notes || ''
      );
    } else {
      setOrganisationId(
        defaultOrganisationId ||
          organisations[0]?.id ||
          ''
      );

      setFirstName('');
      setLastName('');
      setJobTitle('');
      setDepartment('');
      setMobile('');
      setLandline('');
      setEmail('');
      setGender('Male');
      setReportsToContactId('');
      setDecisionRole('DECISION_MAKER');
      setInfluenceLevel('HIGH');
      setRelationshipStrength('NEW');
      setStatus('ACTIVE');
      setNotes('');
    }

    setErrorMessage(null);
  }, [
    contact,
    defaultOrganisationId,
    organisations,
    isOpen,
  ]);

  /**
   * Load contacts belonging to the selected organisation
   * for the reporting-line hierarchy.
   */
  useEffect(() => {
    let cancelled = false;

    const loadOrganisationContacts =
      async () => {
        if (!organisationId) {
          setOrgContacts([]);
          return;
        }

        try {
          const list =
            await contactService.getByOrganisation(
              organisationId
            );

          if (cancelled) {
            return;
          }

          /*
           * Exclude the current contact to prevent
           * self-referencing command-chain relationships.
           */
          const filtered = contact
            ? list.filter(
                (candidate) =>
                  candidate.id !== contact.id
              )
            : list;

          setOrgContacts(filtered);
        } catch (error) {
          if (!cancelled) {
            console.error(
              'Error loading organisation contacts:',
              error
            );

            setOrgContacts([]);
          }
        }
      };

    void loadOrganisationContacts();

    return () => {
      cancelled = true;
    };
  }, [organisationId, contact]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setErrorMessage(null);

    /*
     * Firebase Authentication UID is mandatory for all
     * authorization-sensitive writes.
     */
    if (!currentUser?.uid) {
      setErrorMessage(
        'Your authenticated user identity could not be established. Please sign in again.'
      );
      return;
    }

    /*
     * Validate operation permissions at the UI layer.
     *
     * Firestore Security Rules remain the authoritative
     * security boundary.
     */
    if (contact) {
      if (
        !canEditContact(
          currentUser,
          contact
        )
      ) {
        setErrorMessage(
          'You are not authorised to edit this contact.'
        );
        return;
      }
    } else {
      if (
        !canCreateContact(
          currentUser,
          organisationId
        )
      ) {
        setErrorMessage(
          'You are not authorised to create contacts.'
        );
        return;
      }
    }

    if (!organisationId) {
      setErrorMessage(
        'Please select a Target Organisation.'
      );
      return;
    }

    if (
      !firstName.trim() ||
      !lastName.trim()
    ) {
      setErrorMessage(
        'First Name and Last Name are required.'
      );
      return;
    }

    if (!jobTitle.trim()) {
      setErrorMessage(
        'Job Title is required.'
      );
      return;
    }

    /*
     * When editing an existing contact, the organisation
     * relationship must remain immutable.
     */
    if (
      contact &&
      organisationId !== contact.organisationId
    ) {
      setErrorMessage(
        'A contact cannot be moved to another organisation. Create a new contact instead.'
      );
      return;
    }

    /*
     * Ensure Reports To refers to a contact within
     * the same organisation.
     */
    if (
      reportsToContactId &&
      !orgContacts.some(
        (candidate) =>
          candidate.id ===
          reportsToContactId
      )
    ) {
      setErrorMessage(
        'The selected reporting manager is not a valid contact in this organisation.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const now =
        new Date().toISOString();

      if (contact) {
        /*
         * UPDATE
         *
         * Do NOT change organisationId.
         *
         * updatedBy is always the authenticated Firebase UID.
         */
        await contactService.update(
          contact.id,
          {
            organisationId:
              contact.organisationId,

            firstName:
              firstName.trim(),

            lastName:
              lastName.trim(),

            jobTitle:
              jobTitle.trim(),

            department:
              department.trim(),

            mobile:
              mobile.trim(),

            landline:
              landline.trim(),

            email:
              email.trim(),

            gender,

            reportsToContactId:
              reportsToContactId ||
              null,

            decisionRole,

            influenceLevel,

            relationshipStrength,

            status,

            notes:
              notes.trim(),

            updatedBy:
              currentUser.uid,
          }
        );

        onSuccess({
          ...contact,

          /*
           * Preserve the original organisation ID.
           */
          organisationId:
            contact.organisationId,

          firstName:
            firstName.trim(),

          lastName:
            lastName.trim(),

          fullName:
            `${firstName.trim()} ${lastName.trim()}`,

          jobTitle:
            jobTitle.trim(),

          department:
            department.trim(),

          mobile:
            mobile.trim(),

          landline:
            landline.trim(),

          email:
            email.trim(),

          gender,

          reportsToContactId:
            reportsToContactId ||
            null,

          decisionRole,

          influenceLevel,

          relationshipStrength,

          status,

          notes:
            notes.trim(),

          updatedBy:
            currentUser.uid,

          updatedAt:
            now,
        });
      } else {
        /*
         * CREATE
         *
         * Both audit actors must be the authenticated UID.
         */
        const created =
          await contactService.create({
            organisationId,

            firstName:
              firstName.trim(),

            lastName:
              lastName.trim(),

            jobTitle:
              jobTitle.trim(),

            department:
              department.trim(),

            mobile:
              mobile.trim(),

            landline:
              landline.trim(),

            email:
              email.trim(),

            gender,

            reportsToContactId:
              reportsToContactId ||
              null,

            decisionRole,

            influenceLevel,

            relationshipStrength,

            status,

            notes:
              notes.trim(),

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
        'Error saving contact:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to save contact.';

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOrganisation =
    organisations.find(
      (organisation) =>
        organisation.id ===
        organisationId
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {contact
                  ? 'Edit Contact & Reporting Line'
                  : 'Add Contact & Stakeholder'}
              </h3>

              <p className="text-xs text-slate-500">
                Maintain stakeholder profile,
                decision role, and hierarchy
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
                isEditing ||
                (!!defaultOrganisationId &&
                  !contact)
              }
              value={organisationId}
              onChange={(event) =>
                setOrganisationId(
                  event.target.value
                )
              }
              className={`w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isEditing
                  ? 'bg-slate-100 text-slate-900 cursor-not-allowed'
                  : 'bg-white'
              }`}
            >
              <option value="">
                -- Select Organisation --
              </option>

              {organisations.map(
                (organisation) => (
                  <option
                    key={
                      organisation.id
                    }
                    value={
                      organisation.id
                    }
                  >
                    {organisation.name} (
                    {
                      organisation.category
                    }
                    )
                  </option>
                )
              )}
            </select>

            {isEditing && (
              <p className="text-[10px] text-slate-500 mt-1">
                Organisation cannot be changed after
                a contact has been created.
              </p>
            )}
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                First Name *
              </label>

              <input
                type="text"
                required
                value={firstName}
                onChange={(event) =>
                  setFirstName(
                    event.target.value
                  )
                }
                placeholder="e.g. James"
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Last Name *
              </label>

              <input
                type="text"
                required
                value={lastName}
                onChange={(event) =>
                  setLastName(
                    event.target.value
                  )
                }
                placeholder="e.g. Koroma"
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Job Title & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Job Title *
              </label>

              <input
                type="text"
                required
                value={jobTitle}
                onChange={(event) =>
                  setJobTitle(
                    event.target.value
                  )
                }
                placeholder="e.g. Chief Information Officer"
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Department
              </label>

              <input
                type="text"
                value={department}
                onChange={(event) =>
                  setDepartment(
                    event.target.value
                  )
                }
                placeholder="e.g. Information Technology"
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Command Chain */}
          <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">
              Command-Chain Hierarchy: Direct
              Manager / Reports To
            </label>

            <p className="text-[11px] text-indigo-700 mb-2">
              Select the supervisor within{' '}
              {selectedOrganisation?.name ||
                'this organisation'}{' '}
              to construct the visual
              reporting tree.
            </p>

            <select
              value={
                reportsToContactId
              }
              onChange={(event) =>
                setReportsToContactId(
                  event.target.value
                )
              }
              className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">
                None (Top-Level Executive /
                Root / Unknown)
              </option>

              {orgContacts.map(
                (candidate) => (
                  <option
                    key={candidate.id}
                    value={candidate.id}
                  >
                    {candidate.fullName} —{' '}
                    {candidate.jobTitle}{' '}
                    (
                    {candidate.decisionRole.replace(
                      /_/g,
                      ' '
                    )}
                    )
                  </option>
                )
              )}
            </select>

            <p className="text-[10px] text-indigo-600 mt-2">
              This contact and its existing
              subordinates are excluded to prevent
              circular reporting relationships.
            </p>
          </div>

          {/* Decision Role, Influence, Relationship */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Decision Role *
              </label>

              <select
                value={decisionRole}
                onChange={(event) =>
                  setDecisionRole(
                    event.target.value as DecisionRole
                  )
                }
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
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
                  Procurement Specialist
                </option>

                <option value="GATEKEEPER">
                  Gatekeeper
                </option>

                <option value="USER">
                  End User
                </option>

                <option value="GENERAL_CONTACT">
                  General Contact
                </option>

                <option value="UNKNOWN">
                  Unknown
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Influence Level *
              </label>

              <select
                value={influenceLevel}
                onChange={(event) =>
                  setInfluenceLevel(
                    event.target.value as InfluenceLevel
                  )
                }
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="HIGH">
                  High Influence
                </option>

                <option value="MEDIUM">
                  Medium Influence
                </option>

                <option value="LOW">
                  Low Influence
                </option>

                <option value="UNKNOWN">
                  Unknown
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Relationship Strength *
              </label>

              <select
                value={
                  relationshipStrength
                }
                onChange={(event) =>
                  setRelationshipStrength(
                    event.target.value as RelationshipStrength
                  )
                }
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="STRONG">
                  Strong Bond
                </option>

                <option value="MODERATE">
                  Moderate
                </option>

                <option value="WEAK">
                  Weak
                </option>

                <option value="NEW">
                  New Contact
                </option>

                <option value="UNKNOWN">
                  Unknown
                </option>
              </select>
            </div>
          </div>

          {/* Email & Phones */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="james@example.com"
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mobile Number
              </label>

              <input
                type="tel"
                value={mobile}
                onChange={(event) =>
                  setMobile(
                    event.target.value
                  )
                }
                placeholder="+675 7100 0000"
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Landline Phone
              </label>

              <input
                type="tel"
                value={landline}
                onChange={(event) =>
                  setLandline(
                    event.target.value
                  )
                }
                placeholder="+675 320 0000"
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Status & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Status
              </label>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as ContactStatus
                  )
                }
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="ACTIVE">
                  Active Contact
                </option>

                <option value="INACTIVE">
                  Inactive / Left Company
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Gender
              </label>

              <select
                value={gender}
                onChange={(event) =>
                  setGender(
                    event.target.value
                  )
                }
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="Male">
                  Male
                </option>

                <option value="Female">
                  Female
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Stakeholder Persona &amp;
              Strategy Notes
            </label>

            <textarea
              rows={2}
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
              placeholder="Background, key priorities, technical preferences, communication style..."
              className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                : contact
                ? 'Update Contact'
                : 'Save Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};