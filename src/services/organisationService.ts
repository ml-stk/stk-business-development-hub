import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Organisation, OrgCategory, OrgPriority, OrgStatus } from '../types';

const COLLECTION_NAME = 'organisations';

// Helper string normalization
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check string similarity (0 to 1) using dice-coefficient / token overlap
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const words1 = new Set(s1.split(' ').filter((w) => w.length > 2));
  const words2 = new Set(s2.split(' ').filter((w) => w.length > 2));
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

export interface DuplicateMatch {
  organisation: Organisation;
  matchedNameOrAlias: string;
  confidence: number;
  reason: string;
}

export const organisationService = {
  async getAll(): Promise<Organisation[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Organisation[];
    } catch (err) {
      console.error('Error fetching organisations:', err);
      return [];
    }
  },

  async getById(id: string): Promise<Organisation | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Organisation;
    } catch (err) {
      console.error(`Error fetching organisation ${id}:`, err);
      return null;
    }
  },

  async create(data: Omit<Organisation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organisation> {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const now = new Date().toISOString();
    const cleanAliases = Array.isArray(data.aliases)
      ? Array.from(new Set(data.aliases.map((a) => a.trim()).filter(Boolean)))
      : [];

    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error('Authentication required to create an organisation.');

    const newOrg: Organisation = {
      ...data,
      createdBy: currentUid,
      updatedBy: currentUid,
      id: docRef.id,
      aliases: cleanAliases,
      createdAt: now,
      updatedAt: now,
      lastEngagementDate: data.lastEngagementDate || null,
      nextFollowUpDate: data.nextFollowUpDate || null,
    };

    await setDoc(docRef, newOrg);
    return newOrg;
  },

  async update(id: string, data: Partial<Organisation>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error('Authentication required to update an organisation.');

    const updatePayload: Record<string, any> = {
      ...data,
      updatedBy: currentUid,
      updatedAt: new Date().toISOString(),
    };
    if (data.aliases) {
      updatePayload.aliases = Array.from(
        new Set(data.aliases.map((a) => a.trim()).filter(Boolean))
      );
    }
    await updateDoc(docRef, updatePayload);
  },

  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  async archive(id: string, updatedBy: string): Promise<void> {
    await this.update(id, { status: 'ARCHIVED', updatedBy });
  },

  // Check for potential duplicate organisations against existing records
  checkDuplicates(
    candidateName: string,
    candidateAliases: string[] = [],
    existingOrgs: Organisation[],
    excludeOrgId?: string
  ): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];
    const normalizedCandidate = normalizeString(candidateName);
    const candidateTerms = [
      candidateName,
      ...candidateAliases.filter((a) => a.trim().length > 0),
    ];

    for (const org of existingOrgs) {
      if (excludeOrgId && org.id === excludeOrgId) continue;

      const orgTerms = [org.name, ...(org.aliases || [])];

      for (const cTerm of candidateTerms) {
        for (const oTerm of orgTerms) {
          const sim = calculateSimilarity(cTerm, oTerm);
          if (sim >= 0.7) {
            matches.push({
              organisation: org,
              matchedNameOrAlias: oTerm,
              confidence: Math.round(sim * 100),
              reason: `Name "${cTerm}" is ${Math.round(sim * 100)}% similar to existing "${oTerm}"`,
            });
            break;
          }
        }
      }
    }

    // Sort by highest confidence
    return matches.sort((a, b) => b.confidence - a.confidence);
  },
};
