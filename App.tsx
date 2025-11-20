import React from 'react';
import Header from './components/Header';
import { BetTrackerProvider } from './context/BetTrackerContext';
import Dashboard from './components/dashboard/Dashboard';

const App: React.FC = () => (
    <BetTrackerProvider>
        <div className="min-h-screen bg-savant-deep font-sans pb-12">
            <Header />
            <Dashboard />
        </div>
    </BetTrackerProvider>
);

export default App;
