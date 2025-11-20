
import React from 'react';
import Card from '../ui/Card';

interface ControlPanelProps {
    selectedDate: string;
    onDateChange: (date: string) => void;
    unitSize: number;
    onUnitSizeChange: (size: number) => void;
    onTuneModel: () => void;
    onCalibrate: () => void;
    isCalibrating: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
    selectedDate,
    onDateChange,
    unitSize,
    onUnitSizeChange,
    onTuneModel,
    onCalibrate,
    isCalibrating
}) => {
    return (
        <Card>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <label htmlFor="date-picker" className="block text-sm font-medium text-savant-accent mb-1">Select Date</label>
                        <input
                            id="date-picker"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => onDateChange(e.target.value)}
                            className="w-full bg-savant-light text-savant-text p-2 rounded-md border border-savant-accent focus:ring-2 focus:ring-savant-gold focus:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="unit-size-input" className="block text-sm font-medium text-savant-accent mb-1">Unit Size</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-savant-accent">$</span>
                            <input
                                id="unit-size-input"
                                type="number"
                                value={unitSize}
                                onChange={(e) => onUnitSizeChange(parseFloat(e.target.value) || 0)}
                                className="w-full bg-savant-light text-savant-text p-2 pl-7 rounded-md border border-savant-accent focus:ring-2 focus:ring-savant-gold focus:outline-none"
                                min="0"
                            />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-savant-light">
                     <button
                        onClick={onTuneModel}
                        className="w-full bg-savant-accent text-savant-deep font-bold py-2.5 px-4 rounded-lg hover:bg-savant-text transition flex items-center justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                        </svg>
                        Tune Model
                    </button>
                    <button
                        onClick={onCalibrate}
                        disabled={isCalibrating}
                        title="Analyzes your saved betting history. Does NOT fetch new external sports data."
                        className="w-full bg-savant-gold text-savant-deep font-bold py-2.5 px-4 rounded-lg hover:bg-yellow-300 transition flex items-center justify-center disabled:opacity-50"
                    >
                        {isCalibrating ? (
                            <div className="w-5 h-5 border-2 border-savant-deep border-t-transparent rounded-full animate-spin mr-2"></div>
                        ) : (
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8 5.45A4.97 4.97 0 005.45 8L3.17 8.51c-1.56.38-1.56 2.6 0 2.98L5.45 12A4.97 4.97 0 008 14.55l.51 2.28c.38 1.56 2.6 1.56 2.98 0l.51-2.28A4.97 4.97 0 0014.55 12l2.28-.51c1.56-.38 1.56-2.6 0-2.98l-2.28-.51A4.97 4.97 0 0012 5.45l-.51-2.28zm-2.56 9.19a2.5 2.5 0 003.54-3.54 2.5 2.5 0 00-3.54 3.54z" clipRule="evenodd" />
                            </svg>
                        )}
                        {isCalibrating ? 'Calibrating...' : 'Calibrate Model'}
                    </button>
                </div>
            </div>
        </Card>
    );
};

export default ControlPanel;