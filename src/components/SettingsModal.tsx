import React, { useEffect, useState } from 'react';

import { localBotService } from '../lib/localBotService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BotInfo {
  name: string;
  description: string;
  features: string[];
}

const BOT_INFO: BotInfo = {
  name: 'Local TypeScript Bot',
  description: 'Bot local implementado en TypeScript con estrategia de poker',
  features: [
    'Estrategia preflop basada en categorías de manos',
    'Análisis postflop con evaluación de fuerza',
    'Ajustes por dificultad y personalidad',
    'Sin dependencias externas',
    'Respuesta instantánea'
  ]
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [currentModel, setCurrentModel] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    // Get current bot model info
    const model = localBotService.getCurrentModel();
    console.log('[Settings] Loading bot info:', { model });
    setCurrentModel(model);
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    console.log('[Settings] Refreshing bot service...');
    
    try {
      // Update the bot service
      localBotService.updateSettings();
      console.log('[Settings] Bot service updated');
      
      // Get updated model info
      const model = localBotService.getCurrentModel();
      setCurrentModel(model);
      console.log('[Settings] Settings updated successfully:', { model });
      
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
          {/* Bot Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white/90">Bot Engine</h3>
            <div className="px-3 py-2 bg-neutral-800/50 border border-white/10 rounded-lg">
              <div className="text-white text-sm font-medium">{BOT_INFO.name}</div>
              <div className="text-white/70 text-xs mt-1">{currentModel}</div>
            </div>
            <div className="text-xs text-white/50">
              {BOT_INFO.description}
            </div>
            
            {/* Features List */}
            <div className="mt-3">
              <h4 className="text-xs font-medium text-white/70 mb-2">Características:</h4>
              <ul className="space-y-1">
                {BOT_INFO.features.map((feature, index) => (
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
              {isSaving ? 'Updating...' : 'Refresh Bot'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
