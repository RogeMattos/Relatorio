import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plane, Globe, Calendar, Wallet, RefreshCw } from 'lucide-react';
import { Trip, Currency } from '../types';
import { saveTrip } from '../services/storageService';
import { suggestCurrencyForCountry, getEstimatedExchangeRate } from '../services/geminiService';
import { useSettings } from '../contexts/SettingsContext';

// Safe ID generator that works in all environments (including HTTP)
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if randomUUID fails (e.g. insecure context)
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const TripWizard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useSettings();
  const [loadingCurrency, setLoadingCurrency] = useState(false);
  const [loadingRate, setLoadingRate] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isManualRate, setIsManualRate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Trip>>({
    id: generateUUID(),
    travelerName: 'Current User', // Default
    status: 'active',
    baseCurrency: Currency.USD,
    localCurrencySuggestion: '',
    initialExchangeRate: 1,
    advanceAmount: undefined, 
  });

  const handleChange = (field: keyof Trip, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCountryBlur = async () => {
    if (formData.destinationCountry) {
        setLoadingCurrency(true);
        const suggested = await suggestCurrencyForCountry(formData.destinationCountry);
        setFormData(prev => ({ ...prev, localCurrencySuggestion: suggested }));
        setLoadingCurrency(false);
    }
  }

  // Fetch exchange rate when currencies or date change
  useEffect(() => {
    const fetchRate = async () => {
        if (!formData.baseCurrency || !formData.localCurrencySuggestion) return;
        
        if (formData.baseCurrency === formData.localCurrencySuggestion) {
            setExchangeRate(1);
            setFormData(prev => ({ ...prev, initialExchangeRate: 1 }));
            return;
        }

        // If user manually set the rate, do not overwrite unless currencies changed substantially 
        if (isManualRate) return;

        setLoadingRate(true);
        const date = formData.startDate || new Date().toISOString().split('T')[0];
        const rate = await getEstimatedExchangeRate(
            formData.baseCurrency, 
            formData.localCurrencySuggestion as string, 
            date
        );
        setExchangeRate(rate);
        setFormData(prev => ({ ...prev, initialExchangeRate: rate }));
        setLoadingRate(false);
    };

    fetchRate();
  }, [formData.baseCurrency, formData.localCurrencySuggestion, formData.startDate]);

  const handleRateChange = (val: string) => {
      const rate = parseFloat(val);
      setExchangeRate(rate);
      setIsManualRate(true);
      setFormData(prev => ({ ...prev, initialExchangeRate: rate }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.tripName) {
      setIsSaving(true);
      const finalTrip = {
          ...formData,
          // Default to 0 if empty/undefined
          advanceAmount: formData.advanceAmount || 0 
      };
      try {
        await saveTrip(finalTrip as Trip);
        navigate(`/trip/${formData.id}`);
      } catch (error) {
          console.error("Failed to save trip", error);
          alert("Failed to create trip. Please try again.");
          setIsSaving(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 max-w-lg mx-auto transition-colors duration-300">
      <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6 text-blue-600 dark:text-blue-400">
          <Plane className="w-8 h-8" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('newTrip')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Traveler & Trip Name */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('travelerName')}</label>
              <input
                required
                type="text"
                value={formData.travelerName}
                onChange={e => handleChange('travelerName', e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tripName')}</label>
              <input
                required
                placeholder="e.g. Tokyo Product Launch"
                type="text"
                value={formData.tripName || ''}
                onChange={e => handleChange('tripName', e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Destination & Currency */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('destination')}</label>
              <div className="relative">
                <Globe className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                <input
                  required
                  type="text"
                  placeholder="e.g. Japan"
                  value={formData.destinationCountry || ''}
                  onChange={e => handleChange('destinationCountry', e.target.value)}
                  onBlur={handleCountryBlur}
                  className="w-full pl-10 p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              {loadingCurrency && <p className="text-xs text-blue-500 mt-1 animate-pulse">{t('detectingCurrency')}</p>}
              {formData.localCurrencySuggestion && !loadingCurrency && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {t('detectedCurrency')}: <strong>{formData.localCurrencySuggestion}</strong>
                </p>
              )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('startDate')}</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                    <input
                        required
                        type="date"
                        value={formData.startDate || ''}
                        onChange={e => handleChange('startDate', e.target.value)}
                        className="w-full pl-10 p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>
          </div>

          {/* Financials */}
          <div className="space-y-4 border-t dark:border-gray-700 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('baseCurrency')}</label>
                <select
                  value={formData.baseCurrency}
                  onChange={e => handleChange('baseCurrency', e.target.value)}
                  className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {Object.values(Currency).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('advance')} ({formData.baseCurrency})</label>
                <div className="relative">
                    <Wallet className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                    <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.advanceAmount || ''}
                    onChange={e => handleChange('advanceAmount', parseFloat(e.target.value))}
                    className="w-full pl-10 p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
              </div>
            </div>

            {/* Conversion Section */}
            {formData.localCurrencySuggestion && formData.baseCurrency !== formData.localCurrencySuggestion && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">{t('initialExchange')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                {t('rate')} {loadingRate && <RefreshCw className="w-3 h-3 animate-spin" />}
                            </label>
                            <div className="relative">
                                <span className="absolute left-2 top-2.5 text-gray-400 text-[10px] font-bold leading-none">
                                    {formData.baseCurrency} {'->'} <br/> {formData.localCurrencySuggestion}
                                </span>
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={exchangeRate}
                                    onChange={e => handleRateChange(e.target.value)}
                                    className="w-full pl-12 p-2 text-sm rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                {isManualRate ? t('manualOverride') : t('autoDetected')}
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                {t('totalIn')} {formData.localCurrencySuggestion}
                            </label>
                            <div className="w-full p-2 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white font-mono font-bold">
                                {new Intl.NumberFormat('en-US', { 
                                    style: 'currency', 
                                    currency: formData.localCurrencySuggestion as string 
                                }).format((formData.advanceAmount || 0) * exchangeRate)}
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold p-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><span className="mr-1">{t('startNewTrip')}</span> <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TripWizard;