"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, Camera, Loader2, Download, Home, Package, Settings } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { handleImageUploadUtility } from "@/lib/uploadImage";
import { sanitizeEbayText } from "@/lib/sanitize";
import { createClient } from "@/lib/supabase/client";
import { generateEbayCSV } from "@/lib/exporters/ebay";
import { generateWhatnotCSV } from "@/lib/exporters/whatnot";
import { SettingsModal } from "@/components/SettingsModal";
import { Navbar } from "@/components/Navbar";
import { Profile, MasterItem } from "@/types/inventory";

export default function BatchPage() {
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [listings, setListings] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (listings.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const listingsToSave = listings.map(l => ({
          id: l.id || undefined,
          user_id: user.id,
          title: l.title || "Untitled Bulk Listing",
          description: l.description || "",
          price: l.price ? parseFloat(String(l.price).replace(/[^0-9.]/g, '')) || 0 : 0,
          condition: l.condition || "4000",
          category: l.category || "Unknown",
          specifics: {
            brand: l.brand || "",
            department: l.department || "",
            size: l.size || "",
            color: l.color || "",
            sizeType: l.sizeType || "",
            weightOz: l.weightOz || "",
            item_specifics: l.item_specifics || [],
          },
          photos: l.photos || [],
        }));

        const { data, error } = await supabase
          .from("listings")
          .upsert(listingsToSave, { onConflict: "id" })
          .select("id, title, photos");

        if (error) {
          console.error("Error saving batch listings:", error);
        } else if (data && data.length > 0) {
          const updatedListings = listings.map((l) => {
            if (l.id) return l;
            const savedItem = data.find((d: any) => d.title === l.title && d.photos.join(",") === (l.photos || []).join(","));
            return {
              ...l,
              id: savedItem ? savedItem.id : undefined
            };
          });
          
          const hasNewIds = updatedListings.some((l, idx) => l.id !== listings[idx].id);
          if (hasNewIds) {
            setListings(updatedListings);
          }
        }
      } catch (err) {
        console.error("Failed to auto-save batch listings:", err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [listings]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const newUrls: string[] = [];

      await handleImageUploadUtility(
        newFiles,
        (url) => newUrls.push(url)
      );

      if (newUrls.length > 0) {
        setImages((prev) => [...prev, ...newUrls]);
      }
    }
  };

  const handleClusterImages = async () => {
    if (images.length === 0) return;
    setIsAnalyzing(true);
    try {
      const res = await axios.post("/api/generate-batch", { images });
      if (res.data && Array.isArray(res.data)) {
        setListings(res.data);
      }
    } catch (error) {
      console.error("Clustering failed", error);
      alert("Failed to cluster images. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportCSV = async (platform: "ebay" | "whatnot") => {
    if (listings.length === 0) return;

    const items: MasterItem[] = listings.map((l, idx) => ({
      id: l.id || `temp-id-${idx}`,
      title: l.title || "",
      description: l.description || "",
      price: l.price || "19.99",
      category: l.category || "",
      categoryId: l.categoryId || "260010",
      condition: l.condition || "4000",
      photos: l.photos || [],
      brand: l.brand,
      size: l.size,
      color: l.color,
      department: l.department,
      weightOz: l.weightOz,
      sizeType: l.sizeType,
    }));

    let csvContent = "";

    if (platform === "ebay") {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      let userProfile: Profile = {
        id: "",
        user_id: user?.id || "",
        ai_credits_used: 0,
        updated_at: "",
        default_postal_code: process.env.NEXT_PUBLIC_DEFAULT_POSTAL_CODE || "49286",
        default_shipping_profile: "158932641011",
        default_return_policy: "158932641012",
        default_handling_time: "1",
        default_payment_policy: "158932641013",
      };

      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
        if (data) {
          userProfile = { ...userProfile, ...data };
        }
      }

      csvContent = generateEbayCSV(items, userProfile);
    } else {
      csvContent = generateWhatnotCSV(items);
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${platform}_bulk_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 selection:bg-indigo-100">
      <Navbar mode="batch" onSettingsClick={() => setIsSettingsOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Batch Upload Pool</h2>
              <p className="text-sm text-slate-500">Upload all your photos for this session. AI will automatically group them into distinct items.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>Add Photos</span>
              </button>
              <input
                type="file"
                accept="image/*"
                multiple
                ref={fileInputRef}
                className="hidden"
                onChange={handleImageUpload}
              />
              
              <button
                onClick={handleClusterImages}
                disabled={images.length === 0 || isAnalyzing}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                <span>{isAnalyzing ? "Clustering..." : "Auto-Group Items"}</span>
              </button>
            </div>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2 mb-4">
              {images.map((src, idx) => (
                <div key={idx} className="aspect-square relative rounded-lg overflow-hidden border border-slate-200">
                  <img src={src} alt="Upload" className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">{idx}</div>
                </div>
              ))}
            </div>
          )}

          {isAnalyzing && (
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl flex items-center gap-3 mt-4 border border-blue-100">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-sm font-medium">AI is analyzing and clustering {images.length} photos into distinct listings...</p>
            </div>
          )}
        </section>

        {listings.length > 0 && (
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-lg font-bold text-slate-800">Generated Queue ({listings.length})</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExportCSV('ebay')}
                  className="flex items-center space-x-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>eBay CSV</span>
                </button>
                <button
                  onClick={() => handleExportCSV('whatnot')}
                  className="flex items-center space-x-2 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-100 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Whatnot CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Thumbnail</th>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Photos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listings.map((listing, idx) => (
                    <tr key={listing.id || idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                          {listing.photos && listing.photos[0] && (
                            <img src={listing.photos[0]} alt="thumb" className="w-full h-full object-cover" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 max-w-[300px] truncate" title={listing.title}>
                        {listing.title}
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">
                        {listing.category} <span className="text-xs opacity-70">({listing.categoryId})</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-600">
                        ${listing.price}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-600">
                          {listing.photos?.length || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
