/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from "react";
import { 
  UploadCloud, 
  FileText, 
  Download, 
  RefreshCcw, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Table as TableIcon,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Hash,
  Calendar,
  Zap,
  Plus,
  PieChart as PieChartIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend 
} from "recharts";
import { extractTransactions, convertToCSV, Transaction, StatementData } from "./services/geminiService";

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ total: 0, completed: 0, pending: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statementInfo, setStatementInfo] = useState<StatementData['accountInfo'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CATEGORY_COLORS: Record<string, string> = {
    'groceries': '#f97316', // orange-500
    'dining': '#eab308', // yellow-500
    'transport': '#3b82f6', // blue-500
    'salary': '#10b981', // emerald-500
    'bills': '#a855f7', // purple-500
    'rent': '#8b5cf6', // violet-500
    'entertainment': '#ec4899', // pink-500
    'health': '#ef4444', // red-500
    'shopping': '#64748b', // slate-500
    'misc': '#94a3b8', // slate-400
  };

  const chartData = useMemo(() => {
    if (transactions.length === 0) return [];
    
    // Only spending for the pie chart
    const spending = transactions.filter(t => t.amount < 0);
    const categoryMap: Record<string, number> = {};
    
    spending.forEach(t => {
      const cat = t.category.toLowerCase();
      categoryMap[cat] = (categoryMap[cat] || 0) + Math.abs(t.amount);
    });

    return Object.entries(categoryMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: parseFloat(value.toFixed(2))
    })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const stats = useMemo(() => {
    if (transactions.length === 0) return null;
    const debits = transactions.filter(t => t.amount < 0).reduce((acc, curr) => acc + curr.amount, 0);
    const credits = transactions.filter(t => t.amount > 0).reduce((acc, curr) => acc + curr.amount, 0);
    return { 
      debits: Math.abs(debits), 
      credits, 
      net: credits + debits,
      count: transactions.length 
    };
  }, [transactions]);

  const handleFiles = async (selectedFiles: FileList | File[]) => {
    if (!selectedFiles.length) return;
    
    const validFiles: File[] = [];
    const validTypes = ["application/pdf", "image/png", "image/jpeg"];

    for (let i = 0; i < selectedFiles.length; i++) {
        const f = selectedFiles[i];
        if (validTypes.includes(f.type)) {
            validFiles.push(f);
        }
    }

    if (validFiles.length === 0) {
      setError("Please upload valid PDF or Image files.");
      return;
    }

    setFiles(validFiles);
    setError(null);
    setTransactions([]);
    setStatementInfo(null);
    setIsProcessing(true);
    setProgress({ total: validFiles.length, completed: 0, pending: validFiles.length });

    try {
      const allTransactions: Transaction[] = [];
      let finalInfo: StatementData['accountInfo'] | null = null;
      
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        
        const fileData = await new Promise<{ base64Data: string; mimeType: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64Data = (e.target?.result as string).split(",")[1];
            resolve({ base64Data, mimeType: file.type });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // We process one by one to provide progress updates
        const result = await extractTransactions([fileData]);
        allTransactions.push(...result.transactions);
        if (!finalInfo && result.accountInfo) {
          finalInfo = result.accountInfo;
        }
        
        setProgress(prev => ({
          ...prev,
          completed: i + 1,
          pending: validFiles.length - (i + 1)
        }));
      }

      setTransactions(allTransactions);
      setStatementInfo(finalInfo);
    } catch (err: any) {
      setError(err.message || "Failed to process the statements. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const downloadCSV = () => {
    if (transactions.length === 0) return;
    const csv = convertToCSV(transactions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `statement_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryColor = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('salary') || c.includes('income')) return 'bg-emerald-100 text-emerald-700';
    if (c.includes('bills') || c.includes('rent') || c.includes('utilities')) return 'bg-purple-100 text-purple-700';
    if (c.includes('food') || c.includes('dining') || c.includes('groceries')) return 'bg-orange-100 text-orange-700';
    if (c.includes('transport') || c.includes('travel')) return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="h-screen w-full bg-[#F8FAFC] flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <TableIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-800">
            Statement<span className="text-blue-600">Lens</span>
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
              Gemini 2.0 Flash Vision Active
            </span>
          </div>
          <button 
            onClick={downloadCSV}
            disabled={transactions.length === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm
              ${transactions.length > 0 
                ? 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar / Input Panel */}
        <aside className="w-80 border-r border-slate-200 bg-slate-50/50 p-6 flex flex-col gap-8 overflow-y-auto">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Source Document</label>
            <div 
              className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center gap-3
                ${dragActive ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' : 'border-slate-200 bg-white hover:border-slate-300'}
                ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                multiple
                accept=".pdf,image/png,image/jpeg"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm transition-transform group-hover:scale-105">
                {isProcessing ? (
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                ) : files.length > 0 ? (
                  <div className="relative">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center ring-2 ring-white">
                      {files.length}
                    </span>
                  </div>
                ) : (
                  <UploadCloud className="w-6 h-6 text-slate-400" />
                )}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-700 truncate max-w-[200px]">
                  {files.length === 0 ? "Select Files" : files.length === 1 ? files[0].name : `${files.length} Files Selected`}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {files.length > 0 
                    ? `${(files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1)} MB Total` 
                    : "PDF, PNG, or JPEG"}
                </p>
              </div>
            </div>
            
            {!transactions.length && !isProcessing && (
              <p className="mt-3 text-[10px] text-slate-400 leading-relaxed text-center italic">
                Select multiple documents to analyze combined financial data.
              </p>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Extraction Settings</label>
            <div className="space-y-4">
              <div className="flex items-center justify-between group">
                <span className="text-sm text-slate-600 font-medium">Date Format</span>
                <span className="text-[10px] font-mono font-bold bg-slate-200 px-2 py-1 rounded text-slate-700 ring-1 ring-slate-300/50">YYYY-MM-DD</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Categorization</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded uppercase tracking-tighter">AI Enabled</span>
                </div>
              </div>
            </div>
          </div>

          {(transactions.length > 0 || isProcessing) && (
            <div className="mt-auto">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-blue-700 uppercase mb-2 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Processing Status
                </p>
                {isProcessing ? (
                  <div className="flex flex-col gap-2">
                    <div className="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="h-full w-1/2 bg-blue-500 rounded-full"
                      />
                    </div>
                    <p className="text-[10px] text-blue-600 italic leading-tight">Analyzing ledger entries via Flash 2.0...</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-blue-600 leading-tight">
                    {transactions.length} transactions identified. 
                    Structure verified against financial schemas.
                  </p>
                )}
              </div>
            </div>
          )}

          {!isProcessing && !transactions.length && (
             <div className="mt-auto p-4 bg-slate-100/50 rounded-xl border border-slate-200/50">
               <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                 <ShieldCheck className="w-3.5 h-3.5" />
                 Enterprise Security
               </p>
               <p className="text-[10px] text-slate-400 leading-relaxed italic">
                 Documents are processed transiently via Gemini Vision and never stored on local servers.
               </p>
             </div>
          )}
        </aside>

        {/* Main Workspace */}
        <section className="flex-1 bg-white flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
            {error ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-8"
              >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Extraction Failed</h3>
                <p className="text-slate-500 max-w-sm text-center mb-6">{error}</p>
                <button 
                  onClick={() => { setError(null); setFiles([]); }}
                  className="px-6 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors"
                >
                  Try Again
                </button>
              </motion.div>
            ) : transactions.length > 0 ? (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 flex flex-col gap-6 overflow-hidden p-6"
              >
                {/* Statement Info Header */}
                {statementInfo && (
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl flex flex-col md:flex-row gap-6 md:items-center justify-between">
                    <div className="flex gap-4 items-start">
                      <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700 shadow-inner">
                        <MapPin className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="flex flex-col">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Statement Address</p>
                        <p className="text-sm font-medium text-slate-200 leading-snug max-w-md">
                          {statementInfo.address || "No address found on document"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-8 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-8">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Hash className="w-3.5 h-3.5" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Account Number</p>
                        </div>
                        <p className="text-sm font-bold text-slate-200 font-mono tracking-tight">{statementInfo.accountNumber || "N/A"}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Period</p>
                        </div>
                        <p className="text-sm font-bold text-slate-200 font-mono tracking-tight">{statementInfo.period || "All Dates"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary Dashboard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 leading-none">Total Records</p>
                    <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight">{stats?.count}</p>
                  </div>
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 leading-none text-emerald-600/70">Total Income</p>
                    <p className="text-2xl font-bold text-emerald-600 font-mono tracking-tight">
                      +${stats?.credits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 leading-none text-rose-600/70">Total Spending</p>
                    <p className="text-2xl font-bold text-rose-600 font-mono tracking-tight">
                      -${stats?.debits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className={`border p-5 rounded-2xl shadow-sm ${stats && stats.net >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 leading-none ${stats && stats.net >= 0 ? 'text-emerald-700/60' : 'text-rose-700/60'}`}>Net Position</p>
                    <p className={`text-2xl font-bold font-mono tracking-tight ${stats && stats.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {stats && stats.net >= 0 ? '+' : ''}${stats?.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Charts & Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-3xl shadow-xl shadow-black/[0.02]">
                    <div className="flex items-center gap-2 mb-6">
                      <PieChartIcon className="w-5 h-5 text-slate-400" />
                      <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[11px]">Spending by Category</h3>
                    </div>
                    <div className="h-64 w-full">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name.toLowerCase()] || '#cbd5e1'} />
                              ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Spending']}
                            />
                            <Legend 
                              verticalAlign="middle" 
                              align="right" 
                              layout="vertical"
                              iconType="circle"
                              wrapperStyle={{ paddingLeft: '20px', fontSize: '12px', fontWeight: '500' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                          No spending data to visualize
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xl shadow-black/[0.02]">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-5 h-5 text-amber-500" />
                      <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[11px]">Top Merchants</h3>
                    </div>
                    <div className="space-y-4">
                      {transactions
                        .filter(t => t.amount < 0)
                        .sort((a, b) => a.amount - b.amount)
                        .slice(0, 5)
                        .map((t, i) => (
                          <div key={i} className="flex items-center justify-between group">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-bold text-slate-700 truncate max-w-[140px]">{t.description}</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{t.category}</span>
                            </div>
                            <span className="text-xs font-bold text-rose-600 font-mono tracking-tight group-hover:scale-105 transition-transform">
                               -${Math.abs(t.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      {transactions.filter(t => t.amount < 0).length === 0 && (
                        <p className="text-xs text-slate-400 italic py-4 text-center">No spending recorded</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl shadow-black/[0.02] flex flex-col flex-1">
                  <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="sticky top-0 bg-slate-100/80 backdrop-blur-md border-b border-slate-200 z-10">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] w-36">Date</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">Description</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] text-right w-32">Amount</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] w-40">Category</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {transactions.map((t, i) => (
                          <motion.tr 
                            key={i}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.015 }}
                            className="hover:bg-slate-50 transition-colors group"
                          >
                            <td className="px-6 py-4 text-xs font-mono text-slate-600 tracking-tight whitespace-nowrap">{t.date}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                                  {t.description}
                                </span>
                              </div>
                            </td>
                            <td className={`px-6 py-4 text-sm font-mono text-right font-bold tabular-nums whitespace-nowrap ${t.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider ${getCategoryColor(t.category)} shadow-sm ring-1 ring-inset ring-black/5`}>
                                {t.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-[11px] text-slate-400 italic max-w-xs truncate" title={t.notes}>
                              {t.notes || "—"}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="shrink-0 border-t border-slate-200 px-6 py-4 bg-slate-50/80 backdrop-blur-sm flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-none">
                    <div className="flex gap-8">
                      <span>
                        Total Debits: <span className="text-rose-600 font-mono ml-1">{stats?.debits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </span>
                      <span>
                        Total Credits: <span className="text-emerald-600 font-mono ml-1">{stats?.credits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>Parsing Complete • {transactions.length} Rows</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : isProcessing ? (
               <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center p-12 text-center"
               >
                  <div className="relative mb-8">
                    <div className="w-32 h-32 border-4 border-slate-100 rounded-full flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-slate-900 leading-none">
                          {Math.round((progress.completed / progress.total) * 100)}%
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Extracted</p>
                      </div>
                    </div>
                    <svg className="absolute top-0 left-0 w-32 h-32 -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="60"
                        fill="transparent"
                        stroke="#E2E8F0"
                        strokeWidth="8"
                      />
                      <motion.circle
                        cx="64"
                        cy="64"
                        r="60"
                        fill="transparent"
                        stroke="#3B82F6"
                        strokeWidth="8"
                        strokeDasharray="377"
                        animate={{ strokeDashoffset: 377 - (377 * (progress.completed / progress.total)) }}
                        transition={{ type: "spring", bounce: 0, duration: 1 }}
                      />
                    </svg>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-6 tracking-tight">Processing Statement Batch</h3>
                  
                  <div className="grid grid-cols-3 gap-8 max-w-sm w-full mx-auto">
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900 leading-none mb-1">{progress.total}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-600 leading-none mb-1">{progress.completed}</p>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Done</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-amber-600 leading-none mb-1">{progress.pending}</p>
                      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Wait</p>
                    </div>
                  </div>

                  <p className="mt-10 text-slate-400 text-sm italic max-w-xs mx-auto">
                    {progress.completed === progress.total 
                      ? "Finalizing extraction..." 
                      : `Extracting file ${progress.completed + 1} of ${progress.total}...`}
                  </p>
               </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="w-24 h-24 bg-slate-50 border border-slate-200 rounded-3xl flex items-center justify-center mb-8 rotate-3 shadow-sm">
                  <TableIcon className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">No Document Loaded</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-10 leading-relaxed">
                  Upload a bank statement in PDF or image format. We'll automatically identify the date, description, amount, and category for every transaction.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl w-full">
                  {[
                    { label: "Precision OCR", desc: "Line-by-line extraction" },
                    { label: "Auto-Lookup", desc: "Categorized by merchant" },
                    { label: "Bulk PDF Support", desc: "Multiple pages extracted" }
                  ].map((f, i) => (
                    <div key={i} className="p-5 bg-white border border-slate-100 rounded-2xl flex flex-col items-center gap-2 shadow-[0_2px_4px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-1">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{f.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-12 flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  Upload Statement
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
