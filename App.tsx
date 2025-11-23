import React, { useEffect, useState } from 'react';
import { SUPPORTED_COINS } from './constants';
import { Coin, MarketData, AIAnalysisResult } from './types';
import { fetchMarketData, analyzeMarketTrends } from './services/cryptoService';
import CandlestickChart from './components/CandlestickChart';
import AnalysisPanel from './components/AnalysisPanel';

const App: React.FC = () => {
  const [selectedCoin, setSelectedCoin] = useState<Coin>(SUPPORTED_COINS[0]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Real-time Polling Logic
  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval>;

    const loadPriceData = async () => {
      try {
        const data = await fetchMarketData(selectedCoin);
        if (isMounted) {
          setMarketData(data);
          setLastUpdated(new Date());
          setError(null);
        }
      } catch (e: any) {
        console.error("Polling error:", e);
        // Only set main error if we don't have data yet
        if (isMounted && !marketData) {
          setError("Failed to connect to live feed");
        }
      }
    };

    // Reset analysis and data when coin switches
    setAnalysis(null);
    setMarketData(null); 
    setLastUpdated(null);
    
    // Initial fetch
    loadPriceData();

    // Poll every 5 seconds
    intervalId = setInterval(loadPriceData, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCoin]); // Re-run effect only when coin changes

  const handleRunAnalysis = async () => {
    if (!marketData) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeMarketTrends(marketData);
      setAnalysis(result);
    } catch (e: any) {
      console.error(e);
      // Optional: show a toast or error in the panel, currently just logging
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e11] text-gray-300 flex flex-col font-sans selection:bg-crypto-accent selection:text-white">
      {/* Header */}
      <header className="h-16 border-b border-gray-800 bg-[#0b0e11]/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white hidden sm:block">NeuroCrypto <span className="text-gray-600 font-normal">| AI Terminals</span></h1>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
              {lastUpdated ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="hidden sm:inline">LIVE FEED</span>
                </>
              ) : (
                <span className="text-yellow-500">CONNECTING...</span>
              )}
           </div>

           {!process.env.API_KEY && (
             <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                <span className="text-xs text-yellow-500 font-medium">Demo Mode</span>
             </div>
           )}
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar Navigation */}
        <nav className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-gray-800 bg-[#0d1116] flex flex-col flex-shrink-0 max-h-48 lg:max-h-none overflow-y-auto custom-scrollbar">
          <div className="p-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 hidden lg:block px-2">Assets</h2>
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
              {SUPPORTED_COINS.map(coin => (
                <button
                  key={coin.id}
                  onClick={() => setSelectedCoin(coin)}
                  className={`flex-shrink-0 w-auto lg:w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
                    selectedCoin.id === coin.id 
                      ? 'bg-crypto-accent text-white shadow-lg shadow-blue-900/20' 
                      : 'hover:bg-gray-800/50 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                    selectedCoin.id === coin.id ? 'bg-white text-crypto-accent' : 'bg-gray-800 text-gray-500 group-hover:bg-gray-700'
                  }`}>
                    {coin.symbol[0]}
                  </div>
                  <div className="text-left hidden lg:block">
                    <div className="font-medium text-sm">{coin.name}</div>
                    <div className={`text-xs ${selectedCoin.id === coin.id ? 'text-blue-200' : 'text-gray-600'}`}>{coin.symbol}</div>
                  </div>
                  {/* Mobile only symbol */}
                  <div className="block lg:hidden font-medium text-sm pr-2">
                    {coin.symbol}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col lg:flex-row min-w-0 bg-[#0b0e11] overflow-hidden">
          
          {/* Chart Section */}
          <div className="flex-1 flex flex-col min-w-0 relative border-b lg:border-b-0 lg:border-r border-gray-800">
            {error && (
               <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-xl text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                  </div>
               </div>
            )}

            {marketData ? (
              <>
                {/* Ticker Header */}
                <div className="p-6 border-b border-gray-800 flex flex-wrap items-baseline gap-6 bg-[#0b0e11]">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      {marketData.coin.name} 
                      <span className="text-sm font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded">1H</span>
                    </h2>
                    <span className="text-sm text-gray-500">{marketData.coin.symbol}-USD</span>
                  </div>
                  
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-mono text-white tracking-tight transition-colors duration-300">
                      ${marketData.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`flex items-center text-sm font-medium px-2 py-0.5 rounded ${marketData.priceChange24h >= 0 ? 'bg-green-500/10 text-crypto-up' : 'bg-red-500/10 text-crypto-down'}`}>
                      {marketData.priceChange24h > 0 ? '↑' : '↓'} {Math.abs(marketData.priceChange24h).toFixed(2)}%
                    </span>
                  </div>

                  <div className="hidden xl:flex gap-6 text-sm ml-auto">
                    <div>
                      <div className="text-gray-500 text-xs uppercase">24h High</div>
                      <div className="text-gray-300 font-mono">${marketData.high24h.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs uppercase">24h Low</div>
                      <div className="text-gray-300 font-mono">${marketData.low24h.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs uppercase">24h Volume</div>
                      <div className="text-gray-300 font-mono text-right">{marketData.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>
                </div>
                
                {/* Chart Area */}
                <div className="flex-1 p-4 relative min-h-[300px]">
                  <CandlestickChart data={marketData.candles} />
                </div>
              </>
            ) : (
               <div className="flex-1 flex items-center justify-center">
                 <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-800 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-gray-800 rounded"></div>
                 </div>
               </div>
            )}
          </div>

          {/* Analysis Sidebar */}
          <div className="w-full lg:w-[400px] bg-[#0d1116] flex flex-col h-auto overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#0d1116]">
              <h3 className="font-bold text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-crypto-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                Neural Engine
              </h3>
              <span className="text-xs font-mono text-gray-500">{process.env.API_KEY ? 'V2.5 FLASH' : 'DEMO'}</span>
            </div>
            
            <div className="flex-1 overflow-hidden relative">
               <AnalysisPanel 
                 analysis={analysis} 
                 isLoading={isAnalyzing} 
                 onStartAnalysis={handleRunAnalysis}
                 marketDataAvailable={!!marketData}
               />
            </div>
          </div>

        </main>
      </div>
    </div>
  );
};

export default App;