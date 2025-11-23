import { Coin } from "./types";

export const SUPPORTED_COINS: Coin[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', binanceSymbol: 'BTCUSDT' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', binanceSymbol: 'ETHUSDT' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', binanceSymbol: 'SOLUSDT' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', binanceSymbol: 'DOGEUSDT' },
  { id: 'trump', symbol: 'TRUMP', name: 'Trump (MAGA)', binanceSymbol: 'TRUMPUSDT' },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', binanceSymbol: 'PEPEUSDT' },
  { id: 'shiba', symbol: 'SHIB', name: 'Shiba Inu', binanceSymbol: 'SHIBUSDT' },
  { id: 'ripple', symbol: 'XRP', name: 'Ripple', binanceSymbol: 'XRPUSDT' },
  { id: 'binance-coin', symbol: 'BNB', name: 'BNB', binanceSymbol: 'BNBUSDT' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', binanceSymbol: 'ADAUSDT' },
  { id: 'avalanche', symbol: 'AVAX', name: 'Avalanche', binanceSymbol: 'AVAXUSDT' },
];

export const HISTORY_LIMIT = 50; // Number of candles to fetch