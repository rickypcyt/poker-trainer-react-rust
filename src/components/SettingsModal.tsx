import React, { useEffect, useState } from 'react';

import { localBotService } from '../lib/localBotService';
import { pythonBotService } from '../lib/pythonBotService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BotInfo {
  name: string;
  description: string;
  features: string[];
}

const BOT_OPTIONS: Record<string, BotInfo> = {
  typescript: {
    name: 'Local TypeScript Bot',
    description: 'Bot local implementado en TypeScript con estrategia de poker',
    features: [
      'Estrategia preflop basada en categorías de manos',
      'Análisis postflop con evaluación de fuerza',
      'Ajustes por dificultad y personalidad',
      'Sin dependencias externas',
      'Respuesta instantánea'
    ]
  },
  python: {
    name: 'Python Bot (Advanced)',
    description: 'Bot avanzado con Monte Carlo simulation y evaluación precisa',
    features: [
      'Monte Carlo equity calculation',
      'Evaluación precisa de manos con treys',
      'Decisiones basadas en matemáticas',
      'Más estratégico y preciso',
      'Requiere servicio Python corriendo'
    ]
  }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [currentBot, setCurrentBot] = useState<string>('typescript');
  const [currentModel, setCurrentModel] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    // Get current bot selection from localStorage or default to typescript
    const savedBot = localStorage.getItem('selectedBot') || 'typescript';
    setCurrentBot(savedBot);
    
    // Get current bot model info
    const model = savedBot === 'python' ? pythonBotService.getCurrentModel() : localBotService.getCurrentModel();
    console.log('[Settings] Loading bot info:', { bot: savedBot, model });
    setCurrentModel(model);
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    console.log('[Settings] Saving bot selection:', { bot: currentBot });
    
    try {
      // Save bot selection to localStorage
      localStorage.setItem('selectedBot', currentBot);
      
      // Update the bot service
      if (currentBot === 'python') {
        pythonBotService.updateSettings();
      } else {
        localBotService.updateSettings();
      }
      console.log('[Settings] Bot service updated');
      
      // Get updated model info
      const model = currentBot === 'python' ? pythonBotService.getCurrentModel() : localBotService.getCurrentModel();
      setCurrentModel(model);
      console.log('[Settings] Settings updated successfully:', { bot: currentBot, model });
      
      // Show success feedback
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 500);
      
    } catch (error) {
      console.error('[Settings] Error updating settings:', error);
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-md bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-2xl border border-white/10 shadow-2xl overflow-hidden transform transition-all duration-300 ease-out animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-neutral-800/80 to-neutral-900/80">
          <h2 className="text-xl font-bold bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-transparent">
            Settings
          </h2>
          <button
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Bot Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white/90">Bot Engine</h3>
            
            {/* Bot Selection Radio Buttons */}
            <div className="space-y-2">
              {Object.entries(BOT_OPTIONS).map(([key, bot]) => (
                <label key={key} className="flex items-center p-3 bg-neutral-800/50 border border-white/10 rounded-lg cursor-pointer hover:bg-neutral-800/70 transition-colors">
                  <input
                    type="radio"
                    name="botSelection"
                    value={key}
                    checked={currentBot === key}
                    onChange={(e) => setCurrentBot(e.target.value)}
                    className="mr-3 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
                  />
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium">{bot.name}</div>
                    <div className="text-white/70 text-xs mt-1">{bot.description}</div>
                  </div>
                </label>
              ))}
            </div>
            
            {/* Current Bot Info */}
            <div className="px-3 py-2 bg-neutral-800/50 border border-white/10 rounded-lg">
              <div className="text-white text-sm font-medium">{BOT_OPTIONS[currentBot].name}</div>
              <div className="text-white/70 text-xs mt-1">{currentModel}</div>
            </div>
            
            {/* Features List */}
            <div className="mt-3">
              <h4 className="text-xs font-medium text-white/70 mb-2">Características:</h4>
              <ul className="space-y-1">
                {BOT_OPTIONS[currentBot].features.map((feature, index) => (
                  <li key={index} className="text-xs text-white/50 flex items-start">
                    <span className="text-amber-400 mr-2">•</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:from-neutral-600 disabled:to-neutral-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:opacity-50"
            >
              {isSaving ? 'Updating...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
