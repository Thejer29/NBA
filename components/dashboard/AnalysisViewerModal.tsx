import React from 'react';
import { GameAnalysis } from '../../types';
import AnalysisResultCard from './AnalysisResultCard';

interface AnalysisViewerModalProps {
    analysis: GameAnalysis | null;
    onClose: () => void;
}

const AnalysisViewerModal: React.FC<AnalysisViewerModalProps> = ({ analysis, onClose }) => {
    if (!analysis) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in-down" onClick={onClose}>
            <div className="bg-savant-deep rounded-lg shadow-2xl w-full max-w-4xl border border-savant-light flex flex-col max-h-[95vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex-shrink-0 border-b border-savant-light flex justify-between items-center">
                    <h2 className="text-xl font-bold text-savant-cyan">Game Analysis</h2>
                    <button onClick={onClose} className="text-savant-accent hover:text-savant-text">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="overflow-y-auto p-4">
                    {/* The expanded prop should be managed inside AnalysisResultCard itself, or passed if needed.
                        For a modal view, we probably want it always expanded. Let's assume the component handles its own state
                        or we can force it open if we modify it. For now, we'll let it default.
                        Update: The card is not "always expanded" by default. Let's just render it as is.
                        The user can click to expand within the modal.
                    */}
                    <AnalysisResultCard result={analysis} />
                </div>
            </div>
        </div>
    );
};

export default AnalysisViewerModal;