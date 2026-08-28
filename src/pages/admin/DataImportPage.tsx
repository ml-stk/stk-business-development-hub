import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  migrationService,
  WorkbookParseResult,
  MigrationSummaryReport,
} from '../../services/migrationService';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Building2,
  Users,
  Calendar,
  TrendingUp,
  FileText,
  Layers,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Database,
  Check,
  AlertTriangle,
} from 'lucide-react';

export const DataImportPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [workbookData, setWorkbookData] = useState<WorkbookParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<MigrationSummaryReport | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'sheets' | 'results'>('upload');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorNotice(null);
    setReport(null);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const result = evt.target?.result;
        if (!result) return;

        const parsed = migrationService.parseWorkbook(result, file.name);
        if (parsed.sheets.length === 0) {
          setErrorNotice('No recognizable data sheets found in this file.');
          return;
        }

        setWorkbookData(parsed);
        setActiveTab('sheets');
      } catch (err: any) {
        setErrorNotice(`Failed to parse file: ${err.message}`);
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleLoadSampleWorkbook = () => {
    const sampleCsv = `Name,Category,Sector,Priority,Status,Aliases,Location,Website,Description,Notes
"Kumul Petroleum Holdings Limited","PRIMARY","Oil, Gas & Energy","HIGH","ACTIVE","KPHL; Kumul Pet","Port Moresby, PNG","https://kumulpetroleum.com","National oil and gas corporation of Papua New Guinea","High priority ICT transformation target"
"Ok Tedi Mining Limited","PRIMARY","Mining & Resources","HIGH","ACTIVE","OTML; OKTedi","Tabubil, Western Province, PNG","https://oktedi.com","Major copper and gold producer operating in Western Province","Tabubil data center upgrade and remote satellite connectivity"
"Bank South Pacific Financial Group","PRIMARY","Banking & Financial Services","HIGH","ACTIVE","BSP; Bank South Pacific","Port Moresby, PNG","https://www.bsp.com.pg","Largest financial institution and retail bank across the South Pacific","Core banking SD-WAN interconnectivity and cloud disaster recovery"
"Paradise Company Limited","SECONDARY","Manufacturing & FMCG","MEDIUM","ACTIVE","Paradise Foods; Laga Industries","Lae, Morobe Province, PNG","https://paradisefoods.com.pg","Leading food and beverage manufacturer in PNG","ERP migration and WAN link consolidation"`;

    const parsed = migrationService.parseWorkbook(sampleCsv, 'Sample_STK_Targets.csv');
    setWorkbookData(parsed);
    setActiveTab('sheets');
  };

  const handleRunMigration = async () => {
    if (!workbookData || !currentUser) return;
    setIsProcessing(true);
    setErrorNotice(null);

    try {
      const summary = await migrationService.executeMigration(
        workbookData,
        currentUser.uid,
        currentUser.displayName
      );
      setReport(summary);
      setActiveTab('results');
    } catch (err: any) {
      setErrorNotice(`Migration failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Upload className="w-5 h-5" />
            </div>
            Data Import & Excel Migration Engine
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Enterprise migration tool for legacy Excel workbooks (Targets, CmdChainHeatMap, Worklist, Opportunities)
          </p>
        </div>

        <button
          onClick={handleLoadSampleWorkbook}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl transition-all cursor-pointer shadow-xs"
        >
          <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
          Load Sample Excel Data
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex rounded-xl bg-[#131317] p-1 border border-white/10 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'upload'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Upload className="w-4 h-4" />
          1. Upload Workbook
        </button>

        <button
          onClick={() => setActiveTab('sheets')}
          disabled={!workbookData}
          className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'sheets'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          2. Worksheet Verification ({workbookData ? workbookData.sheets.length : 0})
        </button>

        <button
          onClick={() => setActiveTab('results')}
          disabled={!report}
          className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'results'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          3. Migration Summary
        </button>
      </div>

      {errorNotice && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* TAB 1: UPLOAD */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* File Upload Box */}
          <div className="bg-[#131317] rounded-2xl border border-white/10 p-6 sm:p-8 shadow-xl text-center">
            <label className="border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-8 block text-center cursor-pointer transition-all bg-black/20 hover:bg-indigo-500/5 group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-white block">
                Choose an Excel Workbook (.xlsx, .xls) or CSV file
              </span>
              <span className="text-xs text-neutral-400 mt-1 block max-w-md mx-auto">
                Supports multi-tab workbooks containing Targets, CmdChainHeatMap, Worklist, and Opportunities.
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Supported Worksheet Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-[#131317] p-4 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <Building2 className="w-4 h-4" />
                <h4 className="text-xs font-bold text-white">Targets (Organisations)</h4>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Maps target names, aliases, sectors, priority tiers (High/Med/Low), and categories.
              </p>
            </div>

            <div className="bg-[#131317] p-4 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <Users className="w-4 h-4" />
                <h4 className="text-xs font-bold text-white">CmdChainHeatMap (Contacts)</h4>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Imports executive stakeholders and builds reporting hierarchy via <code className="text-indigo-300">ReportsToPID</code>.
              </p>
            </div>

            <div className="bg-[#131317] p-4 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <Calendar className="w-4 h-4" />
                <h4 className="text-xs font-bold text-white">Worklist (Engagements & Tasks)</h4>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Migrates historical meetings, interactions, and generates dynamic follow-up tasks.
              </p>
            </div>

            <div className="bg-[#131317] p-4 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <TrendingUp className="w-4 h-4" />
                <h4 className="text-xs font-bold text-white">Opportunities</h4>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Imports sales pipelines, deals, solution categories, and PGK/USD estimated values.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SHEET VERIFICATION */}
      {activeTab === 'sheets' && workbookData && (
        <div className="space-y-5">
          <div className="bg-[#131317] rounded-2xl border border-white/10 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-xs font-bold text-white">{workbookData.fileName}</h3>
                  <p className="text-[11px] text-neutral-400">
                    Detected {workbookData.sheets.length} worksheet(s) ready for migration
                  </p>
                </div>
              </div>

              <button
                onClick={handleRunMigration}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Executing Migration...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    Execute Full Migration Workflow
                  </>
                )}
              </button>
            </div>

            {/* Sheets list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workbookData.sheets.map((sheet, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400" />
                      <h4 className="text-xs font-bold text-white">{sheet.sheetName}</h4>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                      {sheet.recognizedType}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-300 flex items-center justify-between">
                    <span>Data Rows:</span>
                    <strong className="text-white">{sheet.rows.length}</strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                      Detected Columns
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {sheet.headers.slice(0, 6).map((h, hIdx) => (
                        <span
                          key={hIdx}
                          className="text-[10px] bg-white/5 text-neutral-300 px-2 py-0.5 rounded border border-white/5"
                        >
                          {h}
                        </span>
                      ))}
                      {sheet.headers.length > 6 && (
                        <span className="text-[10px] text-neutral-500 px-1 py-0.5">
                          +{sheet.headers.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MIGRATION RESULTS */}
      {activeTab === 'results' && report && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-[#131317] border border-white/10 space-y-1">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                Organisations Created
              </span>
              <p className="text-2xl font-bold text-emerald-400">{report.organisationsCreated}</p>
              <p className="text-[10px] text-neutral-400">
                +{report.organisationsMatched} matched existing
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#131317] border border-white/10 space-y-1">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                Contacts Created
              </span>
              <p className="text-2xl font-bold text-indigo-400">{report.contactsCreated}</p>
              <p className="text-[10px] text-neutral-400">
                {report.contactsHierarchyLinked} hierarchy links resolved
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#131317] border border-white/10 space-y-1">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                Engagements & Tasks
              </span>
              <p className="text-2xl font-bold text-amber-400">
                {report.engagementsCreated + report.tasksCreated}
              </p>
              <p className="text-[10px] text-neutral-400">
                {report.engagementsCreated} logs, {report.tasksCreated} tasks
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#131317] border border-white/10 space-y-1">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                Opportunities Created
              </span>
              <p className="text-2xl font-bold text-purple-400">{report.opportunitiesCreated}</p>
              <p className="text-[10px] text-neutral-400">Deals added to pipeline</p>
            </div>
          </div>

          {/* Detailed Execution Logs */}
          <div className="bg-[#131317] rounded-2xl border border-white/10 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Migration Execution Audit Log
              </h3>
              <span className="text-xs text-neutral-400">
                {report.validationErrors.length} validation issues
              </span>
            </div>

            <div className="bg-black/50 text-slate-200 rounded-xl p-4 font-mono text-xs max-h-64 overflow-y-auto space-y-1.5 border border-white/5">
              {report.detailedLogs.map((log, idx) => (
                <div key={idx} className="text-neutral-300">
                  {log}
                </div>
              ))}
              {report.validationErrors.map((err, idx) => (
                <div key={`err-${idx}`} className="text-rose-400">
                  [{err.entity} Row {err.row}] Warning: {err.error}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
