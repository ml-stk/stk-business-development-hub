import React, { useState, useEffect } from 'react';
import { X, TrendingUp, AlertCircle } from 'lucide-react';
import {
  Opportunity,
  Organisation,
  Contact,
  OpportunityStatus,
  PipelineStage,
  UserProfile,
} from '../../types';
import { opportunityService } from '../../services/opportunityService';
import { contactService } from '../../services/contactService';
import { settingsService } from '../../services/settingsService';
import { useAuth } from '../../contexts/AuthContext';
import { PIPELINE_STAGES } from '../../services/masterDataDefaults';

interface OpportunityFormModalProps {
  isOpen: boolean;
  opportunity?: Opportunity | null;
  defaultOrganisationId?: string;
  organisations: Organisation[];
  onClose: () => void;
  onSuccess: (saved: Opportunity) => void;
}

export const OpportunityFormModal: React.FC<OpportunityFormModalProps> = ({
  isOpen,
  opportunity,
  defaultOrganisationId,
  organisations,
  onClose,
  onSuccess,
}) => {
  const { currentUser, allUsers } = useAuth();

  const [organisationId, setOrganisationId] = useState('');
  const [contactId, setContactId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [solutionCategory, setSolutionCategory] = useState('');
  const [estimatedValue, setEstimatedValue] = useState<number | ''>('');
  const [currency, setCurrency] = useState('PGK');
  const [bdmOwnerId, setBdmOwnerId] = useState('');
  const [accountManagerId, setAccountManagerId] = useState('');
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('IDENTIFIED');
  const [status, setStatus] = useState<OpportunityStatus>('OPEN');
  const [discoveredDate, setDiscoveredDate] = useState('');
  const [referredDate, setReferredDate] = useState('');
  const [closedDate, setClosedDate] = useState('');
  const [winReason, setWinReason] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [notes, setNotes] = useState('');

  const [solutionCategories, setSolutionCategories] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toDateInput = (iso?: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  useEffect(() => {
    settingsService.getByKey('solutionCategories').then((cats) => {
      setSolutionCategories(cats);
      if (!opportunity && cats.length > 0) {
        setSolutionCategory(cats[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (opportunity) {
      setOrganisationId(opportunity.organisationId);
      setContactId(opportunity.contactId || '');
      setTitle(opportunity.title);
      setDescription(opportunity.description || '');
      setSolutionCategory(opportunity.solutionCategory);
      setEstimatedValue(opportunity.estimatedValue);
      setCurrency(opportunity.currency || 'PGK');
      setBdmOwnerId(opportunity.bdmOwnerId);
      setAccountManagerId(opportunity.accountManagerId || '');
      setPipelineStage(opportunity.pipelineStage);
      setStatus(opportunity.status);
      setDiscoveredDate(toDateInput(opportunity.discoveredDate));
      setReferredDate(toDateInput(opportunity.referredDate));
      setClosedDate(toDateInput(opportunity.closedDate));
      setWinReason(opportunity.winReason || '');
      setLossReason(opportunity.lossReason || '');
      setNotes(opportunity.notes || '');
    } else {
      setOrganisationId(defaultOrganisationId || organisations[0]?.id || '');
      setContactId('');
      setTitle('');
      setDescription('');
      setEstimatedValue('');
      setCurrency('PGK');
      setBdmOwnerId(currentUser?.uid || '');
      setAccountManagerId('');
      setPipelineStage('IDENTIFIED');
      setStatus('OPEN');
      setDiscoveredDate(new Date().toISOString().split('T')[0]);
      setReferredDate('');
      setClosedDate('');
      setWinReason('');
      setLossReason('');
      setNotes('');
    }
    setErrorMessage(null);
  }, [opportunity, defaultOrganisationId, organisations, isOpen, currentUser]);

  useEffect(() => {
    if (organisationId) {
      contactService.getByOrganisation(organisationId).then(setContacts);
    } else {
      setContacts([]);
    }
  }, [organisationId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!organisationId) {
      setErrorMessage('Target Organisation is required.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Opportunity Title is required.');
      return;
    }
    if (!solutionCategory) {
      setErrorMessage('Solution Category is required.');
      return;
    }
    if (estimatedValue === '' || Number(estimatedValue) < 0) {
      setErrorMessage('Estimated Value must be a valid non-negative number.');
      return;
    }

    // Strict validation for WON and LOST per Section 12
    if (status === 'WON' && !closedDate) {
      setErrorMessage('For WON opportunities, Closed Date is required.');
      return;
    }
    if (status === 'LOST') {
      if (!closedDate) {
        setErrorMessage('For LOST opportunities, Closed Date is required.');
        return;
      }
      if (!lossReason.trim()) {
        setErrorMessage('For LOST opportunities, Loss Reason is required.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const discISO = new Date(discoveredDate || Date.now()).toISOString();
      const refISO = referredDate ? new Date(referredDate).toISOString() : null;
      const closedISO = closedDate ? new Date(closedDate).toISOString() : null;

      if (opportunity) {
        // Update
        await opportunityService.update(opportunity.id, {
          organisationId,
          contactId: contactId || null,
          title: title.trim(),
          description: description.trim(),
          solutionCategory,
          estimatedValue: Number(estimatedValue),
          currency,
          bdmOwnerId,
          accountManagerId: accountManagerId || null,
          pipelineStage,
          status,
          discoveredDate: discISO,
          referredDate: refISO,
          closedDate: closedISO,
          winReason: status === 'WON' ? winReason.trim() || null : null,
          lossReason: status === 'LOST' ? lossReason.trim() || null : null,
          notes: notes.trim(),
          updatedBy: currentUser.uid,
        });
        onSuccess({
          ...opportunity,
          organisationId,
          contactId: contactId || null,
          title: title.trim(),
          description: description.trim(),
          solutionCategory,
          estimatedValue: Number(estimatedValue),
          currency,
          bdmOwnerId,
          accountManagerId: accountManagerId || null,
          pipelineStage,
          status,
          discoveredDate: discISO,
          referredDate: refISO,
          closedDate: closedISO,
          winReason: status === 'WON' ? winReason.trim() || null : null,
          lossReason: status === 'LOST' ? lossReason.trim() || null : null,
          notes: notes.trim(),
          updatedBy: currentUser.uid,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create
        const created = await opportunityService.create({
          organisationId,
          contactId: contactId || null,
          title: title.trim(),
          description: description.trim(),
          solutionCategory,
          estimatedValue: Number(estimatedValue),
          currency,
          bdmOwnerId,
          accountManagerId: accountManagerId || null,
          pipelineStage,
          status,
          discoveredDate: discISO,
          referredDate: refISO,
          closedDate: closedISO,
          winReason: status === 'WON' ? winReason.trim() || null : null,
          lossReason: status === 'LOST' ? lossReason.trim() || null : null,
          notes: notes.trim(),
          createdBy: currentUser.uid,
          updatedBy: currentUser.uid,
        });
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving opportunity:', err);
      setErrorMessage(err.message || 'Failed to save opportunity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const bdmUsers = allUsers.filter((u) => u.role === 'BDM' || u.role === 'BDM_MANAGER');
  const amUsers = allUsers.filter((u) => u.role === 'ACCOUNT_MANAGER' || u.role === 'ADMIN');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {opportunity ? 'Edit Opportunity' : 'Create New Opportunity'}
              </h3>
              <p className="text-xs text-slate-500">
                Manage commercial solution opportunities and sales referrals
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Organisation & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Target Organisation *
              </label>
              <select
                required
                disabled={!!defaultOrganisationId && !opportunity}
                value={organisationId}
                onChange={(e) => {
                  setOrganisationId(e.target.value);
                  setContactId('');
                }}
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Select Organisation --</option>
                {organisations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Primary Contact / Stakeholder
              </label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- No Specific Contact --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.jobTitle})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Opportunity Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Enterprise Managed SOC & Cloud Colocation Agreement"
              className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Solution Category & Estimated Value */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Solution Category *
              </label>
              <select
                value={solutionCategory}
                onChange={(e) => setSolutionCategory(e.target.value)}
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {solutionCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Estimated Value *
              </label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                value={estimatedValue}
                onChange={(e) =>
                  setEstimatedValue(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="e.g. 1850000"
                className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Currency *
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="PGK">PGK (Kina)</option>
                <option value="USD">USD ($)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
          </div>

          {/* Owners: BDM Owner & Account Manager */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                BDM Owner (Uncovered By) *
              </label>
              <select
                value={bdmOwnerId}
                onChange={(e) => setBdmOwnerId(e.target.value)}
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {bdmUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Assigned Account Manager (AM)
              </label>
              <select
                value={accountManagerId}
                onChange={(e) => setAccountManagerId(e.target.value)}
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- No AM Assigned (Unreferred) --</option>
                {amUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.jobTitle})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stage & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Pipeline Stage *
              </label>
              <select
                value={pipelineStage}
                onChange={(e) => setPipelineStage(e.target.value as PipelineStage)}
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Commercial Status *
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const val = e.target.value as OpportunityStatus;
                  setStatus(val);
                  if (val === 'WON' || val === 'LOST') {
                    if (!closedDate) setClosedDate(new Date().toISOString().split('T')[0]);
                    setPipelineStage('CLOSED');
                  }
                }}
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="OPEN">Open / Active Pipeline</option>
                <option value="WON">Won / Closed Successfully</option>
                <option value="LOST">Lost / Unsuccessful</option>
                <option value="UNCONVERTED">Unconverted / Dormant</option>
              </select>
            </div>
          </div>

          {/* Discovered Date & Referred Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date Discovered *
              </label>
              <input
                type="date"
                required
                value={discoveredDate}
                onChange={(e) => setDiscoveredDate(e.target.value)}
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date Referred to Account Management
              </label>
              <input
                type="date"
                value={referredDate}
                onChange={(e) => setReferredDate(e.target.value)}
                className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>

          {/* Conditional Won / Lost fields */}
          {status === 'WON' && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
              <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                Deal Won Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Closed Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={closedDate}
                    onChange={(e) => setClosedDate(e.target.value)}
                    className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Key Win Factor / Reason
                  </label>
                  <input
                    type="text"
                    value={winReason}
                    onChange={(e) => setWinReason(e.target.value)}
                    placeholder="e.g. Superior local SOC capabilities & competitive SLA"
                    className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {status === 'LOST' && (
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-3">
              <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                Deal Lost Details (Audit Required)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-rose-900 mb-1">
                    Closed Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={closedDate}
                    onChange={(e) => setClosedDate(e.target.value)}
                    className="text-slate-900 w-full px-3 py-2 text-sm rounded-lg border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-rose-900 mb-1">
                    Loss Reason *
                  </label>
                  <input
                    type="text"
                    required
                    value={lossReason}
                    onChange={(e) => setLossReason(e.target.value)}
                    placeholder="e.g. Budget cut, competitor price, project cancelled"
                    className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Description & Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Scope Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Commercial scope, SLA deliverables, technology stacks involved..."
              className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Internal Strategy & Pricing Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Competitor pricing intelligence, margin expectations, executive sponsors..."
              className="text-slate-900 placeholder:text-slate-400 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
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
                : opportunity
                ? 'Update Opportunity'
                : 'Create Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
