import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: React.ReactNode;
    onConfirm?: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, title, message, onConfirm }) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        }
        onClose(); 
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-down"
            onClick={onClose}
        >
            <div 
                className="bg-savant-main rounded-lg shadow-2xl w-full max-w-md border border-savant-light flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 flex-shrink-0 border-b border-savant-light">
                    <h2 className="text-2xl font-bold text-savant-cyan">{title}</h2>
                </div>
                <div className="px-6 py-4 space-y-4 flex-grow text-savant-accent">
                    {message}
                </div>
                <div className="p-6 flex-shrink-0 border-t border-savant-light">
                    {onConfirm ? (
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="bg-savant-light text-savant-text font-semibold py-2 px-4 rounded-lg hover:bg-savant-accent/50 transition"
                            >
                                Cancel
                            </button>
                             <button 
                                type="button" 
                                onClick={handleConfirm} 
                                className="bg-savant-cyan text-savant-deep font-bold py-2 px-4 rounded-lg hover:bg-cyan-300 transition"
                            >
                                Confirm
                            </button>
                        </div>
                    ) : (
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="w-full bg-savant-cyan text-savant-deep font-bold py-2 px-4 rounded-lg hover:bg-cyan-300 transition"
                        >
                            OK
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;