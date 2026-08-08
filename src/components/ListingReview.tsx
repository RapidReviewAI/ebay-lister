"use client";

import React, { useState } from "react";

interface ListingReviewProps {
  item: any;
  onUpdate: (updatedItem: any) => void;
  onClose?: () => void;
}

export default function ListingReview({ item, onUpdate, onClose }: ListingReviewProps) {
  const [showPreview, setShowPreview] = useState(false);

  // Helper to extract values from the item_specifics array if top-level fields are missing
  const getSpec = (name: string) => {
    if (item[name.toLowerCase()]) return item[name.toLowerCase()];
    const spec = item.item_specifics?.find(
      (s: any) => s.name.toLowerCase() === name.toLowerCase()
    );
    return spec ? spec.value : "N/A";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-slate-900">Listing Review</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        )}
      </div>

      {/* Title Section */}
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase">eBay Title (80 Chars Max)</label>
        <input
          type="text"
          value={item.title || ""}
          onChange={(e) => onUpdate({ ...item, title: e.target.value })}
          className="w-full p-3 border border-slate-200 rounded-lg mt-1 font-medium text-slate-800 bg-slate-50"
        />
        <p className="text-right text-xs text-gray-400 mt-1">
          {(item.title || "").length}/80
        </p>
      </div>

      {/* Financials & Condition */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Price (USD)</label>
          <input
            type="text"
            value={item.price || ""}
            onChange={(e) => onUpdate({ ...item, price: e.target.value })}
            className="w-full p-3 border border-slate-200 rounded-lg font-bold text-green-600 bg-slate-50"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Condition Code</label>
          <select
            value={item.condition || "4000"}
            onChange={(e) => onUpdate({ ...item, condition: e.target.value })}
            className="w-full p-3 border border-slate-200 rounded-lg text-slate-700 bg-slate-50"
          >
            <option value="1000">New (1000)</option>
            <option value="3000">Very Good (3000)</option>
            <option value="4000">Good (4000)</option>
            <option value="5000">Acceptable (5000)</option>
          </select>
        </div>
      </div>

      {/* Description Section with Toggle */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 font-medium"
          >
            {showPreview ? "Edit Code" : "Preview View"}
          </button>
        </div>

        {showPreview ? (
          <div
            className="w-full p-3 border border-slate-200 rounded-lg bg-white min-h-[150px] overflow-y-auto text-sm prose prose-sm"
            dangerouslySetInnerHTML={{ __html: item.description || "" }}
          />
        ) : (
          <textarea
            value={item.description || ""}
            onChange={(e) => onUpdate({ ...item, description: e.target.value })}
            className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-mono text-xs min-h-[150px]"
          />
        )}
      </div>

      {/* Item Specifics Grid - Fixed Mapping */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
        <h4 className="text-xs font-bold text-blue-800 uppercase mb-3">Item Specifics</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-blue-400 uppercase block">Brand</label>
            <p className="text-sm font-medium text-gray-900">{getSpec("Brand")}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-blue-400 uppercase block">Size</label>
            <p className="text-sm font-medium text-gray-900">{getSpec("Size")}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-blue-400 uppercase block">Color</label>
            <p className="text-sm font-medium text-gray-900">{getSpec("Color")}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-blue-400 uppercase block">Department</label>
            <p className="text-sm font-medium text-gray-900">{getSpec("Department")}</p>
          </div>
        </div>
      </div>

      {/* Listing Photos Review */}
      {item.photos && item.photos.length > 0 && (
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Listing Photos</label>
          <div className="grid grid-cols-3 gap-2">
            {item.photos.map((url: string, i: number) => (
              <img
                key={i}
                src={url}
                alt={`Photo ${i + 1}`}
                className="w-full aspect-square object-cover rounded-lg border border-slate-200"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
