import React from "react";
import { Package } from "lucide-react";

interface ShippingSectionProps {
  shippingType: string;
  setShippingType: (val: string) => void;
  shippingPaidBy: string;
  setShippingPaidBy: (val: string) => void;
  shippingCost: string;
  setShippingCost: (val: string) => void;
  shippingService: string;
  setShippingService: (val: string) => void;
  eisEnabled: boolean;
  setEisEnabled: (val: boolean) => void;
  weightLbs: string;
  setWeightLbs: (val: string) => void;
  weightOz: string;
  setWeightOz: (val: string) => void;
  dimLength: string;
  setDimLength: (val: string) => void;
  dimWidth: string;
  setDimWidth: (val: string) => void;
  dimHeight: string;
  setDimHeight: (val: string) => void;
}

export function ShippingSection({
  shippingType,
  setShippingType,
  shippingPaidBy,
  setShippingPaidBy,
  shippingCost,
  setShippingCost,
  shippingService,
  setShippingService,
  eisEnabled,
  setEisEnabled,
  weightLbs,
  setWeightLbs,
  weightOz,
  setWeightOz,
  dimLength,
  setDimLength,
  dimWidth,
  setDimWidth,
  dimHeight,
  setDimHeight
}: ShippingSectionProps) {
  return (
    <div className="mt-8 pt-6 border-t border-slate-200">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
        <Package className="w-4 h-4" />
        Shipping & Logistics
      </h3>

      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            onClick={() => {
              setShippingType("CALCULATED");
              setShippingPaidBy("buyer");
            }}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              shippingType === "CALCULATED"
                ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  shippingType === "CALCULATED" ? "bg-indigo-500" : "bg-slate-300"
                }`}
              ></div>
              <span
                className={`text-sm font-bold ${
                  shippingType === "CALCULATED"
                    ? "text-indigo-800"
                    : "text-slate-700"
                }`}
              >
                Buyer Pays Calculated
              </span>
            </div>
            <p className="text-[10px] text-slate-500 ml-5 leading-tight">
              Buyer pays exact carrier rates based on their location. $0 cost to
              you.
            </p>
          </div>

          <div
            onClick={() => {
              setShippingType("FREE");
              setShippingPaidBy("seller");
            }}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              shippingType === "FREE"
                ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-500"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  shippingType === "FREE" ? "bg-emerald-500" : "bg-slate-300"
                }`}
              ></div>
              <span
                className={`text-sm font-bold ${
                  shippingType === "FREE" ? "text-emerald-800" : "text-slate-700"
                }`}
              >
                Free Shipping (Seller Pays)
              </span>
            </div>
            <p className="text-[10px] text-slate-500 ml-5 leading-tight">
              Shipping cost is built into your item price. You pay carrier fees
              when sold.
            </p>
          </div>

          <div
            onClick={() => {
              setShippingType("FLAT");
              setShippingPaidBy("buyer");
            }}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              shippingType === "FLAT"
                ? "bg-amber-50 border-amber-300 ring-1 ring-amber-500"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  shippingType === "FLAT" ? "bg-amber-500" : "bg-slate-300"
                }`}
              ></div>
              <span
                className={`text-sm font-bold ${
                  shippingType === "FLAT" ? "text-amber-800" : "text-slate-700"
                }`}
              >
                Flat Rate Shipping
              </span>
            </div>
            <p className="text-[10px] text-slate-500 ml-5 leading-tight">
              Charge a fixed amount to all buyers regardless of location.
            </p>
          </div>
        </div>

        {shippingType === "FLAT" && (
          <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-lg border border-amber-200">
            <label className="text-xs font-bold text-amber-800">
              Flat Rate Cost: $
            </label>
            <input
              type="number"
              step="0.01"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              className="w-24 px-3 py-1.5 rounded-md border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Carrier & Service
            </label>
            <select
              value={shippingService}
              onChange={(e) => setShippingService(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
            >
              <option value="USPS Ground Advantage">USPS Ground Advantage</option>
              <option value="USPS Priority Mail">USPS Priority Mail</option>
              <option value="FedEx Home Delivery">FedEx Home Delivery</option>
              <option value="UPS Ground">UPS Ground</option>
            </select>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="eisToggle"
                checked={eisEnabled}
                onChange={(e) => setEisEnabled(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="eisToggle"
                className="text-xs font-medium text-slate-700"
              >
                Enable eBay International Shipping (EIS)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Package Weight & Dims
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                value={weightLbs}
                onChange={(e) => setWeightLbs(e.target.value)}
                className="w-16 px-2 py-1.5 border border-slate-300 rounded-md text-sm"
              />
              <span className="text-xs text-slate-500">lbs</span>
              <input
                type="number"
                value={weightOz}
                onChange={(e) => setWeightOz(e.target.value)}
                className="w-16 px-2 py-1.5 border border-slate-300 rounded-md text-sm ml-2"
              />
              <span className="text-xs text-slate-500">oz</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="L"
                value={dimLength}
                onChange={(e) => setDimLength(e.target.value)}
                className="w-14 px-2 py-1.5 border border-slate-300 rounded-md text-sm text-center"
              />
              <span className="text-xs text-slate-400">x</span>
              <input
                type="number"
                placeholder="W"
                value={dimWidth}
                onChange={(e) => setDimWidth(e.target.value)}
                className="w-14 px-2 py-1.5 border border-slate-300 rounded-md text-sm text-center"
              />
              <span className="text-xs text-slate-400">x</span>
              <input
                type="number"
                placeholder="H"
                value={dimHeight}
                onChange={(e) => setDimHeight(e.target.value)}
                className="w-14 px-2 py-1.5 border border-slate-300 rounded-md text-sm text-center"
              />
              <span className="text-xs text-slate-500">in</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 text-slate-200 p-4 rounded-xl flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                Estimated Carrier Cost
              </p>
              <p className="text-sm font-medium">
                Est. Buyer Cost:{" "}
                <span className="text-white font-bold">$4.50 – $9.20</span> (Zone
                dependent)
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
              Your Net Shipping Cost
            </p>
            <p
              className={`text-lg font-bold ${
                shippingPaidBy === "buyer" ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {shippingPaidBy === "buyer" ? "$0.00" : "Varies"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
