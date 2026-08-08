"use client";

import React, { useState, useRef } from "react";
import { Upload, Camera, Loader2, Download, Home, Package } from "lucide-react";
import Link from "next/link";
import axios from "axios";

export default function BatchPage() {
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [listings, setListings] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const newUrls: string[] = [];

      for (const file of newFiles) {
        try {
          const compressedDataUrl = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              let { width, height } = img;
              const maxDimension = 1200;

              if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                  height = (height / width) * maxDimension;
                  width = maxDimension;
                } else {
                  width = (width / height) * maxDimension;
                  height = maxDimension;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                reject(new Error("Could not get 2d context"));
                return;
              }
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL("image/jpeg", 0.8));
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
          });

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: compressedDataUrl })
          });
          const uploadData = await uploadRes.json();

          if (uploadData.url) {
            newUrls.push(uploadData.url);
          }
        } catch (error) {
          console.error("Image compression failed:", error);
        }
      }

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

  const handleExportCSV = (platform: "ebay" | "whatnot") => {
    if (listings.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (platform === "ebay") {
      csvContent += "Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8),Category,Title,Description,ConditionID,PicURL,Quantity,Format,StartPrice,BuyItNowPrice,Duration,Location,ShippingProfileName,ReturnProfileName,PaymentProfileName\n";
      listings.forEach(listing => {
        const categoryId = String(listing.categoryId || '260010').replace(/[^0-9]/g, '');
        const title = (listing.title || "").substring(0, 80).replace(/"/g, '""');
        const description = (listing.description || "").replace(/"/g, '""');
        const condition = listing.condition || "4000";
        const pics = (listing.photos || []).join("|");
        const price = listing.price || "19.99";

        csvContent += `Add,${categoryId},"${title}","${description}",${condition},"${pics}",1,FixedPrice,,${price},GTC,US,,,,\n`;
      });
    } else {
      csvContent += "Title,Description,Price,Quantity,Category\n";
      listings.forEach(listing => {
        const title = (listing.title || "").substring(0, 80).replace(/"/g, '""');
        const description = (listing.description || "").replace(/"/g, '""');
        const price = listing.price || "19.99";
        const category = listing.category || "";
        csvContent += `"${title}","${description}",${price},1,"${category}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${platform}_bulk_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 selection:bg-indigo-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              Lister<span className="text-slate-900">Batch</span>
            </h1>
          </div>
          
          <nav className="flex items-center gap-2">
            <Link href="/" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2">
              <Home className="w-4 h-4" />
              Single Mode
            </Link>
            <div className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 rounded-lg flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Bulk Mode
            </div>
          </nav>
        </div>
      </header>

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
    </div>
  );
}
