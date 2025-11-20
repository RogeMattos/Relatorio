import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, Briefcase, Settings, Moon, Sun, Globe, X } from 'lucide-react';
import { Trip } from '../types';
import { getTrips, formatMoney } from '../services/storageService';
import { useSettings, Language } from '../contexts/SettingsContext';

const TripList: React.FC = () => {
  const navigate = useNavigate();
  const { t, theme, toggleTheme, language, setLanguage } = useSettings();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const fetchTrips = async () => {
        try {
            const data = await getTrips();
            setTrips(data);
        } catch (error) {
            console.error("Failed to load trips", error);
        } finally {
            setLoading(false);
        }
    };
    fetchTrips();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
      <div className="max-w-lg mx-auto space-y-6">
        
        <div className="flex justify-between items-center pt-4">
          <div>
             <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('myTrips')}</h1>
             <p className="text-gray-500 dark:text-gray-400 text-sm">{t('manageExpenses')}</p>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
             <div className="flex justify-center py-10">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
             </div>
        ) : trips.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-10 text-center shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
            <div className="bg-blue-50 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
               <Briefcase className="w-8 h-8 text-blue-500 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">{t('noTrips')}</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{t('noExpensesYet')}</p>
            <button 
                onClick={() => navigate('/new-trip')}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:bg-blue-700 transition"
            >
                {t('startNewTrip')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
             {trips.map(trip => (
                 <div 
                    key={trip.id} 
                    onClick={() => navigate(`/trip/${trip.id}`)}
                    className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition cursor-pointer flex justify-between items-center group"
                 >
                    <div>
                        <h3 className="font-bold text-gray-800 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{trip.tripName}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{trip.destinationCountry} • {trip.startDate}</p>
                        <span className="inline-block bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-md font-medium">
                            {t('budget')}: {formatMoney(trip.advanceAmount, trip.baseCurrency)}
                        </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500" />
                 </div>
             ))}
          </div>
        )}
        
        {!loading && trips.length > 0 && (
             <button 
                onClick={() => navigate('/new-trip')}
                className="fixed bottom-6 right-6 bg-gray-900 dark:bg-blue-600 text-white p-4 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all z-40"
            >
                <Plus className="w-6 h-6" />
            </button>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
           <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl animate-slide-up">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('settings')}</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                  <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
                        {theme === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                      </div>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{t('darkMode')}</span>
                   </div>
                   <button 
                    onClick={toggleTheme}
                    className={`w-12 h-7 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}`}
                   >
                     <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${theme === 'dark' ? 'left-6' : 'left-1'}`} />
                   </button>
                </div>

                {/* Language Selection */}
                <div>
                   <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
                        <Globe className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{t('language')}</span>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setLanguage('en')}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${language === 'en' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}
                      >
                        English (US)
                      </button>
                      <button 
                        onClick={() => setLanguage('pt')}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${language === 'pt' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}
                      >
                        Português (BR)
                      </button>
                   </div>
                </div>
              </div>
              
              <button 
                onClick={() => setShowSettings(false)}
                className="w-full mt-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('close')}
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default TripList;