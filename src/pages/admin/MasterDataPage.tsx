import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { settingsService } from '../../services/settingsService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Settings, Plus, Trash2, CheckCircle2, RefreshCw, Layers } from 'lucide-react';

interface MasterDataSection {
  key: string;
  title: string;
  description: string;
}

const MASTER_DATA_SECTIONS: MasterDataSection[] = [
  {
    key: 'sectors',
    title: 'Industry Sectors',
    description: 'Target business industries and vertical market segments in Papua New Guinea',
  },
  {
    key: 'solutionCategories',
    title: 'Solution Categories',
    description: 'Commercial ICT service lines, cloud, network infrastructure, and cybersecurity',
  },
  {
    key: 'lossReasons',
    title: 'Opportunity Loss Reasons',
    description: 'Mandatory audit reasons captured when an opportunity is marked LOST',
  },
  {
    key: 'engagementPurposes',
    title: 'Engagement Purposes',
    description: 'Meeting objectives and client touchpoint classifications',
  },
];

export const MasterDataPage: React.FC = () => {
  const { isAdmin, isBDMManager } = useAuth();

  const [loading, setLoading] = useState(true);
  const [dataMap, setDataMap] = useState<{ [key: string]: string[] }>({});
  const [newInputs, setNewInputs] = useState<{ [key: string]: string }>({});
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        MASTER_DATA_SECTIONS.map((s) => settingsService.getByKey(s.key))
      );
      const newMap: { [key: string]: string[] } = {};
      MASTER_DATA_SECTIONS.forEach((s, idx) => {
        newMap[s.key] = results[idx] || [];
      });
      setDataMap(newMap);
    } catch (e) {
      console.error('Error loading master data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 3000);
  };

  const handleAddItem = async (key: string) => {
    const text = (newInputs[key] || '').trim();
    if (!text) return;

    const currentList = dataMap[key] || [];
    if (currentList.includes(text)) {
      triggerToast(`"${text}" already exists in the list.`);
      return;
    }

    const updatedList = [...currentList, text];
    await settingsService.setByKey(key, updatedList);
    setDataMap((prev) => ({ ...prev, [key]: updatedList }));
    setNewInputs((prev) => ({ ...prev, [key]: '' }));
    triggerToast(`Added "${text}" successfully.`);
  };

  const handleRemoveItem = async (key: string, itemToRemove: string) => {
    const currentList = dataMap[key] || [];
    const updatedList = currentList.filter((item) => item !== itemToRemove);
    await settingsService.setByKey(key, updatedList);
    setDataMap((prev) => ({ ...prev, [key]: updatedList }));
    triggerToast(`Removed "${itemToRemove}".`);
  };

  const handleResetDefaults = async () => {
    setLoading(true);
    await settingsService.resetToDefaults();
    await loadData();
    triggerToast('Master data reset to standard enterprise defaults.');
  };

  if (loading) {
    return <LoadingSpinner text="Loading master data configurations..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-600" />
            Master Data & Lookup Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure industry sectors, solution catalog categories, loss reasons, and taxonomy
          </p>
        </div>

        <button
          onClick={handleResetDefaults}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset to Factory Defaults
        </button>
      </div>

      {/* Grid of Master Data Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {MASTER_DATA_SECTIONS.map((section) => {
          const items = dataMap[section.key] || [];
          const inputValue = newInputs[section.key] || '';

          return (
            <div
              key={section.key}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
                  </div>
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    {items.length} Options
                  </span>
                </div>

                {/* Items List */}
                <div className="mt-4 flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200 hover:bg-slate-200/70 transition-colors"
                    >
                      {item}
                      <button
                        onClick={() => handleRemoveItem(section.key, item)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title={`Remove ${item}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Add Input Bar */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) =>
                    setNewInputs((prev) => ({ ...prev, [section.key]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem(section.key);
                    }
                  }}
                  placeholder={`Add new ${section.title.toLowerCase().slice(0, -1)}...`}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => handleAddItem(section.key)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toast Notification */}
      {savedToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedToast}</span>
        </div>
      )}
    </div>
  );
};
