import React, { useMemo, useState, useRef, useEffect } from 'react';
import { CandleData } from '../types';

interface Props {
  data: CandleData[];
  height?: number;
}

const CandlestickChart: React.FC<Props> = ({ data, height = 450 }) => {
  const [hoveredData, setHoveredData] = useState<CandleData | null>(null);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { minPrice, maxPrice, maxVolume, priceRange, candleWidth, gap, chartWidth } = useMemo(() => {
    if (data.length === 0) return { minPrice: 0, maxPrice: 0, maxVolume: 0, priceRange: 1, candleWidth: 0, gap: 0, chartWidth: 0 };
    
    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;
    
    data.forEach(d => {
      if (d.low < min) min = d.low;
      if (d.high > max) max = d.high;
      if (d.volume > maxVol) maxVol = d.volume;
    });

    // Add 5% padding to top/bottom
    const padding = (max - min) * 0.05;
    min -= padding;
    max += padding;

    // Responsive width calculation
    // We assume a fixed candle width for clarity, but the container scrolls
    const cWidth = 10;
    const cGap = 4;
    
    return {
      minPrice: min,
      maxPrice: max,
      maxVolume: maxVol,
      priceRange: max - min || 1,
      candleWidth: cWidth,
      gap: cGap,
      chartWidth: data.length * (cWidth + cGap)
    };
  }, [data]);

  const getY = (price: number) => {
    return height - ((price - minPrice) / priceRange) * (height - 50); // Reserve 50px at bottom for volume
  };

  const getVolY = (volume: number) => {
    const volHeight = 50; // Max height for volume bars
    const scaledVol = (volume / maxVolume) * volHeight;
    return height - scaledVol;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const y = e.clientY - rect.top;
    
    // Find index based on X
    const index = Math.floor(x / (candleWidth + gap));
    if (index >= 0 && index < data.length) {
      setHoveredData(data[index]);
      setCursorPos({ x: e.clientX - rect.left, y });
    }
  };

  const handleMouseLeave = () => {
    setHoveredData(null);
    setCursorPos(null);
  };

  // Scroll to end on new data
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [data]);

  const activeCandle = hoveredData || data[data.length - 1];

  return (
    <div className="flex flex-col h-full bg-[#111418] rounded-xl border border-gray-800 overflow-hidden relative">
      {/* Chart Header / Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800 bg-[#0b0e11] text-xs font-mono">
        <div className="flex gap-3">
          <span className="text-gray-500">O: <span className={activeCandle?.open > activeCandle?.close ? 'text-crypto-down' : 'text-crypto-up'}>{activeCandle?.open.toFixed(2)}</span></span>
          <span className="text-gray-500">H: <span className={activeCandle?.open > activeCandle?.close ? 'text-crypto-down' : 'text-crypto-up'}>{activeCandle?.high.toFixed(2)}</span></span>
          <span className="text-gray-500">L: <span className={activeCandle?.open > activeCandle?.close ? 'text-crypto-down' : 'text-crypto-up'}>{activeCandle?.low.toFixed(2)}</span></span>
          <span className="text-gray-500">C: <span className={activeCandle?.open > activeCandle?.close ? 'text-crypto-down' : 'text-crypto-up'}>{activeCandle?.close.toFixed(2)}</span></span>
          <span className="text-gray-500 hidden sm:inline">Vol: <span className="text-white">{activeCandle?.volume.toLocaleString()}</span></span>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="relative overflow-x-auto overflow-y-hidden flex-1 cursor-crosshair custom-scrollbar"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg width={Math.max(chartWidth, 100)} height={height} className="block">
           {/* Grid Lines */}
           {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
             const y = (height - 50) * ratio;
             const price = maxPrice - (priceRange * ratio);
             return (
               <g key={ratio}>
                 <line x1="0" y1={y} x2={Math.max(chartWidth, 2000)} y2={y} stroke="#1f2937" strokeDasharray="3" strokeOpacity="0.5" />
                 <text x={Math.max(containerRef.current?.scrollLeft || 0, 0) + 5} y={y - 5} fill="#6b7280" fontSize="10" fontFamily="monospace">
                   {price.toFixed(2)}
                 </text>
               </g>
             );
           })}

           {/* Candles & Volume */}
           {data.map((candle, i) => {
             const x = i * (candleWidth + gap) + (candleWidth / 2);
             const isUp = candle.close >= candle.open;
             const color = isUp ? '#00c087' : '#f23645'; // Up Green, Down Red
             
             const yOpen = getY(candle.open);
             const yClose = getY(candle.close);
             const yHigh = getY(candle.high);
             const yLow = getY(candle.low);
             
             const bodyTop = Math.min(yOpen, yClose);
             const bodyHeight = Math.max(Math.abs(yOpen - yClose), 1);

             // Volume
             const volY = getVolY(candle.volume);
             const volHeight = height - volY;

             return (
               <g key={candle.time}>
                 {/* Volume Bar */}
                 <rect 
                    x={x - candleWidth/2} 
                    y={volY} 
                    width={candleWidth} 
                    height={volHeight} 
                    fill={color} 
                    opacity="0.2" 
                 />

                 {/* Wick */}
                 <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1" />
                 
                 {/* Body */}
                 <rect 
                   x={x - candleWidth/2} 
                   y={bodyTop} 
                   width={candleWidth} 
                   height={bodyHeight} 
                   fill={color} 
                 />
               </g>
             );
           })}

           {/* Crosshair Horizontal Line (follows mouse Y) */}
           {cursorPos && (
             <line 
                x1="0" 
                y1={cursorPos.y} 
                x2={Math.max(chartWidth, 2000)} 
                y2={cursorPos.y} 
                stroke="#fff" 
                strokeOpacity="0.3" 
                strokeDasharray="4"
             />
           )}
           
           {/* Crosshair Vertical Line (follows hovered candle) */}
           {hoveredData && (
              <line
                x1={data.indexOf(hoveredData) * (candleWidth + gap) + candleWidth/2}
                y1="0"
                x2={data.indexOf(hoveredData) * (candleWidth + gap) + candleWidth/2}
                y2={height}
                stroke="#fff"
                strokeOpacity="0.3"
                strokeDasharray="4"
              />
           )}
        </svg>

        {/* Floating Tooltip Label for Price on Y-axis */}
        {cursorPos && (
           <div 
             className="absolute right-0 bg-crypto-accent text-white text-[10px] px-1 py-0.5 rounded-l font-mono pointer-events-none"
             style={{ top: cursorPos.y - 10 }}
           >
              {(maxPrice - (cursorPos.y / (height - 50)) * priceRange).toFixed(2)}
           </div>
        )}
      </div>
    </div>
  );
};

export default CandlestickChart;
