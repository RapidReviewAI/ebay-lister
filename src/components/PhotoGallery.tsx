import React, { RefObject } from "react";
import { Camera, Upload, X, RefreshCw, Wand2, Activity } from "lucide-react";

interface PhotoGalleryProps {
  images: string[];
  photoRoles: string[];
  isAnalyzing: boolean;
  removingBgIndex: number | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeImage: (index: number) => void;
  handleRemoveBg: (index: number) => void;
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => void;
  triggerIdentify: (deepInspection: boolean) => void;
  identification: any;
  error: string | null;
  canvasBg: string;
  setCanvasBg: (color: string) => void;
}

export function PhotoGallery({
  images,
  photoRoles,
  isAnalyzing,
  removingBgIndex,
  fileInputRef,
  handleImageUpload,
  removeImage,
  handleRemoveBg,
  handleDragStart,
  handleDragOver,
  handleDrop,
  triggerIdentify,
  identification,
  error,
  canvasBg,
  setCanvasBg
}: PhotoGalleryProps) {
  return (
    <section className="glass rounded-2xl p-6 shadow-xl shadow-slate-200/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700 flex items-center gap-2">
          <Camera className="w-4 h-4" />
          Product Media ({images.length}/8)
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
          {images.length > 0 && (
            <div className="flex items-center text-xs text-slate-500 font-semibold bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setCanvasBg('transparent')}
                className={`px-3 py-1.5 rounded-md transition-colors ${canvasBg === 'transparent' ? 'bg-white shadow-sm text-slate-800' : 'hover:bg-slate-200'}`}
              >
                Clear
              </button>
              <button
                onClick={() => setCanvasBg('#FFFFFF')}
                className={`px-3 py-1.5 rounded-md transition-colors ${canvasBg === '#FFFFFF' ? 'bg-white shadow-sm text-slate-800' : 'hover:bg-slate-200'}`}
              >
                White
              </button>
              <button
                onClick={() => setCanvasBg('#F3F4F6')}
                className={`px-3 py-1.5 rounded-md transition-colors ${canvasBg === '#F3F4F6' ? 'bg-white shadow-sm text-slate-800' : 'hover:bg-slate-200'}`}
              >
                Light
              </button>
              <button
                onClick={() => setCanvasBg('#1F2937')}
                className={`px-3 py-1.5 rounded-md transition-colors ${canvasBg === '#1F2937' ? 'bg-slate-800 shadow-sm text-white' : 'hover:bg-slate-200'}`}
              >
                Dark
              </button>
            </div>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= 8 || isAnalyzing}
            className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-indigo-100 hover:shadow-md transition-all duration-200 disabled:opacity-50"
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
        </div>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3">
          {images.map((src, idx) => {
            const roleBadgeMap: Record<string, { label: string; color: string }> = {
              hero: { label: "Main Thumbnail", color: "bg-emerald-500" },
              tag_label: { label: "Brand Tag", color: "bg-indigo-500" },
              angle_detail: { label: "Angle", color: "bg-slate-500" },
              flaw: { label: "Flaw", color: "bg-red-500" },
            };
            const role = photoRoles[idx];

            return (
              <div
                key={idx}
                className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing"
                draggable={!isAnalyzing && removingBgIndex !== idx}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx)}
              >
                <img
                  src={src}
                  alt={`Upload ${idx}`}
                  style={{ backgroundColor: canvasBg !== 'transparent' ? canvasBg : undefined }}
                  className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                    canvasBg === 'transparent' ? 'bg-[url("data:image/svg+xml,%3Csvg width=\'12\' height=\'12\' viewBox=\'0 0 12 12\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h6v6H0V0zm6 6h6v6H6V6z\' fill=\'%23f0f0f0\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")]' : ''
                  } ${
                    removingBgIndex === idx ? "opacity-50" : ""
                  }`}
                />

                {role && roleBadgeMap[role] && !isAnalyzing && (
                  <div
                    className={`absolute top-2 left-2 px-2 py-1 text-[9px] font-bold text-white rounded shadow-sm ${roleBadgeMap[role].color}`}
                  >
                    {roleBadgeMap[role].label}
                  </div>
                )}

                {isAnalyzing && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="w-full h-1 bg-indigo-400 animate-scan blur-[2px] opacity-70"></div>
                  </div>
                )}

                {removingBgIndex === idx && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm z-10">
                    <RefreshCw className="w-8 h-8 text-white animate-spin mb-2" />
                    <span className="text-white text-xs font-semibold drop-shadow-md">Cleaning...</span>
                  </div>
                )}

                {!removingBgIndex && !isAnalyzing && (
                  <div className="absolute top-0 right-0 p-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-2 z-10">
                    <button
                      onClick={() => removeImage(idx)}
                      className="bg-slate-900/70 text-white rounded-full p-2 backdrop-blur-md hover:bg-red-500 active:bg-red-600 transition-colors shadow-sm"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveBg(idx)}
                      className="bg-slate-900/70 text-white rounded-full p-2 backdrop-blur-md hover:bg-indigo-500 active:bg-indigo-600 transition-colors shadow-sm"
                      title="Clean background"
                    >
                      <Wand2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 bg-slate-50/50">
          <Camera className="w-10 h-10 mb-3 text-slate-400" />
          <p className="font-medium text-slate-600">No photos added yet</p>
          <p className="text-sm mt-1 text-slate-400 text-center">
            Upload up to 8 images to automatically generate your listing.
          </p>
        </div>
      )}

      {images.length > 0 && !identification && !error && (
        <button
          onClick={() => triggerIdentify(false)}
          disabled={isAnalyzing}
          className="mt-6 w-full bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-600/30 disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-none transition-all duration-200 flex items-center justify-center space-x-2 group"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-200" />
              <span>Scanning & Identifying...</span>
            </>
          ) : (
            <>
              <Activity className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Generate Listing</span>
            </>
          )}
        </button>
      )}
    </section>
  );
}
