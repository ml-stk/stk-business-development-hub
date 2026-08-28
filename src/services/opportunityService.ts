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
import { Opportunity, PipelineStage, OpportunityStatus } from '../types';

const COLLECTION_NAME = 'opportunities';

export const opportunityService = {
  async getAll(): Promise<Opportunity[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Opportunity[];
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      return [];
    }
  },

  async getByOrganisation(organisationId: string): Promise<Opportunity[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('organisationId', '==', organisationId)
      );
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Opportunity[];
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      console.error(`Error fetching opportunities for organisation ${organisationId}:`, err);
      return [];
    }
  },

  async getById(id: string): Promise<Opportunity | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Opportunity;
    } catch (err) {
      console.error(`Error fetching opportunity ${id}:`, err);
      return null;
    }
  },

  async create(data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Opportunity> {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const now = new Date().toISOString();

    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error('Authentication required to create an opportunity.');

    const newOpp: Opportunity = {
      ...data,
      createdBy: currentUid,
      updatedBy: currentUid,
      id: docRef.id,
      contactId: data.contactId || null,
      accountManagerId: data.accountManagerId || null,
      referredDate: data.referredDate || null,
      closedDate: data.closedDate || null,
      winReason: data.winReason || null,
      lossReason: data.lossReason || null,
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(docRef, newOpp);
    return newOpp;
  },

  async update(id: string, data: Partial<Opportunity>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error('Authentication required to update an opportunity.');

    const updatePayload: Record<string, any> = {
      ...data,
      updatedBy: currentUid,
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(docRef, updatePayload);
  },

  async updateStage(
    id: string,
    stage: PipelineStage,
    status?: OpportunityStatus,
    updatedBy?: string
  ): Promise<void> {
    const updateData: Partial<Opportunity> = {
      pipelineStage: stage,
      ...(updatedBy ? { updatedBy } : {}),
    };
    if (status) {
      updateData.status = status;
      if (status === 'WON' || status === 'LOST') {
        updateData.closedDate = new Date().toISOString();
      }
    }
    await this.update(id, updateData);
  },

  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },
};
