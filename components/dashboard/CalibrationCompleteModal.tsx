import React from 'react';
import { ModelWeights } from '../../types';

interface CalibrationCompleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: { notes: string; newWeights: ModelWeights } | null;
    error: string | null;
}

const CalibrationCompleteModal: React.FC<CalibrationCompleteModalProps> = ({ isOpen, onClose, result, error }) => {
    if (!isOpen) return null;

    const formatNotes = (notes: string) => {
        return notes.split('\n').map((line, index) => {
            if (line.trim().startsWith('-')) {
                return <li key={index} className="ml-5 list-disc">{line.substring(1).trim()}</li>;
            }
            if (line.trim().length > 0) {
                return <p key={index} className="mt-2">{line}</p>;
            }
            return null;
        });
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-down"
            onClick={onClose}
        >
            <div 
                className="bg-savant-main rounded-lg shadow-2xl w-full max-w-lg border border-savant-light flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 flex-shrink-0 border-b border-savant-light">
                    <h2 className="text-2xl font-bold text-savant-cyan">
                        {error ? 'Calibration Failed' : 'Calibration Complete'}
                    </h2>
                     <p className="text-sm text-savant-accent mt-1">
                        {error ? 'An error occurred during the process.' : 'The Savant Model has been automatically tuned.'}
                    </p>
                </div>

                <div className="overflow-y-auto px-6 py-4 space-y-4 flex-grow">
                    {result && (
                        <div>
                            <h3 className="font-semibold text-savant-gold mb-2">Optimizer's Report:</h3>
                            <div className="text-savant-accent text-sm space-y-2 bg-savant-deep p-4 rounded-md">
                                {formatNotes(result.notes)}
                            </div>
                        </div>
                    )}
                    {error && (
                         <div className="text-red-400 text-sm bg-red-900/50 p-4 rounded-md">
                            <p className="font-semibold">Error Details:</p>
                            <p>{error}</p>
                        </div>
                    )}
                </div>

                <div className="p-6 flex-shrink-0 border-t border-savant-light">
                    <button 
                        onClick={onClose} 
                        className="w-full bg-savant-cyan text-savant-deep font-bold py-2 px-4 rounded-lg hover:bg-cyan-300 transition"
                    >
                        Acknowledge
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CalibrationCompleteModal;