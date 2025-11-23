export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD'
}

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  binanceSymbol: string; // Added for API mapping
}

export interface CandleData {
  time: number; // timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // Technical Indicators
  rsi?: number;
  ma7?: number;
  ma25?: number;
}

export interface AIAnalysisResult {
  signal: SignalType;
  confidence: number; // 0-100
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string;
  deepLearningInsights: string[]; 
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface MarketData {
  coin: Coin;
  currentPrice: number;
  priceChange24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  candles: CandleData[];
}