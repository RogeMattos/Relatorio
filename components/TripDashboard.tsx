import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
    Plus, ArrowLeft, FileText, DollarSign, 
    CreditCard, Calendar, Trash2, Download, Lock, Unlock, CheckCircle, Edit2, Check, X
} from 'lucide-react';

import { Trip, Expense, Currency, ExpenseCategory } from '../types';
import { getTrips, getExpenses, saveExpense, formatMoney, deleteExpense, saveTrip } from '../services/storageService';
import ExpenseForm from './ExpenseForm';
import { useSettings } from '../contexts/SettingsContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

const TripDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useSettings();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // Manual Rate Editing State
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState<number>(1);

  useEffect(() => {
    const loadData = async () => {
        if (!id) return;
        try {
            const trips = await getTrips();
            const found = trips.find(t => t.id === id);
            if (!found) {
                navigate('/');
                return;
            }
            setTrip(found);
            setTempRate(found.initialExchangeRate || 1);
            
            const expData = await getExpenses(id);
            setExpenses(expData);
        } catch (err) {
            console.error("Failed to load trip data", err);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [id, navigate]);

  const refreshExpenses = async () => {
      if (id) {
          const data = await getExpenses(id);
          setExpenses(data);
      }
  };

  const handleSaveExpense = async (expense: Expense) => {
      await saveExpense(expense);
      await refreshExpenses();
      setShowModal(false);
      setEditingExpense(undefined);
  };
  
  const handleDelete = async (eId: string) => {
      if(window.confirm(t('deleteConfirm'))) {
          await deleteExpense(eId);
          await refreshExpenses();
      }
  }

  const handleToggleTripStatus = async () => {
      if (!trip) return;
      const newStatus: 'active' | 'closed' = trip.status === 'active' ? 'closed' : 'active';
      const updatedTrip = { ...trip, status: newStatus };
      await saveTrip(updatedTrip);
      setTrip(updatedTrip);
      setShowCloseConfirm(false);
  };

  const handleSaveRate = async () => {
      if (!trip) return;
      const updatedTrip = { ...trip, initialExchangeRate: tempRate };
      await saveTrip(updatedTrip);
      setTrip(updatedTrip);
      setIsEditingRate(false);
  };

  // Calculations
  const totalSpent = useMemo(() => expenses.reduce((acc, curr) => acc + curr.amountBase, 0), [expenses]);
  const balance = (trip?.advanceAmount || 0) - totalSpent;
  const isOverBudget = balance < 0;
  
  // Calculate Balance in Local Currency
  const balanceLocal = balance * (trip?.initialExchangeRate || 1);

  // Chart Data
  const chartData = useMemo(() => {
      const groups: {[key: string]: number} = {};
      expenses.forEach(e => {
          groups[e.category] = (groups[e.category] || 0) + e.amountBase;
      });
      return Object.keys(groups).map(k => ({ name: k, value: groups[k] }));
  }, [expenses]);

  const handlePrint = () => {
      window.print();
  };

  const handleExportCSV = () => {
      if (!trip) return;

      const escape = (value: string | number | undefined | null) => {
          if (value === undefined || value === null) return '""';
          const stringValue = String(value);
          return `"${stringValue.replace(/"/g, '""')}"`;
      };

      const formatDecimal = (num: number) => {
          return `"${num.toFixed(2).replace('.', ',')}"`;
      };
      const formatRate = (num: number) => {
          return `"${num.toFixed(6).replace('.', ',')}"`;
      };

      const metadata = [
          [t('tripName'), trip.tripName],
          [t('travelerName'), trip.travelerName],
          [t('destination'), trip.destinationCountry],
          [t('startDate'), trip.startDate],
          [t('status'), t(trip.status)],
          [t('budget'), formatDecimal(trip.advanceAmount)],
          [t('spent'), formatDecimal(totalSpent)],
          [t('settlement'), formatDecimal(balance)]
      ];

      const metadataRows = metadata.map(row => row.map(escape).join(';')).join('\n');

      const headers = [
          t('date'),
          t('category'),
          t('merchant'),
          `${t('amount')} (Original)`,
          t('currency'),
          t('rate'),
          `${t('amount')} (${trip.baseCurrency})`,
          t('paymentMethod'),
          "Notes"
      ];
      const headerRow = headers.map(escape).join(';');

      const expenseRows = expenses.map(e => [
          escape(e.date),
          escape(t(e.category)),
          escape(e.merchant),
          formatDecimal(e.amountOriginal),
          escape(e.currencyOriginal),
          formatRate(e.exchangeRate),
          formatDecimal(e.amountBase),
          escape(t(e.paymentMethod)),
          escape(e.notes || '')
      ].join(';')).join('\n');

      const csvContent = `sep=;\n\uFEFF${metadataRows}\n\n${headerRow}\n${expenseRows}`;
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${trip.tripName.replace(/[^a-z0-9]/gi, '_')}_Report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  if (loading || !trip) return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
  );

  return (
    <div className="min-h-screen pb-24 bg-gray-50 dark:bg-gray-900 transition-colors duration-300 print:pb-0 print:bg-white print:h-auto print:overflow-visible">
        {/* Top Navigation */}
        <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-30 px-4 py-3 flex justify-between items-center no-print transition-colors shadow-sm">
            <div className="flex items-center gap-2">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex flex-col">
                     <h1 className="font-semibold text-lg text-gray-900 dark:text-white truncate max-w-[150px] sm:max-w-xs">{trip.tripName}</h1>
                     {trip.status === 'closed' && (
                         <span className="text-[10px] font-bold uppercase text-red-500 dark:text-red-400 flex items-center gap-1">
                             <Lock className="w-3 h-3" /> {t('closed')}
                         </span>
                     )}
                </div>
            </div>
            
            <div className="flex gap-1 sm:gap-2">
                 <button 
                    onClick={() => setShowCloseConfirm(true)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                        trip.status === 'closed' 
                        ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-white' 
                        : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}
                 >
                    {trip.status === 'active' ? (
                        <><CheckCircle className="w-4 h-4" /> <span className="hidden sm:inline">{t('closeTrip')}</span></>
                    ) : (
                        <><Unlock className="w-4 h-4" /> <span className="hidden sm:inline">{t('reopenTrip')}</span></>
                    )}
                 </button>
                <button onClick={handlePrint} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300" title={t('printPDF')}>
                    <FileText className="w-6 h-6" />
                </button>
                 <button onClick={handleExportCSV} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300" title={t('exportCSV')}>
                    <Download className="w-6 h-6" />
                </button>
            </div>
        </div>

        <main className="max-w-3xl mx-auto p-4 space-y-6 print:p-0 print:max-w-none">
            
            {/* Report Header (Print Only) */}
            <div className="hidden print:block mb-8 border-b pb-4 text-black">
                <h1 className="text-3xl font-bold mb-2">{t('report')} - {trip.status === 'closed' ? t('closed') : t('active')}</h1>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-800">
                    <p><strong>{t('trip')}:</strong> {trip.tripName}</p>
                    <p><strong>{t('traveler')}:</strong> {trip.travelerName}</p>
                    <p><strong>{t('dates')}:</strong> {trip.startDate} - Current</p>
                    <p><strong>{t('generated')}:</strong> {new Date().toLocaleDateString()}</p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
                    <div>
                         <p className="text-xs font-bold uppercase text-gray-500">{t('budget')}</p>
                         <p className="text-xl font-bold">{formatMoney(trip.advanceAmount, trip.baseCurrency)}</p>
                    </div>
                    <div>
                         <p className="text-xs font-bold uppercase text-gray-500">{t('spent')}</p>
                         <p className="text-xl font-bold text-blue-600">{formatMoney(totalSpent, trip.baseCurrency)}</p>
                    </div>
                    <div>
                         <p className="text-xs font-bold uppercase text-gray-500">{t('settlement')}</p>
                         <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(Math.abs(balance), trip.baseCurrency)} <span className="text-xs font-normal text-gray-500">({balance >= 0 ? t('toReturn') : t('toReimburse')})</span></p>
                    </div>
                </div>
            </div>

            {/* KPI Cards - Hidden on Print */}
            <div className="grid grid-cols-3 gap-3 print:hidden">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center group relative transition-colors">
                    <span className="text-xs text-gray-400 uppercase font-bold mb-1">{t('budget')}</span>
                    <span className="text-gray-800 dark:text-white font-bold text-sm sm:text-lg truncate w-full">
                        {formatMoney(trip.advanceAmount, trip.baseCurrency)}
                    </span>
                     {/* Converted Advance Display with Edit Option */}
                    {trip.baseCurrency !== trip.localCurrencySuggestion && (
                        <div className="mt-1 flex flex-col items-center">
                             {isEditingRate ? (
                                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded p-1">
                                     <input 
                                        type="number" 
                                        step="0.0001"
                                        value={tempRate}
                                        onChange={e => setTempRate(parseFloat(e.target.value))}
                                        className="w-16 text-xs bg-transparent border-b border-blue-500 text-center outline-none text-gray-800 dark:text-white"
                                        autoFocus
                                     />
                                     <button onClick={handleSaveRate} className="text-green-600 dark:text-green-400"><Check className="w-3 h-3" /></button>
                                     <button onClick={() => { setIsEditingRate(false); setTempRate(trip.initialExchangeRate); }} className="text-red-500"><X className="w-3 h-3" /></button>
                                </div>
                             ) : (
                                <div className="flex items-center gap-1 group cursor-pointer" onClick={() => setIsEditingRate(true)}>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded-full border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all">
                                        ≈ {new Intl.NumberFormat('en-US', { style: 'currency', currency: trip.localCurrencySuggestion as string, maximumFractionDigits: 0 }).format(trip.advanceAmount * (trip.initialExchangeRate || 1))}
                                    </span>
                                    {trip.status === 'active' && (
                                        <Edit2 className="w-3 h-3 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </div>
                             )}
                             {!isEditingRate && (
                                 <span className="text-[9px] text-gray-400 mt-0.5">{t('rate')}: {trip.initialExchangeRate}</span>
                             )}
                        </div>
                    )}
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center transition-colors">
                    <span className="text-xs text-gray-400 uppercase font-bold mb-1">{t('spent')}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-sm sm:text-lg truncate w-full">
                        {formatMoney(totalSpent, trip.baseCurrency)}
                    </span>
                </div>
                <div className={`p-4 rounded-xl shadow-sm border flex flex-col items-center text-center transition-colors ${isOverBudget ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50' : 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/50'}`}>
                    <span className={`text-xs uppercase font-bold mb-1 ${isOverBudget ? 'text-red-400' : 'text-green-500'}`}>{t('available')}</span>
                    <span className={`font-bold text-sm sm:text-lg truncate w-full ${isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                         {formatMoney(balance, trip.baseCurrency)}
                    </span>
                    {/* Converted Remaining Balance */}
                    {trip.baseCurrency !== trip.localCurrencySuggestion && (
                        <span className={`text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-full ${isOverBudget ? 'text-red-500 dark:text-red-300 bg-red-100/50 dark:bg-red-900/40' : 'text-green-600 dark:text-green-300 bg-green-100/50 dark:bg-green-900/40'}`}>
                            ≈ {new Intl.NumberFormat('en-US', { style: 'currency', currency: trip.localCurrencySuggestion as string, maximumFractionDigits: 0 }).format(balanceLocal)}
                        </span>
                    )}
                </div>
            </div>

            {/* Chart Section - Hidden on Print */}
            {expenses.length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 print:hidden transition-colors">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4">{t('expensesByCategory')}</h3>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={chartData} 
                                    innerRadius={40} 
                                    outerRadius={70} 
                                    paddingAngle={5} 
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(val: number) => formatMoney(val, trip.baseCurrency)} 
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '0.5rem' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center mt-2">
                        {chartData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                {t(entry.name)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Expenses List */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase pl-2 print:hidden">{t('transactions')}</h3>
                {expenses.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-dashed dark:border-gray-700 transition-colors print:border-gray-300">
                        <p>{t('noExpensesYet')}</p>
                    </div>
                ) : (
                    <>
                        {/* Screen View (Interactable) */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y dark:divide-gray-700 transition-colors print:hidden">
                            {expenses.map((expense) => (
                                <div 
                                    key={expense.id} 
                                    onClick={() => { 
                                        if (trip.status === 'active') {
                                            setEditingExpense(expense); 
                                            setShowModal(true); 
                                        }
                                    }}
                                    className={`p-4 flex justify-between items-center transition ${trip.status === 'active' ? 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer' : 'opacity-80'}`}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                            {getCategoryIcon(expense.category)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-gray-900 dark:text-white truncate">{expense.merchant}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span>{expense.date}</span>
                                                <span>•</span>
                                                <span>{t(expense.category)}</span>
                                                {expense.isVerified && <span className="text-green-600 dark:text-green-400 font-bold ml-1" title="Verified by AI">✓ AI</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-bold text-gray-900 dark:text-white">{formatMoney(expense.amountBase, trip.baseCurrency)}</p>
                                        {expense.currencyOriginal !== trip.baseCurrency && (
                                            <p className="text-xs text-gray-400">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: expense.currencyOriginal as string }).format(expense.amountOriginal)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

<<<<<<< HEAD
                        {/* PRINT VIEW: Detailed Card List with Images */}
                        <div className="hidden print:flex flex-col space-y-4">
                            {expenses.map(e => (
                                <div key={e.id} className="border border-gray-300 rounded-lg p-4 flex break-inside-avoid page-break-inside-avoid">
                                    {/* Left: Details */}
                                    <div className="flex-1 pr-4">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-bold text-lg">{e.merchant}</span>
                                            <span className="font-bold text-lg">{formatMoney(e.amountBase, trip.baseCurrency)}</span>
                                        </div>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <p><strong>{t('date')}:</strong> {e.date}</p>
                                            <p><strong>{t('category')}:</strong> {t(e.category)}</p>
                                            <p><strong>Original:</strong> {e.amountOriginal} {e.currencyOriginal} (Rate: {e.exchangeRate})</p>
                                            <p><strong>Method:</strong> {t(e.paymentMethod)}</p>
                                            {e.notes && <p><strong>Notes:</strong> {e.notes}</p>}
                                        </div>
                                    </div>
                                    
                                    {/* Right: Receipt Image */}
                                    <div className="w-1/3 flex items-center justify-center border-l pl-4 border-gray-200">
                                        {e.receiptImage ? (
                                            <img 
                                                src={e.receiptImage} 
                                                alt="Receipt" 
                                                className="max-h-40 object-contain max-w-full" 
                                            />
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">No Receipt</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
=======
                        {/* Print-only Table - Enhanced for PDF */}
                        <table className="hidden print:table w-full text-left text-sm mt-4 border-collapse text-black">
                            <thead>
                                <tr className="border-b-2 border-black">
                                    <th className="py-2">{t('date')}</th>
                                    <th className="py-2">{t('merchant')}</th>
                                    <th className="py-2">{t('category')}</th>
                                    <th className="py-2 text-right">Original</th>
                                    <th className="py-2 text-right">Rate</th>
                                    <th className="py-2 text-right">Total ({trip.baseCurrency})</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map(e => (
                                    <tr key={e.id} className="border-b border-gray-300">
                                        <td className="py-2">{e.date}</td>
                                        <td className="py-2">{e.merchant}</td>
                                        <td className="py-2">{t(e.category)}</td>
                                        <td className="py-2 text-right">{e.amountOriginal} {e.currencyOriginal}</td>
                                        <td className="py-2 text-right">{e.exchangeRate.toFixed(4)}</td>
                                        <td className="py-2 text-right font-medium">{formatMoney(e.amountBase, trip.baseCurrency)}</td>
                                    </tr>
                                ))}
                                <tr className="font-bold border-t-2 border-black bg-gray-50">
                                    <td colSpan={5} className="py-3 text-right pr-4">{t('total')}</td>
                                    <td className="py-3 text-right">{formatMoney(totalSpent, trip.baseCurrency)}</td>
                                </tr>
                                {/* Settlement Section on Print */}
                                <tr className="font-bold">
                                    <td colSpan={5} className="py-2 text-right pr-4">{t('budget')}</td>
                                    <td className="py-2 text-right">{formatMoney(trip.advanceAmount, trip.baseCurrency)}</td>
                                </tr>
                                <tr className="font-bold text-lg">
                                    <td colSpan={5} className="py-3 text-right pr-4 border-t border-gray-300">
                                        {t('settlement')} ({balance >= 0 ? t('toReturn') : t('toReimburse')})
                                    </td>
                                    <td className="py-3 text-right border-t border-gray-300">{formatMoney(Math.abs(balance), trip.baseCurrency)}</td>
                                </tr>
                            </tbody>
                        </table>
>>>>>>> parent of 0b30466 (Fotos no PDF)
                    </>
                )}
            </div>

            {/* Floating Add Button (Hidden on Print or if Closed) */}
            {trip.status === 'active' && (
                <button 
                    onClick={() => { setEditingExpense(undefined); setShowModal(true); }}
                    className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition-transform hover:scale-105 active:scale-95 no-print z-40"
                >
                    <Plus className="w-8 h-8" />
                </button>
            )}
        </main>

        {/* Expense Modal */}
        {showModal && (
            <ExpenseForm 
                trip={trip}
                existingExpense={editingExpense}
                onClose={() => setShowModal(false)}
                onSave={handleSaveExpense}
            />
        )}

        {/* Edit Modal Delete Option */}
        {editingExpense && showModal && (
             <div className="fixed z-[60] bottom-6 left-6 no-print">
                 <button 
                    onClick={() => { setShowModal(false); handleDelete(editingExpense.id); }}
                    className="bg-red-100 text-red-600 p-3 rounded-full shadow hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
                 >
                     <Trash2 className="w-5 h-5" />
                 </button>
             </div>
        )}

        {/* Close Trip Confirmation Modal */}
        {showCloseConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print animate-fade-in">
                <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        {trip.status === 'active' ? t('confirmClose') : t('reopenTrip')}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        {trip.status === 'active' ? t('closeTripDesc') : ""}
                    </p>

                    {trip.status === 'active' && (
                        <div className={`p-4 rounded-xl border mb-6 ${balance >= 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900'}`}>
                            <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">
                                {balance === 0 ? t('balanced') : (balance > 0 ? t('toReturn') : t('toReimburse'))}
                            </p>
                            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                {formatMoney(Math.abs(balance), trip.baseCurrency)}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowCloseConfirm(false)}
                            className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            {t('close')}
                        </button>
                        <button 
                            onClick={handleToggleTripStatus}
                            className={`flex-1 py-3 text-white font-semibold rounded-xl shadow-lg transition-all ${trip.status === 'active' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {trip.status === 'active' ? t('closeTrip') : t('reopenTrip')}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

// Icon helper
const getCategoryIcon = (cat: ExpenseCategory) => {
    switch (cat) {
        case ExpenseCategory.MEAL: return <span className="text-lg">🍔</span>;
        case ExpenseCategory.TRANSPORT: return <span className="text-lg">🚕</span>;
        case ExpenseCategory.FLIGHT: return <span className="text-lg">✈️</span>;
        case ExpenseCategory.LODGING: return <span className="text-lg">🏨</span>;
        default: return <span className="text-lg">📄</span>;
    }
};

export default TripDashboard;