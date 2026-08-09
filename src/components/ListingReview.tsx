"use client";

import React, { useState } from "react";

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

  // Helper to handle manual rotation via Cloudinary transformations
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

  const updateSpecific = (index: number, newValue: string) => {
    if (!item.item_specifics) return;
    const newSpecs = [...item.item_specifics];
    newSpecs[index] = { ...newSpecs[index], value: newValue };
    onUpdate({ ...item, item_specifics: newSpecs });
  };

  return (
    <div className="flex flex-col h-full bg-white shadow-xl border-l overflow-y-auto">
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center sticky top-0 z-10">
        <h2 className="font-bold text-lg text-gray-800">Final Listing Review</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 text-xl font-bold p-1 rounded transition"
          >
            ✕
          </button>
        )}
      </div>

      <div className="p-6 space-y-8">
        {/* IMAGE & ROTATION SECTION */}
        <div className="relative group">
          <img
            src={item.photos?.[0] || ""}
            className="w-full h-64 object-contain bg-gray-100 rounded-lg border"
            alt="Main Preview"
          />
          <button
            type="button"
            onClick={handleRotate}
            className="absolute bottom-2 right-2 bg-black/70 text-white px-3 py-1.5 rounded-full hover:bg-black transition text-xs font-bold flex items-center gap-1 shadow"
            title="Rotate 90 Degrees"
          >
            🔄 Rotate
          </button>
        </div>

        {/* CORE EBAY FIELDS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                eBay Title (80 Chars Max)
              </label>
              <span className="text-[10px] text-gray-400">
                {(item.title || "").length}/80
              </span>
            </div>
            <input
              className="w-full p-2 border rounded font-medium focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-800 text-sm"
              value={item.title || ""}
              maxLength={80}
              onChange={(e) => onUpdate({ ...item, title: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
              Price (USD)
            </label>
            <input
              className="w-full p-2 border rounded font-mono font-bold text-green-600 bg-gray-50 text-sm"
              value={item.price || ""}
              onChange={(e) => onUpdate({ ...item, price: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
              Category ID
            </label>
            <input
              className="w-full p-2 border rounded font-mono text-gray-700 bg-gray-50 text-sm"
              value={item.categoryId || ""}
              onChange={(e) => onUpdate({ ...item, categoryId: e.target.value })}
            />
          </div>
        </div>

        {/* ITEM SPECIFICS - THE CASSINI FUEL */}
        <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
          <h3 className="text-xs font-bold text-gray-600 uppercase mb-4">
            Item Specifics (Editable)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {item.item_specifics?.map((spec: any, idx: number) => (
              <div key={idx}>
                <label className="text-[9px] font-bold text-gray-400 uppercase block">
                  {spec.name}
                </label>
                <input
                  className="w-full p-1 text-sm border-b bg-transparent focus:border-blue-500 outline-none text-gray-800"
                  value={spec.value || ""}
                  onChange={(e) => updateSpecific(idx, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* LOGISTICS SECTION */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-xs font-bold text-gray-600 uppercase">
            Shipping & Policies
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-medium">Shipping Profile ID:</span>
              <input
                className="font-mono border-b w-36 text-right p-1 bg-transparent text-gray-800"
                value={item.shippingProfileID || userProfile?.default_shipping_profile || ""}
                onChange={(e) =>
                  onUpdate({ ...item, shippingProfileID: e.target.value })
                }
              />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-medium">Return Policy ID:</span>
              <input
                className="font-mono border-b w-36 text-right p-1 bg-transparent text-gray-800"
                value={item.returnProfileID || userProfile?.default_return_policy || ""}
                onChange={(e) =>
                  onUpdate({ ...item, returnProfileID: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* PLAIN TEXT DESCRIPTION WITH PREVIEW TOGGLE */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Description (Plain Text)
            </label>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 font-medium"
            >
              {showPreview ? "Edit Mode" : "Preview Mode"}
            </button>
          </div>

          {showPreview ? (
            <div className="w-full p-3 border rounded bg-white min-h-[128px] text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
              {item.description || ""}
            </div>
          ) : (
            <textarea
              className="w-full p-3 border rounded h-32 text-sm leading-relaxed bg-gray-50 text-gray-800"
              value={item.description || ""}
              onChange={(e) => onUpdate({ ...item, description: e.target.value })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
