import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, RefreshCw, Check, Upload } from 'lucide-react';
import { Expense, ExpenseCategory, PaymentMethod, Currency, Trip } from '../types';
import { analyzeReceipt, getEstimatedExchangeRate } from '../services/geminiService';
import { useSettings } from '../contexts/SettingsContext';

interface ExpenseFormProps {
  trip: Trip;
  existingExpense?: Expense;
  onClose: () => void;
  onSave: (expense: Expense) => void;
}

// Safe ID generator
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const ExpenseForm: React.FC<ExpenseFormProps> = ({ trip, existingExpense, onClose, onSave }) => {
  const { t } = useSettings();
  const [isScanning, setIsScanning] = useState(false);
  const [loadingRate, setLoadingRate] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Expense>>({
    id: existingExpense?.id || generateUUID(),
    tripId: trip.id,
    date: existingExpense?.date || new Date().toISOString().split('T')[0],
    category: existingExpense?.category || ExpenseCategory.MEAL,
    merchant: existingExpense?.merchant || '',
    amountOriginal: existingExpense?.amountOriginal || 0,
    currencyOriginal: existingExpense?.currencyOriginal || trip.localCurrencySuggestion || Currency.USD,
    exchangeRate: existingExpense?.exchangeRate || 1,
    paymentMethod: existingExpense?.paymentMethod || PaymentMethod.CORPORATE_CARD,
    receiptImage: existingExpense?.receiptImage || '',
    isVerified: existingExpense?.isVerified || false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Utility to resize image to prevent huge payload to Gemini
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024;
                const MAX_HEIGHT = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    // Compress to JPEG 0.7 quality
                    resolve(canvas.toDataURL('image/jpeg', 0.7)); 
                } else {
                    reject(new Error("Canvas context failed"));
                }
            };
            img.src = event.target?.result as string;
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
  };

  // Fetch rate when date or currency changes
  const updateRate = async (currency: string, date: string) => {
    if (currency === trip.baseCurrency) {
        setFormData(prev => ({ ...prev, exchangeRate: 1 }));
        return;
    }
    
    setLoadingRate(true);
    const rate = await getEstimatedExchangeRate(currency, trip.baseCurrency, date);
    setFormData(prev => ({ ...prev, exchangeRate: rate }));
    setLoadingRate(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    
    try {
        // 0. Resize image first!
        const resizedBase64 = await resizeImage(file);

        // 1. Analyze with Gemini
        const ocrResult = await analyzeReceipt(resizedBase64);
        
        // 2. Update form data
        setFormData(prev => ({
            ...prev,
            receiptImage: resizedBase64, // Store the smaller image
            date: ocrResult.date || prev.date,
            merchant: ocrResult.merchant || t('unknownMerchant'),
            amountOriginal: ocrResult.amount || 0,
            currencyOriginal: ocrResult.currency || prev.currencyOriginal,
            category: ocrResult.category || prev.category,
            isVerified: true
        }));

        // 3. Trigger rate update if currency/date changed
        if (ocrResult.currency || ocrResult.date) {
             await updateRate(
                ocrResult.currency || formData.currencyOriginal as string, 
                ocrResult.date || formData.date as string
            );
        }

    } catch (error: any) {
        console.error(error);
        // Show specific error message (like quota exceeded)
        alert(error.message || "Could not analyze receipt. Please enter details manually.");
    } finally {
        setIsScanning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountBase = (formData.amountOriginal || 0) * (formData.exchangeRate || 1);
    onSave({
        ...formData,
        amountBase
    } as Expense);
  };

  const triggerCamera = () => {
      fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up transition-colors duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {existingExpense ? t('editExpense') : t('newExpense')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* OCR Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-xl p-6 text-center transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/30">
            <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden" 
            />
            
            {isScanning ? (
              <div className="flex flex-col items-center text-blue-600 dark:text-blue-400">
                <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                <span className="font-medium">{t('aiAnalyzing')}</span>
              </div>
            ) : formData.receiptImage ? (
               <div className="relative group">
                   <img src={formData.receiptImage} alt="Receipt" className="h-40 mx-auto rounded-lg shadow-sm object-cover" />
                   <button 
                    type="button"
                    onClick={triggerCamera}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-lg font-medium"
                   >
                       {t('retake')}
                   </button>
               </div>
            ) : (
               <button type="button" onClick={triggerCamera} className="w-full flex flex-col items-center gap-2 text-blue-600 dark:text-blue-400">
                 <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full">
                    <Camera className="w-8 h-8" />
                 </div>
                 <span className="font-semibold">{t('scanReceipt')}</span>
                 <span className="text-xs text-gray-500 dark:text-gray-400">{t('orUpload')}</span>
               </button>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">{t('date')}</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => {
                    setFormData(p => ({...p, date: e.target.value}));
                    updateRate(formData.currencyOriginal as string, e.target.value);
                }}
                className="input-field"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
                <label className="label">{t('category')}</label>
                <select 
                    value={formData.category}
                    onChange={e => setFormData(p => ({...p, category: e.target.value as ExpenseCategory}))}
                    className="input-field"
                >
                    {Object.values(ExpenseCategory).map(c => <option key={c} value={c}>{t(c)}</option>)}
                </select>
            </div>

            <div className="col-span-2">
                <label className="label">{t('merchant')}</label>
                <input 
                    type="text" 
                    required
                    value={formData.merchant}
                    onChange={e => setFormData(p => ({...p, merchant: e.target.value}))}
                    placeholder="e.g. Starbucks"
                    className="input-field"
                />
            </div>

            <div className="col-span-1">
                <label className="label">{t('amount')}</label>
                <input 
                    type="number" 
                    required
                    step="0.01"
                    value={formData.amountOriginal}
                    onChange={e => setFormData(p => ({...p, amountOriginal: parseFloat(e.target.value)}))}
                    className="input-field"
                />
            </div>
            <div className="col-span-1">
                <label className="label">{t('currency')}</label>
                <div className="flex items-center gap-1">
                    <input 
                        type="text" 
                        value={formData.currencyOriginal}
                        onChange={e => setFormData(p => ({...p, currencyOriginal: e.target.value.toUpperCase()}))}
                        onBlur={() => updateRate(formData.currencyOriginal as string, formData.date as string)}
                        className="input-field uppercase"
                        placeholder="USD"
                    />
                </div>
            </div>

            <div className="col-span-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('conversion')} ({trip.baseCurrency})</label>
                    <button 
                        type="button" 
                        onClick={() => updateRate(formData.currencyOriginal as string, formData.date as string)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                       {loadingRate ? <RefreshCw className="w-3 h-3 animate-spin" /> : null} {t('updateRate')}
                    </button>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('rate')}:</span>
                    <input 
                        type="number"
                        step="0.000001"
                        value={formData.exchangeRate}
                        onChange={e => setFormData(p => ({...p, exchangeRate: parseFloat(e.target.value)}))}
                        className="w-20 p-1 text-sm border rounded text-center dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    />
                    <span className="flex-1 text-right font-mono font-bold text-gray-700 dark:text-white">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: trip.baseCurrency }).format((formData.amountOriginal || 0) * (formData.exchangeRate || 1))}
                    </span>
                </div>
            </div>
            
             <div className="col-span-2">
                <label className="label">{t('paymentMethod')}</label>
                <select 
                    value={formData.paymentMethod}
                    onChange={e => setFormData(p => ({...p, paymentMethod: e.target.value as PaymentMethod}))}
                    className="input-field"
                >
                    {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{t(m)}</option>)}
                </select>
            </div>
          </div>

          {/* Sticky Action */}
          <button 
            type="submit" 
            className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex justify-center items-center gap-2"
          >
              <Check className="w-6 h-6" /> {t('saveExpense')}
          </button>
        </form>
      </div>
      
      {/* Styles */}
      <style>{`
        .label { @apply block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide; }
        .input-field { @apply w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow; }
        @keyframes slide-up {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ExpenseForm;