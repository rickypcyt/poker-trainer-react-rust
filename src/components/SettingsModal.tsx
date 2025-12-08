import React, { useEffect, useState } from 'react';

import { refreshBotService } from '../lib/gptBotService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

const OPENROUTER_MODELS: OpenRouterModel[] = [
  { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen3 235B A22B', description: 'Modelo por defecto (Free)' },
  { id: 'tngtech/deepseek-r1t2-chimera:free', name: 'DeepSeek-TNG-R1T2-Chimera', description: 'Mejor razonamiento (Free)' },
  { id: 'openai/gpt-oss-20b:free', name: 'GPT-OSS-20B', description: 'Más expresivo y flexible (Free)' },
  { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air', description: 'Rápido y razonable (Free)' },
  { id: 'nvidia/nemotron-nano-12b-v2-vl:free', name: 'Nemotron Nano 12B', description: 'Rápido y eficiente (Free)' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [selectedModel, setSelectedModel] = useState<string>('qwen/qwen3-235b-a22b:free');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    // Load saved settings from localStorage
    const savedModel = localStorage.getItem('poker-trainer-openrouter-model');
    console.log('[Settings] Loading settings from localStorage:', { savedModel });
    
    if (savedModel) {
      setSelectedModel(savedModel);
      console.log('[Settings] Set model from localStorage:', savedModel);
    } else {
      console.log('[Settings] Using default model: qwen/qwen3-235b-a22b:free');
    }
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    console.log('[Settings] Starting save process...');
    console.log('[Settings] Selected model:', selectedModel);
    
    try {
      // Save to localStorage
      localStorage.setItem('poker-trainer-openrouter-model', selectedModel);
      console.log('[Settings] Saved to localStorage');
      
      // Update environment variables for the current session
      if (typeof window !== 'undefined') {
        (window as unknown as Record<string, string>).VITE_OPENROUTER_MODEL = selectedModel;
        console.log('[Settings] Updated window environment variable');
      }
      
      // Refresh the bot service with new settings
      console.log('[Settings] Calling refreshBotService...');
      refreshBotService();
      console.log('[Settings] refreshBotService completed');
      
      console.log('[Settings] Settings saved successfully:', { model: selectedModel });
      
      // Show success feedback
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 500);
      
    } catch (error) {
      console.error('[Settings] Error saving settings:', error);
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
          {/* AI Model Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white/90">AI Model (Open Router)</h3>
            <select
              value={selectedModel}
              onChange={(e) => {
                const newModel = e.target.value;
                console.log('[Settings] Model selection changed:', { from: selectedModel, to: newModel });
                setSelectedModel(newModel);
              }}
              className="w-full px-3 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
            >
              {OPENROUTER_MODELS.map((model) => (
                <option key={model.id} value={model.id} className="bg-neutral-800">
                  {model.name} {model.description && `- ${model.description}`}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/50">
              Selected: {OPENROUTER_MODELS.find(m => m.id === selectedModel)?.name}
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:from-neutral-600 disabled:to-neutral-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
