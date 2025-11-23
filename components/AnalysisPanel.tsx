import React from 'react';
import { AIAnalysisResult, SignalType } from '../types';

interface Props {
  analysis: AIAnalysisResult | null;
  isLoading: boolean;
  onStartAnalysis: () => void;
  marketDataAvailable: boolean;
}

const AnalysisPanel: React.FC<Props> = ({ analysis, isLoading, onStartAnalysis, marketDataAvailable }) => {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 space-y-6">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-crypto-accent border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-mono animate-pulse">AI</span>
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium text-white">Analyzing Market Structure</h3>
          <p className="text-sm text-gray-500">Processing price action, volume & volatility...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-500">
        <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Ready to Analyze</h3>
        <p className="mb-8 text-sm text-gray-400 max-w-[240px] leading-relaxed">
          Generate real-time trading signals, support/resistance levels, and pattern recognition using Gemini 2.5.
        </p>
        
        <button 
          onClick={onStartAnalysis}
          disabled={!marketDataAvailable}
          className="group relative px-8 py-3 bg-crypto-accent hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            <span>Run AI Analysis</span>
          </div>
        </button>
      </div>
    );
  }

  const isBuy = analysis.signal === SignalType.BUY;
  const isSell = analysis.signal === SignalType.SELL;
  
  const themeColor = isBuy ? 'text-crypto-up border-crypto-up' : isSell ? 'text-crypto-down border-crypto-down' : 'text-gray-400 border-gray-500';
  const bgGradient = isBuy ? 'from-green-500/10 to-transparent' : isSell ? 'from-red-500/10 to-transparent' : 'from-gray-500/10 to-transparent';

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 custom-scrollbar pb-20">
      {/* Signal Card */}
      <div className={`relative p-6 rounded-2xl border ${themeColor} bg-gradient-to-br ${bgGradient} overflow-hidden shadow-xl`}>
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <svg className="w-24 h-24 transform rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </div>
        
        <div className="relative z-10 flex flex-col items-center text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">Signal Recommendation</span>
          <h2 className={`text-4xl font-black tracking-tighter ${isBuy ? 'text-crypto-up' : isSell ? 'text-crypto-down' : 'text-gray-300'}`}>
            {analysis.signal}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${isBuy ? 'bg-green-500/20 text-green-400' : isSell ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300'}`}>
              {analysis.trend.toUpperCase()} TREND
            </span>
            <span className="text-xs text-gray-400 font-mono">CONFIDENCE: {analysis.confidence}%</span>
          </div>
        </div>
      </div>

      {/* Trade Levels */}
      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-stretch rounded-lg overflow-hidden border border-gray-800 bg-[#161b22] hover:border-gray-700 transition-colors">
          <div className="w-1.5 bg-blue-500"></div>
          <div className="flex-1 p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Entry Zone</div>
            <div className="font-mono text-lg text-white font-medium">${analysis.entryPrice.toFixed(4)}</div>
          </div>
        </div>

        <div className="flex gap-3">
           <div className="flex-1 flex items-stretch rounded-lg overflow-hidden border border-gray-800 bg-[#161b22] hover:border-gray-700 transition-colors">
            <div className="w-1.5 bg-crypto-up"></div>
            <div className="flex-1 p-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Target (TP)</div>
              <div className="font-mono text-lg text-crypto-up font-medium">${analysis.takeProfit.toFixed(4)}</div>
            </div>
          </div>

          <div className="flex-1 flex items-stretch rounded-lg overflow-hidden border border-gray-800 bg-[#161b22] hover:border-gray-700 transition-colors">
            <div className="w-1.5 bg-crypto-down"></div>
            <div className="flex-1 p-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Stop (SL)</div>
              <div className="font-mono text-lg text-crypto-down font-medium">${analysis.stopLoss.toFixed(4)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Reasoning */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <svg className="w-4 h-4 text-crypto-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          Strategy Analysis
        </div>
        <p className="text-sm text-gray-400 leading-relaxed border-l-2 border-gray-700 pl-3">
          {analysis.reasoning}
        </p>
      </div>

      {/* Deep Learning Insights */}
      <div className="bg-[#161b22] rounded-xl p-4 border border-gray-800">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Pattern Recognition</h3>
        <ul className="space-y-3">
          {analysis.deepLearningInsights.map((insight, idx) => (
            <li key={idx} className="flex gap-3 text-sm text-gray-300">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-crypto-accent flex-shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
              {insight}
            </li>
          ))}
        </ul>
      </div>

      {/* Re-Analyze Button */}
      <button 
        onClick={onStartAnalysis}
        className="w-full py-3 mt-4 border border-gray-700 hover:border-gray-600 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        Update Analysis
      </button>
    </div>
  );
};

export default AnalysisPanel;