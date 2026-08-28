import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Engagement, Task } from '../types';
import { organisationService } from './organisationService';
import { taskService } from './taskService';

const COLLECTION_NAME = 'engagements';

export function calculateDaysUntilNext(nextDateStr: string | null): number | null {
  if (!nextDateStr) return null;
  const target = new Date(nextDateStr);
  const now = new Date();
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = targetDay.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export const engagementService = {
  async getAll(): Promise<Engagement[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('engagementDate', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Engagement[];
    } catch (err) {
      console.error('Error fetching engagements:', err);
      return [];
    }
  },

  async getByOrganisation(organisationId: string): Promise<Engagement[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('organisationId', '==', organisationId)
      );
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Engagement[];
      return items.sort((a, b) => new Date(b.engagementDate).getTime() - new Date(a.engagementDate).getTime());
    } catch (err) {
      console.error(`Error fetching engagements for organisation ${organisationId}:`, err);
      return [];
    }
  },

  async getByContact(contactId: string): Promise<Engagement[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('contactId', '==', contactId)
      );
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Engagement[];
      return items.sort((a, b) => new Date(b.engagementDate).getTime() - new Date(a.engagementDate).getTime());
    } catch (err) {
      console.error(`Error fetching engagements for contact ${contactId}:`, err);
      return [];
    }
  },

  async getById(id: string): Promise<Engagement | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Engagement;
    } catch (err) {
      console.error(`Error fetching engagement ${id}:`, err);
      return null;
    }
  },

  async create(
    data: Omit<Engagement, 'id' | 'createdAt' | 'updatedAt'>,
    options?: { createFollowUpTask?: boolean; taskAssignedTo?: string; taskTitle?: string }
  ): Promise<{ engagement: Engagement; task?: Task }> {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const now = new Date().toISOString();

    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error('Authentication required to create an engagement.');

    const newEngagement: Engagement = {
      ...data,
      createdBy: currentUid,
      updatedBy: currentUid,
      id: docRef.id,
      contactId: data.contactId || null,
      engagementCycle: data.engagementCycle || null,
      engagementCycleDescription: data.engagementCycleDescription || null,
      nextEngagementDate: data.nextEngagementDate || null,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(docRef, newEngagement);

    // Update Organisation lastEngagementDate and nextFollowUpDate
    try {
      const org = await organisationService.getById(data.organisationId);
      if (org) {
        const updateData: Record<string, any> = {
          updatedBy: data.createdBy,
        };

        if (
          !org.lastEngagementDate ||
          new Date(data.engagementDate).getTime() >= new Date(org.lastEngagementDate).getTime()
        ) {
          updateData.lastEngagementDate = data.engagementDate;
        }

        if (data.nextEngagementDate) {
          updateData.nextFollowUpDate = data.nextEngagementDate;
        }

        await organisationService.update(data.organisationId, updateData);
      }
    } catch (err) {
      console.warn('Failed to update organisation follow-up dates on engagement creation:', err);
    }

    // Optional follow-up task creation
    let createdTask: Task | undefined;
    if (options?.createFollowUpTask && data.nextEngagementDate) {
      try {
        const taskTitle =
          options.taskTitle ||
          `Follow up: ${data.purpose.replace(/_/g, ' ')} (${data.engagementType.replace(/_/g, ' ')})`;
        createdTask = await taskService.create({
          organisationId: data.organisationId,
          contactId: data.contactId || null,
          engagementId: newEngagement.id,
          opportunityId: null,
          assignedTo: options.taskAssignedTo || data.assignedTo,
          title: taskTitle,
          description: `Auto-generated follow up from engagement on ${new Date(data.engagementDate).toLocaleDateString()}.\nOutcome: ${data.outcome}`,
          dueDate: data.nextEngagementDate,
          priority: 'MEDIUM',
          status: 'OPEN',
          createdBy: data.createdBy,
          updatedBy: data.createdBy,
        });
      } catch (err) {
        console.warn('Failed to create automatic follow-up task:', err);
      }
    }

    return { engagement: newEngagement, task: createdTask };
  },

  async update(id: string, data: Partial<Engagement>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error('Authentication required to update an engagement.');

    const updatePayload: Record<string, any> = {
      ...data,
      updatedBy: currentUid,
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(docRef, updatePayload);
  },

  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },
};
