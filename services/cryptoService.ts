import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult, CandleData, Coin, MarketData, SignalType } from "../types";
import { HISTORY_LIMIT } from "../constants";

// Use Binance Vision Data API which is more CORS-friendly for public data
const BASE_URL = "https://data-api.binance.vision/api/v3";

// Fetch Real Data from Binance Public API
export const fetchMarketData = async (coin: Coin): Promise<MarketData> => {
  try {
    // 1. Fetch K-lines (Candles)
    const klineResponse = await fetch(
      `${BASE_URL}/klines?symbol=${coin.binanceSymbol}&interval=1h&limit=${HISTORY_LIMIT + 30}`
    );
    
    // Handle coins not listed on Binance (like TRUMP often is) by falling back to simulation
    if (!klineResponse.ok) {
      console.warn(`Coin ${coin.symbol} not found on public API, switching to simulation.`);
      return generateMockMarketData(coin);
    }

    const klineData = await klineResponse.json();

    // 2. Fetch 24hr Ticker stats
    const tickerResponse = await fetch(
      `${BASE_URL}/ticker/24hr?symbol=${coin.binanceSymbol}`
    );
    const tickerData = await tickerResponse.json();

    // Parse Candles
    // Binance format: [openTime, open, high, low, close, volume, closeTime, ...]
    const rawCandles = klineData.map((d: any) => ({
      time: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));

    // Calculate Indicators (Simple Moving Averages & RSI)
    const candles = calculateIndicators(rawCandles).slice(-HISTORY_LIMIT);

    return {
      coin,
      currentPrice: parseFloat(tickerData.lastPrice),
      priceChange24h: parseFloat(tickerData.priceChangePercent),
      high24h: parseFloat(tickerData.highPrice),
      low24h: parseFloat(tickerData.lowPrice),
      volume24h: parseFloat(tickerData.quoteVolume),
      candles
    };
  } catch (error) {
    console.error("Failed to fetch market data:", error);
    // Fallback to mock data instead of crashing, so user sees UI
    return generateMockMarketData(coin);
  }
};

// Helper: Generate realistic mock data for unavailable coins (e.g., TRUMP)
const generateMockMarketData = (coin: Coin): MarketData => {
  const now = Date.now();
  const candles: CandleData[] = [];
  let price = 10.50; // Base mock price
  
  for (let i = 0; i < HISTORY_LIMIT + 30; i++) {
    const time = now - (HISTORY_LIMIT + 30 - i) * 3600 * 1000;
    const change = (Math.random() - 0.5) * 0.5;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 0.2;
    const low = Math.min(open, close) - Math.random() * 0.2;
    const volume = Math.random() * 100000;
    
    candles.push({ time, open, high, low, close, volume });
    price = close;
  }
  
  const computedCandles = calculateIndicators(candles).slice(-HISTORY_LIMIT);
  const last = computedCandles[computedCandles.length - 1];

  return {
    coin: { ...coin, name: `${coin.name} (Simulated)` }, // Tag as simulated
    currentPrice: last.close,
    priceChange24h: 5.24,
    high24h: last.high * 1.1,
    low24h: last.low * 0.9,
    volume24h: 5243000,
    candles: computedCandles
  };
};

// Helper: Calculate Basic Indicators locally
const calculateIndicators = (candles: CandleData[]): CandleData[] => {
  return candles.map((candle, index, array) => {
    // MA7
    if (index >= 6) {
      const slice = array.slice(index - 6, index + 1);
      const sum = slice.reduce((acc, c) => acc + c.close, 0);
      candle.ma7 = sum / 7;
    }
    // MA25
    if (index >= 24) {
      const slice = array.slice(index - 24, index + 1);
      const sum = slice.reduce((acc, c) => acc + c.close, 0);
      candle.ma25 = sum / 25;
    }
    // RSI (14)
    if (index >= 14) {
      let gains = 0;
      let losses = 0;
      for (let i = 1; i <= 14; i++) {
        const diff = array[index - i + 1].close - array[index - i].close;
        if (diff > 0) gains += diff;
        else losses -= diff;
      }
      const rs = gains / (losses || 1);
      candle.rsi = 100 - (100 / (1 + rs));
    }
    return candle;
  });
};

// Gemini AI Analysis
export const analyzeMarketTrends = async (marketData: MarketData): Promise<AIAnalysisResult> => {
  if (!process.env.API_KEY) {
    return getMockAnalysis();
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Format data for LLM
  const recentCandles = marketData.candles.slice(-15).map(c => ({
    t: new Date(c.time).toISOString().substring(11, 16),
    o: c.open.toFixed(2),
    h: c.high.toFixed(2),
    l: c.low.toFixed(2),
    c: c.close.toFixed(2),
    v: Math.floor(c.volume),
    rsi: c.rsi ? Math.round(c.rsi) : null
  }));

  const prompt = `
    Analyze the crypto market for ${marketData.coin.name} (${marketData.coin.symbol}).
    Current Price: $${marketData.currentPrice}
    24h Change: ${marketData.priceChange24h}%
    
    Recent OHLCV (1h):
    ${JSON.stringify(recentCandles)}

    Task: Act as a senior crypto analyst combining technicals (RSI, Volume, Trend) with sentiment.
    Provide a JSON response.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            signal: { type: Type.STRING, enum: [SignalType.BUY, SignalType.SELL, SignalType.HOLD] },
            confidence: { type: Type.NUMBER },
            entryPrice: { type: Type.NUMBER },
            stopLoss: { type: Type.NUMBER },
            takeProfit: { type: Type.NUMBER },
            trend: { type: Type.STRING, enum: ['bullish', 'bearish', 'neutral'] },
            reasoning: { type: Type.STRING },
            deepLearningInsights: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["signal", "confidence", "entryPrice", "stopLoss", "takeProfit", "trend", "reasoning", "deepLearningInsights"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return result as AIAnalysisResult;

  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return getMockAnalysis();
  }
};

const getMockAnalysis = (): AIAnalysisResult => ({
  signal: SignalType.HOLD,
  confidence: 50,
  entryPrice: 0,
  stopLoss: 0,
  takeProfit: 0,
  trend: 'neutral',
  reasoning: "System offline or API Key missing. Showing demo data.",
  deepLearningInsights: ["API connection required for live analysis"]
});