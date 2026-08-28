export const DEFAULT_SECTORS = [
  'Oil, Gas & Energy',
  'Mining & Resources',
  'Banking & Financial Services',
  'Telecommunications',
  'Government & Public Sector',
  'Aviation & Transport',
  'Retail & FMCG',
  'Healthcare & Pharmaceuticals',
  'Education & Research',
  'Manufacturing & Construction',
  'Professional Services',
  'Agriculture & Forestry',
];

export const DEFAULT_SOLUTION_CATEGORIES = [
  'Managed Cloud & Infrastructure',
  'Cyber Security & SOC Services',
  'SD-WAN & Enterprise Networking',
  'Satellite & Remote Connectivity',
  'Data Centre & Colocation',
  'Unified Communications & VoIP',
  'Enterprise Software & ERP Solutions',
  'Disaster Recovery & Backup',
  'Hardware & System Integration',
  'Professional IT Consulting',
];

export const DEFAULT_ENGAGEMENT_TYPES = [
  { value: 'PHONE_CALL', label: 'Phone Call' },
  { value: 'EMAIL', label: 'Email Correspondence' },
  { value: 'MEETING_ONSITE', label: 'Onsite Client Meeting' },
  { value: 'VIDEO_CONFERENCE', label: 'Video Conference (Teams/Zoom)' },
  { value: 'MEETING_COFFEE', label: 'Coffee / Informal Meeting' },
  { value: 'MEETING_EVENT', label: 'Industry Event / Conference' },
  { value: 'LINKEDIN', label: 'LinkedIn / Social Outreach' },
  { value: 'SMS', label: 'SMS / Instant Message' },
  { value: 'OTHER', label: 'Other Engagement' },
];

export const DEFAULT_ENGAGEMENT_PURPOSES = [
  { value: 'BUSINESS_INTRODUCTION', label: 'Business Introduction' },
  { value: 'CONTACT_ESTABLISHMENT', label: 'Contact Establishment' },
  { value: 'MEET_AND_GREET', label: 'Meet & Greet' },
  { value: 'DISCOVERY', label: 'Needs Discovery & Assessment' },
  { value: 'OPPORTUNITY_DISCUSSION', label: 'Opportunity Discussion' },
  { value: 'PROPOSAL_DISCUSSION', label: 'Proposal & Commercial Discussion' },
  { value: 'FOLLOW_UP', label: 'General Follow-Up' },
  { value: 'REFERRAL', label: 'Sales Referral' },
  { value: 'OTHER', label: 'Other Purpose' },
];

export const PIPELINE_STAGES = [
  { id: 'IDENTIFIED', label: 'Identified', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  { id: 'QUALIFIED', label: 'Qualified', color: 'bg-sky-100 text-sky-800 border-sky-300' },
  { id: 'DISCOVERY', label: 'Discovery', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'SOLUTION_DEVELOPMENT', label: 'Solution Development', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { id: 'PROPOSAL', label: 'Proposal', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'NEGOTIATION', label: 'Negotiation', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'CLOSED', label: 'Closed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
];
