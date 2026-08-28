import {
  collection,
  doc,
  setDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  UserProfile,
  Organisation,
  Contact,
  Engagement,
  Task,
  Opportunity,
} from '../types';

/**
 * --------------------------------------------------------------------------
 * DEVELOPMENT SEED USERS
 * --------------------------------------------------------------------------
 *
 * These users exist only as local development/demo personas.
 *
 * They are NOT production identities.
 *
 * Production users must be created through Firebase Authentication and
 * represented by /users/{firebaseUid} in Firestore.
 */
export const SEED_USERS: UserProfile[] = [
  {
    uid: 'bdm-user-1',
    displayName: 'Sarah Kila',
    email: 'sarah.kila@stk.com.pg',
    role: 'BDM',
    jobTitle:
      'Senior Business Development Manager - Resources & Energy',
    department: 'Business Development',
    active: true,
    photoURL:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    createdAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
    updatedAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
  },
  {
    uid: 'bdm-user-2',
    displayName: 'David Bau',
    email: 'david.bau@stk.com.pg',
    role: 'BDM',
    jobTitle:
      'Business Development Manager - Financial & Public Sector',
    department: 'Business Development',
    active: true,
    photoURL:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    createdAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
    updatedAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
  },
  {
    uid: 'am-user-1',
    displayName: 'Michael Tamar',
    email: 'michael.tamar@stk.com.pg',
    role: 'ACCOUNT_MANAGER',
    jobTitle:
      'Senior Account Manager - Cloud & Enterprise Solutions',
    department: 'Account Management',
    active: true,
    photoURL:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    createdAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
    updatedAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
  },
  {
    uid: 'am-user-2',
    displayName: 'Patricia Vagi',
    email: 'patricia.vagi@stk.com.pg',
    role: 'ACCOUNT_MANAGER',
    jobTitle:
      'Account Manager - Networks & Managed Security',
    department: 'Account Management',
    active: true,
    photoURL:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    createdAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
    updatedAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
  },
  {
    uid: 'mgr-user-1',
    displayName: 'Jennifer Lohia',
    email: 'jennifer.lohia@stk.com.pg',
    role: 'BDM_MANAGER',
    jobTitle:
      'Head of Business Development & Strategic Growth',
    department: 'Executive Management',
    active: true,
    photoURL:
      'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
    createdAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
    updatedAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
  },
  {
    uid: 'admin-user-1',
    displayName: 'Mark Laveil',
    email: 'mark.s.laveil@gmail.com',
    role: 'ADMIN',
    jobTitle:
      'Principal Systems Administrator & Solutions Architect',
    department: 'Technology Operations',
    active: true,
    photoURL:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    createdAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
    updatedAt:
      new Date(
        '2025-01-10T08:00:00Z'
      ).toISOString(),
  },
];

/**
 * --------------------------------------------------------------------------
 * PRODUCTION SAFETY GUARD
 * --------------------------------------------------------------------------
 *
 * Seeding is intentionally unavailable in production builds.
 */
const assertDevelopmentEnvironment = () => {
  if (!import.meta.env.DEV) {
    throw new Error(
      'Sample data seeding is disabled in production.'
    );
  }
};

/**
 * --------------------------------------------------------------------------
 * AUTHENTICATION GUARD
 * --------------------------------------------------------------------------
 *
 * Even during development, a Firebase-authenticated user must exist before
 * seed operations can touch Firestore.
 */
const assertAuthenticated = () => {
  if (!auth.currentUser?.uid) {
    throw new Error(
      'Authentication is required to execute development seed operations.'
    );
  }
};

/**
 * --------------------------------------------------------------------------
 * SEED SAMPLE DATA
 * --------------------------------------------------------------------------
 */
export async function seedSampleData(): Promise<{
  usersCount: number;
  orgsCount: number;
  contactsCount: number;
  engagementsCount: number;
  tasksCount: number;
  oppsCount: number;
}> {
  /*
   * Never allow this operation in a production build.
   */
  assertDevelopmentEnvironment();

  /*
   * Require an authenticated Firebase session.
   */
  assertAuthenticated();

  const batch = writeBatch(db);
  const now = new Date();

  /**
   * Helper date offset.
   */
  const daysOffset = (
    days: number
  ): string => {
    const date = new Date(now);
    date.setDate(
      date.getDate() + days
    );
    return date.toISOString();
  };

  /**
   * ------------------------------------------------------------------------
   * 1. DEVELOPMENT USERS
   * ------------------------------------------------------------------------
   */
  for (const user of SEED_USERS) {
    const userRef = doc(
      db,
      'users',
      user.uid
    );

    batch.set(
      userRef,
      user
    );
  }

  /**
   * ------------------------------------------------------------------------
   * 2. ORGANISATIONS
   * ------------------------------------------------------------------------
   */
  const org1Id = 'org-kphl-001';
  const org2Id = 'org-otml-002';
  const org3Id = 'org-bsp-003';
  const org4Id = 'org-digicel-004';
  const org5Id = 'org-airniugini-005';
  const org6Id = 'org-paradise-006';
  const org7Id = 'org-puma-007';

  const organisations: Organisation[] = [
    {
      id: org1Id,
      name: 'Kumul Petroleum Holdings Limited',
      aliases: [
        'Kumul Petroleum',
        'Kumul Petroleum Holdings',
        'KPHL',
      ],
      category: 'PRIMARY',
      sector: 'Oil, Gas & Energy',
      priority: 'HIGH',
      status: 'ACTIVE',
      assignedBDMId: 'bdm-user-1',
      location:
        'Port Moresby, NCD, Papua New Guinea',
      website:
        'https://kumulpetroleum.com',
      description:
        'National Oil and Gas Company of Papua New Guinea managing state petroleum assets.',
      notes:
        'Strategic tier-1 national oil & gas enterprise. Major cloud modernization initiative planned for Q3/Q4.',
      lastEngagementDate:
        daysOffset(-4),
      nextFollowUpDate:
        daysOffset(3),
      createdAt:
        daysOffset(-90),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-4),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: org2Id,
      name: 'Ok Tedi Mining Limited',
      aliases: [
        'OK Tedi Mining',
        'OTML',
        'OKTedi',
        'Ok Tedi',
      ],
      category: 'PRIMARY',
      sector: 'Mining & Resources',
      priority: 'HIGH',
      status: 'ACTIVE',
      assignedBDMId: 'bdm-user-1',
      location:
        'Tabubil, Western Province, PNG',
      website:
        'https://oktedi.com',
      description:
        'Major copper, gold, and silver mining operations in the Star Mountains.',
      notes:
        'Requiring high-resiliency remote microwave / satellite link failover and OT/SCADA cyber security monitoring.',
      lastEngagementDate:
        daysOffset(-2),
      nextFollowUpDate:
        daysOffset(5),
      createdAt:
        daysOffset(-120),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-2),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: org3Id,
      name: 'Bank South Pacific Financial Group Limited',
      aliases: [
        'BSP',
        'BSP Financial Group',
        'Bank South Pacific',
        'BSP PNG',
      ],
      category: 'PRIMARY',
      sector:
        'Banking & Financial Services',
      priority: 'HIGH',
      status: 'ACTIVE',
      assignedBDMId: 'bdm-user-2',
      location:
        'Waigani, Port Moresby, PNG',
      website:
        'https://bsp.com.pg',
      description:
        'Largest financial services provider and retail banking network across South Pacific.',
      notes:
        'Engaged in core infrastructure upgrades and regional disaster recovery site modernization.',
      lastEngagementDate:
        daysOffset(-6),
      nextFollowUpDate:
        daysOffset(2),
      createdAt:
        daysOffset(-150),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-6),
      updatedBy:
        'bdm-user-2',
    },

    {
      id: org4Id,
      name: 'Digicel Pacific PNG',
      aliases: [
        'Digicel PNG',
        'Digicel Group',
        'Telstra Digicel',
      ],
      category: 'SECONDARY',
      sector: 'Telecommunications',
      priority: 'MEDIUM',
      status: 'ACTIVE',
      assignedBDMId: 'bdm-user-2',
      location:
        'Port Moresby, PNG',
      website:
        'https://digicelpacific.com',
      description:
        'Leading mobile telecommunications and ICT infrastructure provider.',
      notes:
        'Potential joint-venture colocation and wholesale enterprise connectivity discussions.',
      lastEngagementDate:
        daysOffset(-14),
      nextFollowUpDate:
        daysOffset(7),
      createdAt:
        daysOffset(-60),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-14),
      updatedBy:
        'bdm-user-2',
    },

    {
      id: org5Id,
      name: 'Air Niugini Limited',
      aliases: [
        'Air Niugini',
        'PX',
        'Air Niugini Airline',
      ],
      category: 'PRIMARY',
      sector:
        'Aviation & Transport',
      priority: 'HIGH',
      status: 'ACTIVE',
      assignedBDMId: 'bdm-user-1',
      location:
        'Jacksons International Airport, Port Moresby',
      website:
        'https://airniugini.com.pg',
      description:
        'National flag carrier airline operating domestic and international routes.',
      notes:
        'Flight operations and passenger management cloud migration RFP underway.',
      lastEngagementDate:
        daysOffset(-10),
      nextFollowUpDate:
        daysOffset(-1),
      createdAt:
        daysOffset(-80),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-10),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: org6Id,
      name: 'Paradise Foods Limited',
      aliases: [
        'Paradise Foods',
        'Paradise Company',
        'Laga Industries',
      ],
      category: 'SECONDARY',
      sector: 'Retail & FMCG',
      priority: 'MEDIUM',
      status: 'ACTIVE',
      assignedBDMId: 'bdm-user-2',
      location:
        'Taraka, Lae, Morobe Province',
      website:
        'https://paradisefoods.com.pg',
      description:
        'Oldest and largest food manufacturing business in Papua New Guinea.',
      notes:
        'Multi-site SD-WAN connecting Lae, Port Moresby, and regional distribution centers.',
      lastEngagementDate:
        daysOffset(-20),
      nextFollowUpDate:
        daysOffset(10),
      createdAt:
        daysOffset(-50),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-20),
      updatedBy:
        'bdm-user-2',
    },

    {
      id: org7Id,
      name: 'Puma Energy PNG Limited',
      aliases: [
        'Puma Energy',
        'Puma PNG',
        'Puma Refining',
      ],
      category: 'SECONDARY',
      sector:
        'Oil, Gas & Energy',
      priority: 'LOW',
      status: 'ON_HOLD',
      assignedBDMId: 'bdm-user-1',
      location:
        'Napanapa Refinery, Central Province',
      website:
        'https://pumaenergy.com',
      description:
        'Refining and midstream fuel supply logistics.',
      notes:
        'Project paused temporarily due to regional supply chain realignment.',
      lastEngagementDate:
        daysOffset(-35),
      nextFollowUpDate:
        null,
      createdAt:
        daysOffset(-100),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-35),
      updatedBy:
        'bdm-user-1',
    },
  ];

  for (const organisation of organisations) {
    batch.set(
      doc(
        db,
        'organisations',
        organisation.id
      ),
      organisation
    );
  }

  /**
   * ------------------------------------------------------------------------
   * 3. CONTACTS
   * ------------------------------------------------------------------------
   */
  const contacts: Contact[] = [
    {
      id: 'cnt-kphl-001',
      organisationId: org1Id,
      firstName: 'Wapu',
      lastName: 'Sonk',
      fullName: 'Wapu Sonk',
      jobTitle: 'Managing Director',
      department:
        'Executive Management',
      mobile: '+675 7100 1201',
      landline: '+675 320 8000',
      email:
        'w.sonk@kumulpetroleum.com',
      gender: 'Male',
      reportsToContactId: null,
      decisionRole:
        'DECISION_MAKER',
      influenceLevel: 'HIGH',
      relationshipStrength:
        'STRONG',
      status: 'ACTIVE',
      notes:
        'Key executive sponsor. Interested in sovereign data governance and security compliance.',
      createdAt:
        daysOffset(-90),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-90),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'cnt-kphl-002',
      organisationId: org1Id,
      firstName: 'James',
      lastName: 'Koroma',
      fullName: 'James Koroma',
      jobTitle:
        'Chief Information Officer',
      department:
        'Information Technology',
      mobile: '+675 7200 4512',
      landline: '+675 320 8045',
      email:
        'j.koroma@kumulpetroleum.com',
      gender: 'Male',
      reportsToContactId:
        'cnt-kphl-001',
      decisionRole:
        'DECISION_MAKER',
      influenceLevel: 'HIGH',
      relationshipStrength:
        'STRONG',
      status: 'ACTIVE',
      notes:
        'Primary technical decision maker. Driving hybrid cloud migration and SOC partnership.',
      createdAt:
        daysOffset(-85),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-4),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'cnt-kphl-003',
      organisationId: org1Id,
      firstName: 'Moses',
      lastName: 'Vani',
      fullName: 'Moses Vani',
      jobTitle:
        'Head of ICT Infrastructure & Networks',
      department:
        'Information Technology',
      mobile: '+675 7300 8901',
      landline: '+675 320 8050',
      email:
        'm.vani@kumulpetroleum.com',
      gender: 'Male',
      reportsToContactId:
        'cnt-kphl-002',
      decisionRole:
        'TECHNICAL_EVALUATOR',
      influenceLevel: 'MEDIUM',
      relationshipStrength:
        'STRONG',
      status: 'ACTIVE',
      notes:
        'Conducts technical benchmarking for data centre colocation and dark fibre connectivity.',
      createdAt:
        daysOffset(-80),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-4),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'cnt-kphl-004',
      organisationId: org1Id,
      firstName: 'Alice',
      lastName: 'Tau',
      fullName: 'Alice Tau',
      jobTitle:
        'Commercial & Procurement Manager',
      department:
        'Finance & Procurement',
      mobile: '+675 7400 3341',
      landline: '+675 320 8020',
      email:
        'a.tau@kumulpetroleum.com',
      gender: 'Female',
      reportsToContactId:
        'cnt-kphl-001',
      decisionRole:
        'PROCUREMENT',
      influenceLevel: 'HIGH',
      relationshipStrength:
        'MODERATE',
      status: 'ACTIVE',
      notes:
        'Oversees tender guidelines and service level agreements (SLAs).',
      createdAt:
        daysOffset(-75),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-75),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'cnt-kphl-005',
      organisationId: org1Id,
      firstName: 'Garry',
      lastName: 'Nao',
      fullName: 'Garry Nao',
      jobTitle:
        'Lead Cyber Security Engineer',
      department:
        'Information Technology',
      mobile: '+675 7500 6712',
      landline: '+675 320 8055',
      email:
        'g.nao@kumulpetroleum.com',
      gender: 'Male',
      reportsToContactId:
        'cnt-kphl-003',
      decisionRole:
        'INFLUENCER',
      influenceLevel: 'MEDIUM',
      relationshipStrength:
        'MODERATE',
      status: 'ACTIVE',
      notes:
        'Strong advocate for 24/7 Managed SOC and automated incident response.',
      createdAt:
        daysOffset(-60),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-60),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'cnt-otml-001',
      organisationId: org2Id,
      firstName: 'Mark',
      lastName: 'Robinson',
      fullName:
        'Mark Robinson',
      jobTitle:
        'Chief Operating Officer',
      department:
        'Executive Operations',
      mobile: '+675 7199 4432',
      landline: '+675 649 3000',
      email:
        'mark.robinson@oktedi.com',
      gender: 'Male',
      reportsToContactId: null,
      decisionRole:
        'DECISION_MAKER',
      influenceLevel: 'HIGH',
      relationshipStrength:
        'STRONG',
      status: 'ACTIVE',
      notes:
        'Focus on operational uptime and mine automation reliability.',
      createdAt:
        daysOffset(-120),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-120),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'cnt-otml-002',
      organisationId: org2Id,
      firstName: 'Peter',
      lastName: 'Aisi',
      fullName:
        'Peter Aisi',
      jobTitle:
        'General Manager - Information Systems & Automation',
      department: 'IS&T',
      mobile: '+675 7299 1188',
      landline: '+675 649 3150',
      email:
        'peter.aisi@oktedi.com',
      gender: 'Male',
      reportsToContactId:
        'cnt-otml-001',
      decisionRole:
        'DECISION_MAKER',
      influenceLevel: 'HIGH',
      relationshipStrength:
        'STRONG',
      status: 'ACTIVE',
      notes:
        'Champion for high-speed low-earth orbit (LEO) satellite failover and private LTE/5G mesh on mine site.',
      createdAt:
        daysOffset(-115),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-2),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'cnt-otml-003',
      organisationId: org2Id,
      firstName: 'Thomas',
      lastName: 'Gima',
      fullName:
        'Thomas Gima',
      jobTitle:
        'Network & Communications Superintendent',
      department: 'IS&T',
      mobile: '+675 7399 2244',
      landline: '+675 649 3160',
      email:
        'thomas.gima@oktedi.com',
      gender: 'Male',
      reportsToContactId:
        'cnt-otml-002',
      decisionRole:
        'TECHNICAL_EVALUATOR',
      influenceLevel: 'HIGH',
      relationshipStrength:
        'STRONG',
      status: 'ACTIVE',
      notes:
        'Evaluated our SD-WAN proof-of-concept and gave positive feedback.',
      createdAt:
        daysOffset(-100),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-2),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'cnt-bsp-001',
      organisationId: org3Id,
      firstName: 'Hari',
      lastName: 'Nair',
      fullName:
        'Hari Nair',
      jobTitle:
        'Group Chief Technology Officer',
      department:
        'Executive Management',
      mobile: '+675 7011 9900',
      landline: '+675 320 1212',
      email:
        'hnair@bsp.com.pg',
      gender: 'Male',
      reportsToContactId: null,
      decisionRole:
        'DECISION_MAKER',
      influenceLevel: 'HIGH',
      relationshipStrength:
        'MODERATE',
      status: 'ACTIVE',
      notes:
        'Drives regional digital banking transformation and ISO27001 regulatory compliance.',
      createdAt:
        daysOffset(-150),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-150),
      updatedBy:
        'bdm-user-2',
    },

    {
      id: 'cnt-bsp-002',
      organisationId: org3Id,
      firstName: 'Robert',
      lastName: 'Geno',
      fullName:
        'Robert Geno',
      jobTitle:
        'Head of Enterprise IT Architecture',
      department:
        'Technology Division',
      mobile: '+675 7111 8833',
      landline: '+675 320 1280',
      email:
        'rgeno@bsp.com.pg',
      gender: 'Male',
      reportsToContactId:
        'cnt-bsp-001',
      decisionRole:
        'DECISION_MAKER',
      influenceLevel: 'HIGH',
      relationshipStrength:
        'STRONG',
      status: 'ACTIVE',
      notes:
        'Leading multi-cloud container orchestration and microservices gateway projects.',
      createdAt:
        daysOffset(-140),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-6),
      updatedBy:
        'bdm-user-2',
    },

    {
      id: 'cnt-bsp-003',
      organisationId: org3Id,
      firstName: 'Grace',
      lastName: 'Miria',
      fullName:
        'Grace Miria',
      jobTitle:
        'Strategic IT Procurement Specialist',
      department:
        'Finance & Procurement',
      mobile: '+675 7211 4455',
      landline: '+675 320 1295',
      email:
        'gmiria@bsp.com.pg',
      gender: 'Female',
      reportsToContactId:
        'cnt-bsp-001',
      decisionRole:
        'PROCUREMENT',
      influenceLevel: 'HIGH',
      relationshipStrength:
        'MODERATE',
      status: 'ACTIVE',
      notes:
        'Coordinates commercial vendor negotiations and master service contracts.',
      createdAt:
        daysOffset(-130),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-130),
      updatedBy:
        'bdm-user-2',
    },

    {
      id: 'cnt-airniugini-001',
      organisationId: org5Id,
      firstName: 'Gary',
      lastName: 'Seddon',
      fullName:
        'Gary Seddon',
      jobTitle:
        'Chief Executive Officer',
      department:
        'Executive Office',
      mobile: '+675 7000 9811',
      landline: '+675 327 3490',
      email:
        'gseddon@airniugini.com.pg',
      gender: 'Male',
      reportsToContactId: null,
      decisionRole:
        'DECISION_MAKER',
      influenceLevel: 'HIGH',
      relationshipStrength:
        'MODERATE',
      status: 'ACTIVE',
      notes:
        'Overseeing fleet expansion and passenger digital booking system upgrades.',
      createdAt:
        daysOffset(-80),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-80),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'cnt-airniugini-002',
      organisationId: org5Id,
      firstName: 'Kila',
      lastName: 'Ranu',
      fullName:
        'Kila Ranu',
      jobTitle:
        'Head of Information Systems',
      department:
        'Information Systems',
      mobile: '+675 7100 4422',
      landline: '+675 327 3500',
      email:
        'kranuan@airniugini.com.pg',
      gender: 'Male',
      reportsToContactId:
        'cnt-airniugini-001',
      decisionRole:
        'DECISION_MAKER',
      influenceLevel: 'HIGH',
      relationshipStrength:
        'STRONG',
      status: 'ACTIVE',
      notes:
        'Reviewing proposal for managed disaster recovery and multi-site backup.',
      createdAt:
        daysOffset(-75),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-10),
      updatedBy:
        'bdm-user-1',
    },
  ];

  for (const contact of contacts) {
    batch.set(
      doc(
        db,
        'contacts',
        contact.id
      ),
      contact
    );
  }

  /**
   * ------------------------------------------------------------------------
   * 4. ENGAGEMENTS
   * ------------------------------------------------------------------------
   */
  const engagements: Engagement[] = [
    {
      id: 'eng-001',
      organisationId: org1Id,
      contactId: 'cnt-kphl-002',
      assignedTo: 'bdm-user-1',
      engagementType:
        'MEETING_ONSITE',
      engagementDate:
        daysOffset(-4),
      purpose:
        'PROPOSAL_DISCUSSION',
      details:
        'Met with CIO James Koroma and Infrastructure Head Moses Vani at KPHL headquarters to present our Managed SOC and Cloud Colocation proposal.',
      outcome:
        'Client was impressed with 99.99% uptime SLA and localized 24/7 security monitoring. CIO requested a commercial quotation including disaster recovery standby.',
      status:
        'COMPLETED',
      engagementCycle: 3,
      engagementCycleDescription:
        'Quarterly Executive Review',
      nextEngagementDate:
        daysOffset(3),
      createdAt:
        daysOffset(-4),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-4),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'eng-002',
      organisationId: org2Id,
      contactId: 'cnt-otml-002',
      assignedTo: 'bdm-user-1',
      engagementType:
        'VIDEO_CONFERENCE',
      engagementDate:
        daysOffset(-2),
      purpose:
        'OPPORTUNITY_DISCUSSION',
      details:
        'Technical discovery session with Peter Aisi regarding Tabubil mine high-availability satellite & SD-WAN failover architecture.',
      outcome:
        'Agreed on scope for a 60-day pilot on the main crushing plant telemetry network. Moving to final contract draft.',
      status:
        'COMPLETED',
      engagementCycle: 2,
      engagementCycleDescription:
        'Technical Scoping & Pilot',
      nextEngagementDate:
        daysOffset(5),
      createdAt:
        daysOffset(-2),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-2),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'eng-003',
      organisationId: org3Id,
      contactId: 'cnt-bsp-002',
      assignedTo: 'bdm-user-2',
      engagementType:
        'MEETING_COFFEE',
      engagementDate:
        daysOffset(-6),
      purpose:
        'DISCOVERY',
      details:
        'Met with Robert Geno at Waigani. Discussed their annual IT refresh and new branch connectivity requirements across Highlands and Islands.',
      outcome:
        'Identified opportunity for SD-WAN deployment across 45 remote bank branches. Account Manager Michael Tamar brought into discussion.',
      status:
        'COMPLETED',
      engagementCycle: 1,
      engagementCycleDescription:
        'Initial Opportunity Discovery',
      nextEngagementDate:
        daysOffset(2),
      createdAt:
        daysOffset(-6),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-6),
      updatedBy:
        'bdm-user-2',
    },

    {
      id: 'eng-004',
      organisationId: org5Id,
      contactId:
        'cnt-airniugini-002',
      assignedTo: 'bdm-user-1',
      engagementType:
        'PHONE_CALL',
      engagementDate:
        daysOffset(-10),
      purpose:
        'FOLLOW_UP',
      details:
        'Followed up on the Cloud Disaster Recovery tender evaluation timeline with Kila Ranu.',
      outcome:
        'Tender board evaluation completed; awaiting formal CEO endorsement and Board signoff.',
      status:
        'COMPLETED',
      engagementCycle: 4,
      engagementCycleDescription:
        'Tender Commercial Close',
      nextEngagementDate:
        daysOffset(-1),
      createdAt:
        daysOffset(-10),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-10),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'eng-005',
      organisationId: org6Id,
      contactId: null,
      assignedTo: 'bdm-user-2',
      engagementType:
        'EMAIL',
      engagementDate:
        daysOffset(-20),
      purpose:
        'BUSINESS_INTRODUCTION',
      details:
        'Sent capabilities brief covering enterprise SD-WAN and VoIP solutions for manufacturing supply chains.',
      outcome:
        'Received acknowledgment from General Manager Operations; scheduled follow-up for next month.',
      status:
        'COMPLETED',
      engagementCycle: 1,
      engagementCycleDescription:
        'Outbound Introduction',
      nextEngagementDate:
        daysOffset(10),
      createdAt:
        daysOffset(-20),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-20),
      updatedBy:
        'bdm-user-2',
    },
  ];

  for (const engagement of engagements) {
    batch.set(
      doc(
        db,
        'engagements',
        engagement.id
      ),
      engagement
    );
  }

  /**
   * ------------------------------------------------------------------------
   * 5. TASKS
   * ------------------------------------------------------------------------
   */
  const tasks: Task[] = [
    {
      id: 'task-001',
      organisationId: org5Id,
      contactId:
        'cnt-airniugini-002',
      engagementId: 'eng-004',
      opportunityId: 'opp-004',
      assignedTo: 'bdm-user-1',
      title:
        'Call Kila Ranu for Board Tender Approval update',
      description:
        'Follow up on Air Niugini Board signoff for the Disaster Recovery Infrastructure SLA.',
      dueDate:
        daysOffset(-1),
      priority: 'HIGH',
      status: 'OPEN',
      completedDate: null,
      completedBy: null,
      createdAt:
        daysOffset(-10),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-10),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'task-002',
      organisationId: org1Id,
      contactId:
        'cnt-kphl-004',
      engagementId: null,
      opportunityId: 'opp-001',
      assignedTo: 'bdm-user-1',
      title:
        'Submit finalized Managed SOC Commercial Schedule to Procurement',
      description:
        'Provide Alice Tau with the final revised 3-year term pricing and localized SOC response matrix.',
      dueDate:
        daysOffset(0),
      priority: 'HIGH',
      status: 'OPEN',
      completedDate: null,
      completedBy: null,
      createdAt:
        daysOffset(-4),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-4),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'task-003',
      organisationId: org3Id,
      contactId:
        'cnt-bsp-002',
      engagementId:
        'eng-003',
      opportunityId:
        'opp-003',
      assignedTo:
        'bdm-user-2',
      title:
        'Deliver BSP 45-Branch SD-WAN Architecture Proposal',
      description:
        'Hand over technical design document and BOM pricing to Robert Geno.',
      dueDate:
        daysOffset(2),
      priority:
        'HIGH',
      status:
        'OPEN',
      completedDate:
        null,
      completedBy:
        null,
      createdAt:
        daysOffset(-6),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-6),
      updatedBy:
        'bdm-user-2',
    },

    {
      id: 'task-004',
      organisationId: org2Id,
      contactId:
        'cnt-otml-003',
      engagementId:
        'eng-002',
      opportunityId:
        'opp-002',
      assignedTo:
        'bdm-user-1',
      title:
        'Prepare OTML Remote Telemetry Pilot Agreement',
      description:
        'Draft the 60-day testing agreement and hardware staging timetable with engineering.',
      dueDate:
        daysOffset(5),
      priority:
        'MEDIUM',
      status:
        'IN_PROGRESS',
      completedDate:
        null,
      completedBy:
        null,
      createdAt:
        daysOffset(-2),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-2),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'task-005',
      organisationId: org6Id,
      contactId:
        null,
      engagementId:
        'eng-005',
      opportunityId:
        null,
      assignedTo:
        'bdm-user-2',
      title:
        'Send Paradise Foods SD-WAN ROI Whitepaper',
      description:
        'Follow up with manufacturing distribution center case studies.',
      dueDate:
        daysOffset(10),
      priority:
        'LOW',
      status:
        'OPEN',
      completedDate:
        null,
      completedBy:
        null,
      createdAt:
        daysOffset(-20),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-20),
      updatedBy:
        'bdm-user-2',
    },

    {
      id: 'task-006',
      organisationId: org1Id,
      contactId:
        'cnt-kphl-002',
      engagementId:
        'eng-001',
      opportunityId:
        'opp-001',
      assignedTo:
        'bdm-user-1',
      title:
        'Prepare Executive Presentation Deck for KPHL Meeting',
      description:
        'Finalize presentation slides covering sovereign cloud and localized SOC architecture.',
      dueDate:
        daysOffset(-5),
      priority:
        'HIGH',
      status:
        'COMPLETED',
      completedDate:
        daysOffset(-4),
      completedBy:
        'bdm-user-1',
      createdAt:
        daysOffset(-8),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-4),
      updatedBy:
        'bdm-user-1',
    },
  ];

  for (const task of tasks) {
    batch.set(
      doc(
        db,
        'tasks',
        task.id
      ),
      task
    );
  }

  /**
   * ------------------------------------------------------------------------
   * 6. OPPORTUNITIES
   * ------------------------------------------------------------------------
   */
  const opportunities: Opportunity[] = [
    {
      id: 'opp-001',
      organisationId: org1Id,
      contactId:
        'cnt-kphl-002',
      title:
        'Enterprise Managed SOC & Cloud Colocation Agreement',
      description:
        '3-year contract for 24/7 Security Operations Centre (SOC) monitoring, threat hunting, and 12-rack primary Data Centre colocation.',
      solutionCategory:
        'Cyber Security & SOC Services',
      discoveredDate:
        daysOffset(-60),
      status:
        'OPEN',
      pipelineStage:
        'NEGOTIATION',
      estimatedValue:
        1850000,
      currency:
        'PGK',
      bdmOwnerId:
        'bdm-user-1',
      accountManagerId:
        'am-user-1',
      referredDate:
        daysOffset(-30),
      closedDate:
        null,
      winReason:
        null,
      lossReason:
        null,
      notes:
        'Final contract terms under legal review. Target contract signing date next month.',
      createdAt:
        daysOffset(-60),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-4),
      updatedBy:
        'am-user-1',
    },

    {
      id: 'opp-002',
      organisationId: org2Id,
      contactId:
        'cnt-otml-002',
      title:
        'Tabubil Mine High-Resilience Satellite & SD-WAN',
      description:
        'Deployment of redundant hybrid satellite / microwave communication channels and SD-WAN edge routers across mine operations.',
      solutionCategory:
        'Satellite & Remote Connectivity',
      discoveredDate:
        daysOffset(-45),
      status:
        'OPEN',
      pipelineStage:
        'PROPOSAL',
      estimatedValue:
        1200000,
      currency:
        'PGK',
      bdmOwnerId:
        'bdm-user-1',
      accountManagerId:
        'am-user-2',
      referredDate:
        daysOffset(-20),
      closedDate:
        null,
      winReason:
        null,
      lossReason:
        null,
      notes:
        'Proposal submitted. Scoping 60-day telemetry pilot.',
      createdAt:
        daysOffset(-45),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-2),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'opp-003',
      organisationId: org3Id,
      contactId:
        'cnt-bsp-002',
      title:
        'Branch Network SD-WAN & Unified Comms Rollout',
      description:
        'Nationwide SD-WAN upgrade for 45 regional branches and corporate headquarters with integrated SIP trunking and VoIP.',
      solutionCategory:
        'SD-WAN & Enterprise Networking',
      discoveredDate:
        daysOffset(-25),
      status:
        'OPEN',
      pipelineStage:
        'SOLUTION_DEVELOPMENT',
      estimatedValue:
        2400000,
      currency:
        'PGK',
      bdmOwnerId:
        'bdm-user-2',
      accountManagerId:
        'am-user-1',
      referredDate:
        daysOffset(-15),
      closedDate:
        null,
      winReason:
        null,
      lossReason:
        null,
      notes:
        'Collaborating with BSP IT Architecture team on Bill of Materials and site survey schedule.',
      createdAt:
        daysOffset(-25),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-6),
      updatedBy:
        'am-user-1',
    },

    {
      id: 'opp-004',
      organisationId: org5Id,
      contactId:
        'cnt-airniugini-002',
      title:
        'Cloud Disaster Recovery & Multi-Site Replication',
      description:
        'Dedicated cloud-hosted DR site with automated failover for airline ticketing and dispatch systems.',
      solutionCategory:
        'Disaster Recovery & Backup',
      discoveredDate:
        daysOffset(-75),
      status:
        'OPEN',
      pipelineStage:
        'PROPOSAL',
      estimatedValue:
        890000,
      currency:
        'PGK',
      bdmOwnerId:
        'bdm-user-1',
      accountManagerId:
        'am-user-2',
      referredDate:
        daysOffset(-40),
      closedDate:
        null,
      winReason:
        null,
      lossReason:
        null,
      notes:
        'Tender submitted. Awaiting official board approval letter.',
      createdAt:
        daysOffset(-75),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-10),
      updatedBy:
        'bdm-user-1',
    },

    {
      id: 'opp-005',
      organisationId: org4Id,
      contactId:
        null,
      title:
        'Enterprise Dark Fibre & Interconnect Colocation',
      description:
        'Long-term dark fibre interconnect lease connecting major telehousing nodes.',
      solutionCategory:
        'Data Centre & Colocation',
      discoveredDate:
        daysOffset(-90),
      status:
        'WON',
      pipelineStage:
        'CLOSED',
      estimatedValue:
        1450000,
      currency:
        'PGK',
      bdmOwnerId:
        'bdm-user-2',
      accountManagerId:
        'am-user-1',
      referredDate:
        daysOffset(-60),
      closedDate:
        daysOffset(-15),
      winReason:
        'Superior local data centre tier rating and competitive 5-year commercial lease pricing.',
      lossReason:
        null,
      notes:
        'Contract executed and service turn-up completed on schedule.',
      createdAt:
        daysOffset(-90),
      createdBy:
        'bdm-user-2',
      updatedAt:
        daysOffset(-15),
      updatedBy:
        'am-user-1',
    },

    {
      id: 'opp-006',
      organisationId: org7Id,
      contactId:
        null,
      title:
        'Refinery Process SCADA Monitoring Upgrade',
      description:
        'Industrial IoT and perimeter security solution for fuel terminal logistics.',
      solutionCategory:
        'Hardware & System Integration',
      discoveredDate:
        daysOffset(-110),
      status:
        'LOST',
      pipelineStage:
        'CLOSED',
      estimatedValue:
        650000,
      currency:
        'PGK',
      bdmOwnerId:
        'bdm-user-1',
      accountManagerId:
        'am-user-2',
      referredDate:
        daysOffset(-80),
      closedDate:
        daysOffset(-35),
      winReason:
        null,
      lossReason:
        'Customer global headquarters postponed capital expenditure across all regional refining assets.',
      notes:
        'Opportunity closed due to budget freeze. Re-evaluate next fiscal year.',
      createdAt:
        daysOffset(-110),
      createdBy:
        'bdm-user-1',
      updatedAt:
        daysOffset(-35),
      updatedBy:
        'bdm-user-1',
    },
  ];

  for (const opportunity of opportunities) {
    batch.set(
      doc(
        db,
        'opportunities',
        opportunity.id
      ),
      opportunity
    );
  }

  /*
   * Commit the entire development dataset as one batch.
   */
  await batch.commit();

  return {
    usersCount:
      SEED_USERS.length,
    orgsCount:
      organisations.length,
    contactsCount:
      contacts.length,
    engagementsCount:
      engagements.length,
    tasksCount:
      tasks.length,
    oppsCount:
      opportunities.length,
  };
}

/**
 * --------------------------------------------------------------------------
 * CLEAR ALL DEVELOPMENT DATA
 * --------------------------------------------------------------------------
 *
 * This operation is explicitly prohibited in production.
 *
 * NOTE:
 * The users collection is intentionally NOT included here.
 * Clearing users is a substantially more destructive operation and should
 * never be coupled to a general demo-data reset.
 */
export async function clearAllData(): Promise<void> {
  assertDevelopmentEnvironment();
  assertAuthenticated();

  const collections = [
    'organisations',
    'contacts',
    'engagements',
    'tasks',
    'opportunities',
    'notifications',
  ];

  for (const collectionName of collections) {
    try {
      const snapshot =
        await getDocs(
          collection(
            db,
            collectionName
          )
        );

      /*
       * Firestore batches have a finite operation limit.
       *
       * Process in chunks so this remains safe if the development
       * dataset grows beyond the current sample size.
       */
      const chunkSize = 450;

      for (
        let index = 0;
        index < snapshot.docs.length;
        index += chunkSize
      ) {
        const batch =
          writeBatch(db);

        const chunk =
          snapshot.docs.slice(
            index,
            index + chunkSize
          );

        chunk.forEach(
          (document) => {
            batch.delete(
              document.ref
            );
          }
        );

        await batch.commit();
      }
    } catch (error) {
      console.warn(
        `Failed to clear collection ${collectionName}:`,
        error
      );
    }
  }
}