import {
  DEFAULT_ENGAGEMENT_TYPES,
  DEFAULT_ENGAGEMENT_PURPOSES,
  DEFAULT_SECTORS,
  DEFAULT_SOLUTION_CATEGORIES,
} from './masterDataDefaults';
import { settingsService } from './settingsService';

export interface MasterDataOption {
  value: string;
  label: string;
  isActive?: boolean;
}

export const masterDataService = {
  async getEngagementTypes(): Promise<MasterDataOption[]> {
    try {
      const customValues = await settingsService.getByKey('engagementTypes');
      if (customValues && customValues.length > 0) {
        return customValues.map((val) => {
          const matched = DEFAULT_ENGAGEMENT_TYPES.find((d) => d.value === val);
          return {
            value: val,
            label: matched ? matched.label : val.replace(/_/g, ' '),
            isActive: true,
          };
        });
      }
    } catch (err) {
      console.warn('Fallback to default engagement types:', err);
    }
    return DEFAULT_ENGAGEMENT_TYPES.map((t) => ({ ...t, isActive: true }));
  },

  async getEngagementPurposes(): Promise<MasterDataOption[]> {
    try {
      const customValues = await settingsService.getByKey('engagementPurposes');
      if (customValues && customValues.length > 0) {
        return customValues.map((val) => {
          const matched = DEFAULT_ENGAGEMENT_PURPOSES.find((d) => d.value === val);
          return {
            value: val,
            label: matched ? matched.label : val.replace(/_/g, ' '),
            isActive: true,
          };
        });
      }
    } catch (err) {
      console.warn('Fallback to default engagement purposes:', err);
    }
    return DEFAULT_ENGAGEMENT_PURPOSES.map((p) => ({ ...p, isActive: true }));
  },

  async getSectors(): Promise<string[]> {
    try {
      const customSectors = await settingsService.getByKey('sectors');
      if (customSectors && customSectors.length > 0) {
        return customSectors;
      }
    } catch (err) {
      console.warn('Fallback to default sectors:', err);
    }
    return DEFAULT_SECTORS;
  },

  async getSolutionCategories(): Promise<string[]> {
    try {
      const customCategories = await settingsService.getByKey('solutionCategories');
      if (customCategories && customCategories.length > 0) {
        return customCategories;
      }
    } catch (err) {
      console.warn('Fallback to default solution categories:', err);
    }
    return DEFAULT_SOLUTION_CATEGORIES;
  },
};

export default masterDataService;
