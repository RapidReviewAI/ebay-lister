import React from "react";
import { DollarSign, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { CompsData, PricingStrategy } from "@/types/listing";

interface MarketCompsProps {
  compsData: CompsData | null;
  showComps: boolean;
  setShowComps: (val: boolean) => void;
  pricingStrategy: PricingStrategy;
  applyPricingStrategy: (strategy: PricingStrategy) => void;
  getEstimatedDaysToSell: () => number | string;
}

export function MarketComps({
  compsData,
  showComps,
  setShowComps,
  pricingStrategy,
  applyPricingStrategy,
  getEstimatedDaysToSell
}: MarketCompsProps) {
  return (
    <section className="glass rounded-2xl overflow-hidden shadow-xl shadow-slate-200/50 border border-slate-200">
      <div
        className="bg-slate-900 px-6 py-4 flex items-center justify-between cursor-pointer text-white"
        onClick={() => setShowComps(!showComps)}
      >
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-100">
            Market Intelligence
          </h2>
        </div>
        {showComps ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </div>

      {showComps && compsData && (
        <div className="p-6 bg-white/60 space-y-6">
          <div className="bg-slate-100/50 border border-slate-200 p-4 rounded-xl">
            <p className="text-sm text-slate-700 italic border-l-4 border-indigo-500 pl-3">
              "{compsData.rationale}"
            </p>
          </div>

          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex justify-between">
              <span>Pricing Strategy</span>
              <span className="text-indigo-600">
                Est. Time to Sell: {getEstimatedDaysToSell()} Days
              </span>
            </h4>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => applyPricingStrategy("QUICK_SALE")}
                className={`px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  pricingStrategy === "QUICK_SALE"
                    ? "bg-white shadow-sm text-indigo-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Quick Sale
              </button>
              <button
                onClick={() => applyPricingStrategy("MARKET")}
                className={`px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  pricingStrategy === "MARKET"
                    ? "bg-white shadow-sm text-emerald-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Market (Median)
              </button>
              <button
                onClick={() => applyPricingStrategy("MAX_PROFIT")}
                className={`px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  pricingStrategy === "MAX_PROFIT"
                    ? "bg-white shadow-sm text-indigo-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Max Profit
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div
              onClick={() => applyPricingStrategy("QUICK_SALE")}
              className={`cursor-pointer transition-all ${
                pricingStrategy === "QUICK_SALE"
                  ? "ring-2 ring-indigo-400 shadow-md scale-105 z-10"
                  : "border-slate-200 shadow-sm hover:border-slate-300"
              } bg-white border p-4 rounded-xl text-center`}
            >
              <span
                className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
                  pricingStrategy === "QUICK_SALE"
                    ? "text-indigo-600"
                    : "text-slate-500"
                }`}
              >
                Low
              </span>
              <span className="text-xl font-bold text-slate-700">
                ${compsData.lowPrice}
              </span>
            </div>
            <div
              onClick={() => applyPricingStrategy("MARKET")}
              className={`cursor-pointer transition-all ${
                pricingStrategy === "MARKET"
                  ? "ring-2 ring-emerald-500 shadow-md scale-105 z-10"
                  : "border-emerald-200 shadow-sm hover:border-emerald-300"
              } bg-emerald-50 border p-4 rounded-xl text-center relative overflow-hidden`}
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500"></div>
              <span
                className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
                  pricingStrategy === "MARKET"
                    ? "text-emerald-700"
                    : "text-emerald-600/70"
                }`}
              >
                Median
              </span>
              <span className="text-2xl font-black text-emerald-700">
                ${compsData.suggestedPrice}
              </span>
            </div>
            <div
              onClick={() => applyPricingStrategy("MAX_PROFIT")}
              className={`cursor-pointer transition-all ${
                pricingStrategy === "MAX_PROFIT"
                  ? "ring-2 ring-indigo-400 shadow-md scale-105 z-10"
                  : "border-slate-200 shadow-sm hover:border-slate-300"
              } bg-white border p-4 rounded-xl text-center`}
            >
              <span
                className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
                  pricingStrategy === "MAX_PROFIT"
                    ? "text-indigo-600"
                    : "text-slate-500"
                }`}
              >
                High
              </span>
              <span className="text-xl font-bold text-slate-700">
                ${compsData.highPrice}
              </span>
            </div>
          </div>

          {compsData.platformBreakdown && compsData.platformBreakdown.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Platform Breakdown
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {compsData.platformBreakdown.map((platform, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200 px-3 py-2.5 rounded-lg flex flex-col items-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                  >
                    <span className="text-xs font-semibold text-slate-600">
                      {platform.platform}
                    </span>
                    <span className="text-base font-bold text-slate-900">
                      ${platform.averagePrice}
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5">
                      {platform.sampleCount} comps
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {((compsData.sources && compsData.sources.length > 0) ||
            compsData.vendorLink) && (
            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Verified Sources
              </h4>
              <div className="space-y-2">
                {compsData.vendorLink && (
                  <a
                    href={compsData.vendorLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors group"
                  >
                    <div className="flex flex-col truncate pr-4">
                      <span className="text-xs font-semibold text-indigo-700 truncate">
                        {compsData.vendorLink.title}
                      </span>
                      <span className="text-[10px] text-indigo-500">
                        Official Vendor
                      </span>
                    </div>
                  </a>
                )}
                {compsData.sources &&
                  compsData.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all group"
                    >
                      <div className="truncate pr-4 flex-1">
                        <span className="text-xs font-medium text-slate-700 group-hover:text-indigo-600 transition-colors truncate block">
                          {src.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                          {src.platform}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {src.price}
                        </span>
                      </div>
                    </a>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
      {showComps && !compsData && (
        <div className="p-8 text-center text-slate-500 flex flex-col items-center bg-white/60">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-300 mb-2" />
          <span className="text-sm">Fetching market comps...</span>
        </div>
      )}
    </section>
  );
}
