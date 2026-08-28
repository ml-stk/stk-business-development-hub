import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MasterSetting } from '../types';
import {
  DEFAULT_SECTORS,
  DEFAULT_SOLUTION_CATEGORIES,
  DEFAULT_ENGAGEMENT_TYPES,
  DEFAULT_ENGAGEMENT_PURPOSES,
} from './masterDataDefaults';

const COLLECTION_NAME = 'settings';

export const INITIAL_SETTINGS: Record<string, { label: string; values: string[] }> = {
  sectors: {
    label: 'Industry Sectors',
    values: DEFAULT_SECTORS,
  },
  solutionCategories: {
    label: 'Solution Categories',
    values: DEFAULT_SOLUTION_CATEGORIES,
  },
  organisationCategories: {
    label: 'Organisation Categories',
    values: ['PRIMARY', 'SECONDARY'],
  },
  taskPriorities: {
    label: 'Task Priorities',
    values: ['HIGH', 'MEDIUM', 'LOW'],
  },
};

export const settingsService = {
  async getAll(): Promise<MasterSetting[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      if (snapshot.empty) {
        // Initialize default settings in firestore
        const initialList: MasterSetting[] = [];
        for (const [key, data] of Object.entries(INITIAL_SETTINGS)) {
          const setting: MasterSetting = {
            id: key,
            key,
            label: data.label,
            values: data.values,
            updatedAt: new Date().toISOString(),
            updatedBy: 'System',
          };
          await setDoc(doc(db, COLLECTION_NAME, key), setting);
          initialList.push(setting);
        }
        return initialList;
      }

      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as MasterSetting[];
    } catch (err) {
      console.error('Error fetching settings:', err);
      // Fallback
      return Object.entries(INITIAL_SETTINGS).map(([key, data]) => ({
        id: key,
        key,
        label: data.label,
        values: data.values,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Local Defaults',
      }));
    }
  },

  async getByKey(key: string): Promise<string[]> {
    try {
      const docRef = doc(db, COLLECTION_NAME, key);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as MasterSetting;
        return data.values || [];
      }
      return INITIAL_SETTINGS[key]?.values || [];
    } catch (err) {
      return INITIAL_SETTINGS[key]?.values || [];
    }
  },

  async setByKey(key: string, values: string[]): Promise<void> {
    await this.updateValues(key, values, 'Administrator');
  },

  async resetToDefaults(): Promise<void> {
    for (const [key, data] of Object.entries(INITIAL_SETTINGS)) {
      await this.updateValues(key, data.values, 'System Default Reset');
    }
  },

  async updateValues(key: string, values: string[], updatedBy: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, key);
    const existing = await getDoc(docRef);
    const now = new Date().toISOString();

    if (existing.exists()) {
      await updateDoc(docRef, {
        values,
        updatedAt: now,
        updatedBy,
      });
    } else {
      await setDoc(docRef, {
        id: key,
        key,
        label: INITIAL_SETTINGS[key]?.label || key,
        values,
        updatedAt: now,
        updatedBy,
      });
    }
  },
};
