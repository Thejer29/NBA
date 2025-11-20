




import React, { useState, useEffect } from 'react';
import { ModelWeights } from '../../types';
import { DEFAULT_MODEL_WEIGHTS } from '../../constants';

interface TuningModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentWeights: ModelWeights;
    onSave: (weights: ModelWeights) => void;
}

const TuningModal: React.FC<TuningModalProps> = ({ isOpen, onClose, currentWeights, onSave }) => {
    const [weights, setWeights] = useState<ModelWeights>(currentWeights);

    useEffect(() => {
        setWeights(currentWeights);
    }, [currentWeights]);

    if (!isOpen) return null;

    const handleWeightChange = (key: keyof ModelWeights, value: string) => {
        setWeights(prev => ({ ...prev, [key]: parseFloat(value) }));
    };

    const handleSave = () => {
        onSave(weights);
    };
    
    const handleReset = () => {
        setWeights(DEFAULT_MODEL_WEIGHTS);
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in-down p-4"
            onClick={onClose}
        >
            <div 
                className="bg-savant-main rounded-lg shadow-2xl w-full max-w-lg border border-savant-light flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 flex-shrink-0 border-b border-savant-light">
                    <h2 className="text-2xl font-bold text-savant-cyan mb-2">Tune Savant Model</h2>
                    <p className="text-savant-accent">Adjust weights to fine-tune the simulation's logic.</p>
                </div>
                
                {/* Scrollable Content */}
                <div className="overflow-y-auto px-6 py-4 space-y-6 flex-grow">
                   <h3 className="text-lg font-semibold text-savant-gold -mb-2">Four Factor Weights</h3>
                   <Slider
                       label="Shooting (eFG%)"
                       description="Weight of shooting efficiency advantage."
                       value={weights.eFgPctWeight}
                       onChange={(e) => handleWeightChange('eFgPctWeight', e.target.value)}
                       min={0.1} max={1.0} step={0.05} decimals={2}
                   />
                   <Slider
                       label="Turnovers (TOV%)"
                       description="Weight of ball security vs. opponent's forced turnovers."
                       value={weights.turnoverPctWeight}
                       onChange={(e) => handleWeightChange('turnoverPctWeight', e.target.value)}
                       min={0.1} max={1.0} step={0.05} decimals={2}
                   />
                   <Slider
                       label="Rebounding (REB%)"
                       description="Weight of offensive rebounding advantage."
                       value={weights.reboundPctWeight}
                       onChange={(e) => handleWeightChange('reboundPctWeight', e.target.value)}
                       min={0.1} max={1.0} step={0.05} decimals={2}
                   />
                    <Slider
                       label="Free Throws (FTR)"
                       description="Weight of the advantage in getting to the free-throw line."
                       value={weights.freeThrowRateWeight}
                       onChange={(e) => handleWeightChange('freeThrowRateWeight', e.target.value)}
                       min={0.1} max={1.0} step={0.05} decimals={2}
                   />
                    <div className="pt-4 border-t border-savant-light">
                        <h3 className="text-lg font-semibold text-savant-gold mb-2">Global & Simulation Parameters</h3>
                        <Slider
                           label="Efficiency Penalty"
                           description="The 'Sharper' factor: % drop in efficiency for every 1% increase in usage when redistributing stats due to missing players."
                           value={weights.efficiencyDecay}
                           onChange={(e) => handleWeightChange('efficiencyDecay', e.target.value)}
                           min={0.0} max={0.2} step={0.01} decimals={2}
                       />
                        <Slider
                           label="Three-Point Variance"
                           description="How much a team's 3-point attempt rate affects their score volatility. Higher values make three-point heavy teams more unpredictable."
                           value={weights.threePointVarianceWeight}
                           onChange={(e) => handleWeightChange('threePointVarianceWeight', e.target.value)}
                           min={0.0} max={2.0} step={0.1} decimals={1}
                       />
                         <Slider
                           label="Matchup Impact"
                           description="How strongly the Four Factor adjustment impacts the baseline rating. Lower reduces volatility."
                           value={weights.matchupImpactWeight}
                           onChange={(e) => handleWeightChange('matchupImpactWeight', e.target.value)}
                           min={0.0} max={1.5} step={0.05} decimals={2}
                       />
                         <Slider
                           label="Recent Form"
                           description="How much to blend recent (last 10) vs season-long stats."
                           value={weights.recentForm}
                           onChange={(e) => handleWeightChange('recentForm', e.target.value)}
                            min={0.0} max={1.0} step={0.1}
                       />
                        <Slider
                           label="Volatility Impact"
                           description="How much team volatility influences simulation randomness. Higher values amplify the effect of inconsistent teams."
                           value={weights.volatilityImpactWeight}
                           onChange={(e) => handleWeightChange('volatilityImpactWeight', e.target.value)}
                           min={0} max={2.0} step={0.1}
                       />
                         <Slider
                           label="Game Score Volatility (σ)"
                           description="Standard deviation of each team's final score. Higher means more randomness."
                           value={weights.simulationStdDev}
                           onChange={(e) => handleWeightChange('simulationStdDev', e.target.value)}
                           min={8.0} max={18.0} step={0.5}
                           decimals={1}
                       />
                        <div className="mt-6">
                           <Slider
                               label="Score Correlation (ρ)"
                               description="How much team scores correlate. Positive means high-scoring games affect both teams."
                               value={weights.scoreCorrelation}
                               onChange={(e) => handleWeightChange('scoreCorrelation', e.target.value)}
                               min={-0.2} max={0.8} step={0.05}
                               decimals={2}
                           />
                        </div>
                   </div>
                </div>
                
                {/* Footer */}
                <div className="p-6 flex-shrink-0 border-t border-savant-light">
                    <div className="grid grid-cols-3 gap-4">
                        <button onClick={handleReset} className="col-span-1 bg-savant-light text-savant-text font-semibold py-2 px-4 rounded-lg hover:bg-savant-accent/50 transition">Reset</button>
                        <button onClick={handleSave} className="col-span-2 bg-savant-gold text-savant-deep font-bold py-2 px-4 rounded-lg hover:bg-yellow-300 transition">Save & Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface SliderProps {
    label: string;
    description: string;
    value: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    min: number;
    max: number;
    step: number;
    decimals?: number;
}

const Slider: React.FC<SliderProps> = ({ label, description, value, onChange, min, max, step, decimals = 1 }) => (
    <div>
        <div className="flex justify-between items-center mb-1">
            <label className="text-savant-text font-semibold">{label}</label>
            <span className="text-savant-gold font-mono text-lg">{value.toFixed(decimals)}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={onChange}
            className="w-full h-2 bg-savant-light rounded-lg appearance-none cursor-pointer"
        />
        <p className="text-xs text-savant-accent mt-1">{description}</p>
    </div>
);


export default TuningModal;