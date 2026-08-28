import React, { useMemo, useState } from 'react';
import { Contact, HierarchyNode } from '../../types';
import { contactService } from '../../services/contactService';
import {
  DecisionRoleBadge,
  InfluenceBadge,
  RelationshipBadge,
} from '../common/PriorityBadge';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Edit2,
  Mail,
  Network,
  Phone,
  Users,
} from 'lucide-react';

interface CommandChainTreeProps {
  contacts: Contact[];
  onEditContact?: (contact: Contact) => void;
  onLogEngagement?: (contact: Contact) => void;
}

interface HierarchyTreeNodeProps {
  node: HierarchyNode;
  level: number;
  onEditContact?: (contact: Contact) => void;
  onLogEngagement?: (contact: Contact) => void;
}

const getInitials = (fullName: string): string => {
  return fullName
    .split(' ')
    .filter(Boolean)
    .map((namePart) => namePart.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const HierarchyTreeNode: React.FC<HierarchyTreeNodeProps> = ({
  node,
  level,
  onEditContact,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const { contact } = node;
  const children = node.children || [];
  const hasChildren = children.length > 0;

  const isDecisionMaker =
    contact.decisionRole === 'DECISION_MAKER';

  const isInfluencer =
    contact.decisionRole === 'INFLUENCER';

  return (
    <div className="relative">
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
          isDecisionMaker
            ? 'bg-purple-50/40 border-purple-200 shadow-2xs'
            : isInfluencer
              ? 'bg-sky-50/40 border-sky-200 shadow-2xs'
              : 'bg-white border-slate-200 shadow-2xs'
        }`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 mt-1"
            title={isExpanded ? 'Collapse team' : 'Expand team'}
            aria-label={
              isExpanded
                ? `Collapse ${contact.fullName}'s team`
                : `Expand ${contact.fullName}'s team`
            }
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-indigo-600" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div
            className="w-6 shrink-0"
            aria-hidden="true"
          />
        )}

        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
            isDecisionMaker
              ? 'bg-purple-600 text-white shadow-xs'
              : isInfluencer
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}
          title={contact.fullName}
        >
          {getInitials(contact.fullName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-900">
                  {contact.fullName}
                </h4>

                {contact.jobTitle && (
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {contact.jobTitle}
                  </span>
                )}
              </div>

              {contact.department && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Department: {contact.department}
                </p>
              )}

              {level > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Reporting level {level}
                </p>
              )}
            </div>

            {onEditContact && (
              <button
                type="button"
                onClick={() => onEditContact(contact)}
                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer shrink-0"
                title={`Edit ${contact.fullName}`}
                aria-label={`Edit ${contact.fullName}`}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 items-center">
            <DecisionRoleBadge role={contact.decisionRole} />
            <InfluenceBadge level={contact.influenceLevel} />
            <RelationshipBadge
              strength={contact.relationshipStrength}
            />
          </div>

          {(contact.email || contact.mobile || contact.landline) && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-1 hover:text-indigo-600 transition-colors break-all"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {contact.email}
                </a>
              )}

              {contact.mobile && (
                <a
                  href={`tel:${contact.mobile}`}
                  className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {contact.mobile}
                </a>
              )}

              {contact.landline && (
                <a
                  href={`tel:${contact.landline}`}
                  className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {contact.landline}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-8 mt-3 pl-4 border-l-2 border-indigo-200 space-y-3">
          {children.map((childNode) => (
            <HierarchyTreeNode
              key={childNode.contact.id}
              node={childNode}
              level={level + 1}
              onEditContact={onEditContact}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const CommandChainTree: React.FC<
  CommandChainTreeProps
> = ({
  contacts,
  onEditContact,
}) => {
  const { tree, unlinked } = useMemo(
    () => contactService.buildHierarchy(contacts),
    [contacts]
  );

  const linkedContactCount =
    contacts.length - unlinked.length;

  if (contacts.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />

        <h4 className="text-sm font-bold text-slate-800">
          No Stakeholder Contacts Found
        </h4>

        <p className="text-xs text-slate-500 mt-1">
          Add contacts to this organisation to construct the
          visual command-chain hierarchy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Network className="w-5 h-5" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Command-Chain & Reporting Structure
            </h3>

            <p className="text-xs text-slate-500">
              Visual executive-to-operational stakeholder
              hierarchy built from reporting relationships
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-indigo-700 bg-white px-3 py-1 rounded-full border border-indigo-200">
            {contacts.length} Total Contacts
          </span>

          <span className="text-xs font-semibold text-emerald-700 bg-white px-3 py-1 rounded-full border border-emerald-200">
            {linkedContactCount} Linked
          </span>

          {unlinked.length > 0 && (
            <span className="text-xs font-semibold text-amber-700 bg-white px-3 py-1 rounded-full border border-amber-200">
              {unlinked.length} Require Review
            </span>
          )}
        </div>
      </div>

      {tree.length > 0 ? (
        <div className="space-y-4">
          {tree.map((node) => (
            <HierarchyTreeNode
              key={node.contact.id}
              node={node}
              level={0}
              onEditContact={onEditContact}
            />
          ))}
        </div>
      ) : (
        <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200">
          <Network className="w-7 h-7 text-slate-400 mx-auto mb-2" />

          <h4 className="text-sm font-bold text-slate-800">
            No Valid Reporting Hierarchy Available
          </h4>

          <p className="text-xs text-slate-500 mt-1">
            The current contacts do not contain a complete
            root-to-reporting structure. Review the contacts
            listed below and correct their reporting manager
            assignments.
          </p>
        </div>
      )}

      {unlinked.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="flex items-start gap-2 text-xs font-bold text-amber-900 mb-3 bg-amber-50 p-3 rounded-lg border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />

            <div>
              <div>
                Reporting Relationships Require Review (
                {unlinked.length})
              </div>

              <p className="font-normal text-amber-800 mt-1 leading-relaxed">
                These contacts could not be safely attached to
                the command chain. This can occur when a
                reporting manager is missing, a contact reports
                to itself, or legacy data contains circular or
                disconnected reporting relationships.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unlinked.map((contact) => (
              <div
                key={contact.id}
                className="p-3.5 bg-white border border-slate-200 rounded-lg flex items-start justify-between gap-3 shadow-2xs"
              >
                <div className="min-w-0">
                  <h5 className="text-xs font-bold text-slate-900">
                    {contact.fullName}
                  </h5>

                  {contact.jobTitle && (
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {contact.jobTitle}
                    </p>
                  )}

                  {contact.department && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {contact.department}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1">
                    <DecisionRoleBadge
                      role={contact.decisionRole}
                    />

                    <InfluenceBadge
                      level={contact.influenceLevel}
                    />

                    <RelationshipBadge
                      strength={
                        contact.relationshipStrength
                      }
                    />
                  </div>
                </div>

                {onEditContact && (
                  <button
                    type="button"
                    onClick={() =>
                      onEditContact(contact)
                    }
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer shrink-0"
                    title={`Review reporting manager for ${contact.fullName}`}
                  >
                    Review Link
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};