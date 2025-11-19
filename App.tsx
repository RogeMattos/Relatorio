import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import TripList from './components/TripList';
import TripWizard from './components/TripWizard';
import TripDashboard from './components/TripDashboard';
import { SettingsProvider } from './contexts/SettingsContext';

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<TripList />} />
          <Route path="/new-trip" element={<TripWizard />} />
          <Route path="/trip/:id" element={<TripDashboard />} />
        </Routes>
      </HashRouter>
    </SettingsProvider>
  );
};

export default App;