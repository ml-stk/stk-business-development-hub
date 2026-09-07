import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { migrationService, WorkbookParseResult, MigrationSummaryReport } from '../../services/migrationService';
import { ImportPlan } from '../../services/businessImportPlanner';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ShieldCheck, Database, AlertTriangle, Loader2 } from 'lucide-react';

export const DataImportPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [workbookData, setWorkbookData] = useState<WorkbookParseResult | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [report, setReport] = useState<MigrationSummaryReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const analyse = async (parsed: WorkbookParseResult) => {
    setIsProcessing(true); setErrorNotice(null); setReport(null);
    try { setWorkbookData(parsed); setPlan(await migrationService.createImportPlan(parsed)); }
    catch (err: any) { setErrorNotice(`Import analysis failed: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const result = evt.target?.result; if (!result) return;
        const parsed = migrationService.parseWorkbook(result, file.name);
        if (!parsed.sheets.length) throw new Error('No data worksheets were found.');
        void analyse(parsed);
      } catch (err: any) { setErrorNotice(`Failed to parse workbook: ${err.message}`); }
    };
    if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) reader.readAsArrayBuffer(file); else reader.readAsText(file);
    e.target.value = '';
  };

  const commit = async () => {
    if (!workbookData || !plan || !currentUser) return;
    if (currentUser.role !== 'ADMIN') { setErrorNotice('Administrator privileges are required to commit an import.'); return; }
    if (!plan.readyForReview || plan.issues.some((i) => i.severity === 'ERROR')) { setErrorNotice('The import contains validation errors and cannot be committed.'); return; }
    if (!window.confirm(`Commit the reviewed import for ${plan.fileName}? This will write approved records to Firestore.`)) return;
    setIsProcessing(true); setErrorNotice(null);
    try { setReport(await migrationService.commitImport(workbookData, plan, currentUser)); }
    catch (err: any) { setErrorNotice(`Import was not committed: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const errors = plan?.issues.filter((i) => i.severity === 'ERROR') || [];
  const warnings = plan?.issues.filter((i) => i.severity === 'WARNING') || [];

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5"><span className="p-2 rounded-xl bg-[#49BFAE]/10 border border-[#49BFAE]/20 text-[#49BFAE]"><Upload className="w-5 h-5" /></span>Business Data Import</h1>
        <p className="text-xs text-neutral-400 mt-1">Analyse → validate → review → explicitly approve → commit</p>
      </div>
      <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#123B5D] hover:bg-[#174b73] border border-[#24465F] rounded-xl cursor-pointer">
        <FileSpreadsheet className="w-4 h-4 text-[#49BFAE]" /> Upload Workbook
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
      </label>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {[['1','Analyse','Workbook is read locally; no writes'],['2','Validate','Mappings and relationships checked'],['3','Review','Administrator sees proposed changes'],['4','Commit','Only explicit approval writes data']].map(([n,t,d]) => <div key={n} className="rounded-xl border border-white/10 bg-[#131317] p-4"><div className="text-[#49BFAE] text-xs font-bold">STEP {n}</div><div className="text-white text-sm font-semibold mt-1">{t}</div><div className="text-neutral-500 text-[11px] mt-1">{d}</div></div>)}
    </div>

    {errorNotice && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{errorNotice}</div>}

    {isProcessing && <div className="p-4 rounded-xl bg-[#123B5D]/50 border border-[#24465F] text-[#b9d5e8] text-xs flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Processing import...</div>}

    {!plan && !report && <div className="rounded-2xl border border-dashed border-white/15 bg-[#131317] p-10 text-center"><Database className="w-10 h-10 mx-auto text-neutral-600" /><h2 className="text-sm font-semibold text-white mt-3">No workbook analysed</h2><p className="text-xs text-neutral-500 mt-1">Upload the STK workbook to begin a read-only analysis.</p></div>}

    {plan && <>
      <div className="rounded-2xl border border-white/10 bg-[#131317] p-5">
        <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] uppercase tracking-wider text-neutral-500">Workbook</div><div className="text-white font-semibold text-sm mt-1">{plan.fileName}</div></div><div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${errors.length ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>{errors.length ? `${errors.length} ERROR(S)` : 'READY FOR REVIEW'}</div></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          <Metric label="Sheets" value={plan.sheets.length} />
          <Metric label="Organisations" value={plan.organisations.length} />
          <Metric label="Contacts" value={plan.contacts.total} />
          <Metric label="Worklist" value={plan.engagements.total} />
          <Metric label="Opportunities" value={plan.opportunities.total} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#131317] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10"><h3 className="text-xs font-bold text-white">Worksheet analysis</h3></div>
        <div className="divide-y divide-white/5">{plan.sheets.map((sheet) => <div key={sheet.sheetName} className="px-5 py-3 flex items-center justify-between gap-4"><div><div className="text-xs text-white font-medium">{sheet.sheetName}</div><div className="text-[10px] text-neutral-500 mt-0.5">{sheet.rowCount} rows · {sheet.headers.length} columns</div></div><span className={`text-[10px] font-bold px-2 py-1 rounded-md ${sheet.type === 'UNKNOWN' ? 'text-neutral-500 bg-white/5' : 'text-[#49BFAE] bg-[#49BFAE]/10'}`}>{sheet.type === 'UNKNOWN' ? 'IGNORED' : sheet.type}</span></div>)}</div>
      </div>

      {(errors.length || warnings.length) > 0 && <div className="rounded-2xl border border-white/10 bg-[#131317] p-5"><div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-amber-400" /><h3 className="text-xs font-bold text-white">Validation findings</h3></div><div className="space-y-2 max-h-64 overflow-y-auto">{[...errors, ...warnings].slice(0,100).map((issue, i) => <div key={i} className={`text-[11px] p-2.5 rounded-lg border ${issue.severity === 'ERROR' ? 'text-rose-300 border-rose-500/15 bg-rose-500/5' : 'text-amber-300 border-amber-500/15 bg-amber-500/5'}`}><b>{issue.severity}</b> · {issue.sheet} row {issue.row}: {issue.message}</div>)}</div></div>}

      <div className="rounded-2xl border border-[#24465F] bg-[#123B5D]/30 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div className="flex gap-3"><ShieldCheck className="w-5 h-5 text-[#49BFAE] shrink-0" /><div><div className="text-sm font-semibold text-white">Administrator approval required</div><div className="text-[11px] text-neutral-400 mt-1">No Firestore writes have occurred during upload or analysis. Commit is available only when there are no validation errors.</div></div></div><button disabled={!!errors.length || !currentUser || currentUser.role !== 'ADMIN' || isProcessing} onClick={commit} className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0f766e] hover:bg-[#115e59] disabled:opacity-40 disabled:cursor-not-allowed">Review & Commit Import</button></div>
    </>}

    {report && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5"><div className="flex items-center gap-2 text-emerald-300 text-sm font-bold"><CheckCircle2 className="w-5 h-5" /> Import committed successfully</div><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4"><Metric label="Organisations" value={report.organisationsCreated} /><Metric label="Contacts" value={report.contactsCreated} /><Metric label="Engagements / Tasks" value={`${report.engagementsCreated} / ${report.tasksCreated}`} /><Metric label="Opportunities" value={report.opportunitiesCreated} /></div></div>}
  </div>;
};

const Metric: React.FC<{label: string; value: React.ReactNode}> = ({ label, value }) => <div className="rounded-xl bg-black/20 border border-white/5 p-3"><div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div><div className="text-lg font-bold text-white mt-1">{value}</div></div>;
