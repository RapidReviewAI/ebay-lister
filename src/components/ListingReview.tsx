"use client";

import React, { useState } from "react";
import {
  Tag,
  DollarSign,
  Package,
  Sparkles,
  Layers,
  RotateCw,
  X,
  CheckCircle2,
} from "lucide-react";

interface ListingReviewProps {
  item: any;
  onUpdate: (updatedItem: any) => void;
  userProfile?: any;
  onClose?: () => void;
}

export default function ListingReview({
  item,
  onUpdate,
  userProfile,
  onClose,
}: ListingReviewProps) {
  const [showPreview, setShowPreview] = useState(false);

  console.log("FRANK DEBUG - Full Item Object:", JSON.stringify(item, null, 2));

  // Helper to normalize item_specifics as key-value pairs
  const getSpecificsEntries = (): [string, string][] => {
    if (!item.item_specifics) return [];

    // If it's already an array of [key, value] or [{name, value}]
    if (Array.isArray(item.item_specifics)) {
      return item.item_specifics.map((s: any) =>
        Array.isArray(s) ? [String(s[0]), String(s[1])] : [s.name || s.key || "Property", String(s.value ?? "")]
      );
    }

    // If it's a standard object { Brand: 'Topps' }
    if (typeof item.item_specifics === "object") {
      return Object.entries(item.item_specifics).map(([k, v]) => [k, String(v ?? "")]);
    }

    return [];
  };

  const specificsList = getSpecificsEntries();

  // Helper to handle updating specific by key or index
  const updateSpecificValue = (keyToUpdate: string, newValue: string, idx: number) => {
    if (!item.item_specifics) return;

    let newSpecifics: any;
    if (Array.isArray(item.item_specifics)) {
      const copy = [...item.item_specifics];
      if (copy[idx]) {
        copy[idx] = { ...copy[idx], value: newValue };
      } else {
        copy.push({ name: keyToUpdate, value: newValue });
      }
      newSpecifics = copy;
    } else {
      newSpecifics = { ...item.item_specifics, [keyToUpdate]: newValue };
    }

    const updated = { ...item, item_specifics: newSpecifics };
    // Also sync top level fields if matching
    const lowerKey = keyToUpdate.toLowerCase();
    if (lowerKey === "brand") updated.brand = newValue;
    if (lowerKey === "size") updated.size = newValue;
    if (lowerKey === "color") updated.color = newValue;
    if (lowerKey === "department") updated.department = newValue;

    onUpdate(updated);
  };

  // Rotation handler via Cloudinary transformations
  const handleRotate = () => {
    if (!item.photos || item.photos.length === 0) return;
    const currentPhotos = [...item.photos];
    const currentUrl = currentPhotos[0] || "";

    let newUrl = "";
    if (currentUrl.includes("a_90")) newUrl = currentUrl.replace("a_90", "a_180");
    else if (currentUrl.includes("a_180")) newUrl = currentUrl.replace("a_180", "a_270");
    else if (currentUrl.includes("a_270")) newUrl = currentUrl.replace("a_270", "a_0");
    else if (currentUrl.includes("/upload/")) newUrl = currentUrl.replace("/upload/", "/upload/a_90/");
    else newUrl = currentUrl;

    currentPhotos[0] = newUrl;
    onUpdate({ ...item, photos: currentPhotos });
  };

  // Cassini Strength Score Calculation (Strict Cassini Logic)
  const titleLen = (item.title || "").length;
  const titleScore = titleLen >= 75 ? 30 : Math.round((titleLen / 80) * 25);
  const priceScore = item.price && parseFloat(item.price) > 0 ? 10 : 0;
  const categoryScore = item.categoryId ? 10 : 0;
  const descScore = (item.description || "").length > 50 ? 10 : 5;

  // Cassini loves specifics. If you have Brand, Size, and Color, that's the baseline.
  const requiredKeys = ["brand", "size", "color", "department", "type"];
  const specsCount = specificsList.filter(([_, v]) => v && v !== "N/A" && v !== "").length;
  const essentialSpecsCount = specificsList.filter(([k, v]) => requiredKeys.includes(k.toLowerCase()) && v && v !== "N/A" && v !== "").length;
  const specsScore = (essentialSpecsCount * 8) + (Math.min(10, (specsCount - essentialSpecsCount) * 2));

  const totalScore = Math.min(100, titleScore + priceScore + categoryScore + descScore + specsScore);

  let strengthLabel = "Good";
  let strengthColor = "bg-amber-500 text-amber-50";
  if (totalScore >= 80) {
    strengthLabel = "Cassini Prime";
    strengthColor = "bg-emerald-600 text-emerald-50";
  } else if (totalScore < 50) {
    strengthLabel = "Needs Work";
    strengthColor = "bg-rose-500 text-rose-50";
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 shadow-2xl border-l border-slate-200 overflow-y-auto font-sans text-slate-800">
      {/* HEADER */}
      <div className="p-4 border-b border-slate-200 bg-white sticky top-0 z-10 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-900 text-white rounded-lg">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900 leading-tight">
              Listing Architect Review
            </h2>
            <p className="text-xs text-slate-500">Live eBay Cassini Optimizer</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* CASSINI STRENGTH METER CARD */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Cassini Rank Index</span>
            </div>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${strengthColor}`}>
              {strengthLabel} ({totalScore}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                totalScore >= 80 ? "bg-emerald-500" : totalScore >= 50 ? "bg-amber-500" : "bg-rose-500"
              }`}
              style={{ width: `${totalScore}%` }}
            />
          </div>
        </div>

        {/* HERO IMAGE & ROTATION */}
        <div className="relative group bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
          <img
            src={item.photos?.[0] || ""}
            className="w-full h-60 object-contain bg-slate-100 rounded-lg border border-slate-100"
            alt="Hero Preview"
          />
          <button
            type="button"
            onClick={handleRotate}
            className="absolute bottom-4 right-4 bg-slate-900/90 text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 transition text-xs font-semibold flex items-center gap-1.5 shadow-md backdrop-blur-xs"
            title="Rotate 90 Degrees"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rotate 90°</span>
          </button>
        </div>

        {/* TITLE SECTION */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              eBay Title (80 Chars Max)
            </label>
            <span className={`text-xs font-mono font-medium ${(item.title || "").length > 80 ? "text-rose-600 font-bold" : "text-slate-400"}`}>
              {(item.title || "").length}/80
            </span>
          </div>
          <input
            className="w-full p-3 border border-slate-200 rounded-lg font-medium text-slate-900 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-slate-50/50"
            value={item.title || "Untitled Bulk Listing"}
            maxLength={80}
            onChange={(e) => onUpdate({ ...item, title: e.target.value })}
          />
        </div>

        {/* 2-COLUMN GRID: PRICE & CATEGORY MAPPING */}
        <div className="grid grid-cols-2 gap-4">
          {/* PRICE INPUT */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Price (USD)</span>
            </label>
            <input
              className="w-full p-2.5 border border-slate-200 rounded-lg font-mono font-bold text-emerald-600 text-base focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-slate-50/50"
              value={item.price || ""}
              onChange={(e) => onUpdate({ ...item, price: e.target.value })}
            />
          </div>

          {/* CATEGORY ID INPUT */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              <span>Category ID</span>
            </label>
            <input
              className="w-full p-2.5 border border-slate-200 rounded-lg font-mono text-emerald-700 font-bold bg-slate-50 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              value={item.categoryId || ""}
              placeholder="e.g. 51959"
              onChange={(e) => onUpdate({ ...item, categoryId: e.target.value })}
            />
          </div>
        </div>

        {/* CATEGORY NAME BREADCRUMB MAPPING DISPLAY */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            <span>Target Category Taxonomy</span>
          </label>
          <input
            className="w-full p-2 border border-slate-200 rounded-lg font-medium text-slate-700 text-xs bg-slate-50/50"
            value={
              typeof item.category === "object"
                ? item.category?.breadcrumb || item.category?.name || "Collectibles > Non-Sport Trading Cards"
                : item.category || item.category_suggestion || "Collectibles > Non-Sport Trading Cards"
            }
            onChange={(e) => onUpdate({ ...item, category: e.target.value })}
          />
        </div>

        {/* DYNAMIC ITEM SPECIFICS GRID */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <CheckCircle2 className={`w-4 h-4 ${specsCount > 0 ? 'text-emerald-500' : 'text-amber-500'}`} />
              <span>Item Specifics ({specsCount})</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Editable Cassini Aspects</span>
          </div>

          {specificsList.length === 0 && (
            <div className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 font-medium">
              ⚠️ No specifics detected. Cassini visibility will be LOW.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {specificsList.map(([keyName, valStr], idx) => (
              <div key={keyName || idx} className="space-y-0.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase truncate block">
                  {keyName}
                </label>
                <input
                  className="w-full p-2 text-xs border border-slate-200 rounded-md font-medium text-slate-800 bg-slate-50/50 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  value={valStr || ""}
                  onChange={(e) => updateSpecificValue(keyName, e.target.value, idx)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* LOGISTICS & POLICIES */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2">
            Logistics & Business Policies
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Shipping Profile ID:</span>
              <input
                className="font-mono border border-slate-200 rounded px-2 py-1 text-right w-36 text-slate-800 bg-slate-50/50"
                value={item.shippingProfileID || userProfile?.default_shipping_profile || ""}
                onChange={(e) => onUpdate({ ...item, shippingProfileID: e.target.value })}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Return Policy ID:</span>
              <input
                className="font-mono border border-slate-200 rounded px-2 py-1 text-right w-36 text-slate-800 bg-slate-50/50"
                value={item.returnProfileID || userProfile?.default_return_policy || ""}
                onChange={(e) => onUpdate({ ...item, returnProfileID: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* PLAIN TEXT DESCRIPTION */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Description (Plain Text)
            </label>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-200 font-medium transition"
            >
              {showPreview ? "Edit Mode" : "Preview Mode"}
            </button>
          </div>

          {showPreview ? (
            <div className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50/30 min-h-[120px] text-xs leading-relaxed whitespace-pre-wrap text-slate-800">
              {item.description || ""}
            </div>
          ) : (
            <textarea
              className="w-full p-3 border border-slate-200 rounded-lg h-32 text-xs leading-relaxed bg-slate-50/50 text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              value={item.description || ""}
              onChange={(e) => onUpdate({ ...item, description: e.target.value })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
