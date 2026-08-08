"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Camera,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import { handleImageUploadUtility } from "@/lib/uploadImage";
import { createClient } from "@/lib/supabase/client";
import { generateEbayCSV } from "@/lib/exporters/ebay";
import { generateWhatnotCSV } from "@/lib/exporters/whatnot";
import { SettingsModal } from "@/components/SettingsModal";
import { Navbar } from "@/components/Navbar";
import { Profile, MasterItem } from "@/types/inventory";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Cluster {
  photo_indices: number[];
}

type ProcessingStage =
  | "idle"
  | "clustering"
  | "generating"
  | "done"
  | "error";

// ─── Component ───────────────────────────────────────────────────────────────

export default function BatchPage() {
  const [images, setImages] = useState<string[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Profile policy IDs — loaded on mount, mirrors Single Mode ───────────
  // These are kept in state so handleExportCSV always has the real values
  // even if the in-export Supabase fetch returns null/empty.
  const [shippingProfileId, setShippingProfileId] = useState("");
  const [returnProfileId, setReturnProfileId] = useState("");
  const [paymentProfileId, setPaymentProfileId] = useState("");

  // ── Auto-save listings to Supabase (debounced 1 s) ──────────────────────
  // Load business-policy IDs from Supabase on mount (same pattern as Single Mode)
  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("default_shipping_profile, default_return_policy, default_payment_policy")
        .eq("user_id", user.id)
        .single();
      if (data) {
        if (data.default_shipping_profile) setShippingProfileId(data.default_shipping_profile);
        if (data.default_return_policy) setReturnProfileId(data.default_return_policy);
        if (data.default_payment_policy) setPaymentProfileId(data.default_payment_policy);
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    if (listings.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const listingsToSave = listings.map((l) => ({
          id: l.id || undefined,
          user_id: user.id,
          title: l.title || "Untitled Bulk Listing",
          description: l.description || "",
          price: l.price
            ? parseFloat(String(l.price).replace(/[^0-9.]/g, "")) || 0
            : 0,
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
          setListings((prev) =>
            prev.map((l) => {
              if (l.id) return l;
              const saved = data.find(
                (d: any) =>
                  d.title === l.title &&
                  d.photos.join(",") === (l.photos || []).join(",")
              );
              return saved ? { ...l, id: saved.id } : l;
            })
          );
        }
      } catch (err) {
        console.error("Failed to auto-save batch listings:", err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [listings]);

  // ── Image upload ─────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    const newUrls: string[] = [];
    await handleImageUploadUtility(newFiles, (url) => newUrls.push(url));
    if (newUrls.length > 0) setImages((prev) => [...prev, ...newUrls]);
  };

  // ── Two-stage batch processing ────────────────────────────────────────────

  /**
   * Stage 1: POST all images to /api/cluster to get photo groupings.
   * Stage 2: For each cluster, POST to /api/generate-single sequentially.
   *          Completed drafts are appended to state immediately.
   */
  const handleProcess = async () => {
    if (images.length === 0) return;

    setStage("clustering");
    setErrorMsg(null);
    setListings([]);
    setProgress({ current: 0, total: 0 });

    // ── Stage 1: Cluster ──────────────────────────────────────────────────
    let clusters: Cluster[];
    try {
      const { data } = await axios.post<{ clusters: Cluster[] }>(
        "/api/cluster",
        { images }
      );
      clusters = data.clusters;
      if (!clusters?.length) throw new Error("No clusters returned.");
    } catch (err: any) {
      console.error("Clustering failed:", err);
      setErrorMsg(
        err?.response?.data?.error ??
          "Failed to group photos into items. Please try again."
      );
      setStage("error");
      return;
    }

    // ── Stage 2: Generate listings one-by-one ────────────────────────────
    setStage("generating");
    setProgress({ current: 0, total: clusters.length });

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const clusterPhotos = cluster.photo_indices
        .map((idx) => images[idx])
        .filter(Boolean);

      try {
        const { data: listing } = await axios.post(
          "/api/generate-single",
          { photos: clusterPhotos }
        );

        // Ensure the batch pipeline assigns the primary/first item photo as the headline cover photo
        if (listing && Array.isArray(listing.photos) && clusterPhotos[0]) {
          const firstPhoto = clusterPhotos[0];
          listing.photos = [
            firstPhoto,
            ...listing.photos.filter((p: string) => p !== firstPhoto),
          ];
        }

        setListings((prev) => [...prev, listing]);
      } catch (err: any) {
        console.error(`generate-single failed for cluster ${i}:`, err);
        // Append a placeholder so the user knows something went wrong for this item
        setListings((prev) => [
          ...prev,
          {
            id: `error-${i}`,
            title: `⚠ Item ${i + 1} — generation failed`,
            photos: clusterPhotos,
            price: "",
            category: "",
            categoryId: "",
            condition: "4000",
          },
        ]);
      }

      setProgress({ current: i + 1, total: clusters.length });
    }

    setStage("done");
  };

  // ── CSV export ───────────────────────────────────────────────────────────
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Baseline: use the policy IDs already loaded into state on mount.
      // This guarantees non-empty values even if the in-export fetch below
      // returns null (new account, RLS issue, empty row, etc.).
      let userProfile: Profile = {
        id: "",
        user_id: user?.id || "",
        ai_credits_used: 0,
        updated_at: "",
        default_postal_code: process.env.NEXT_PUBLIC_DEFAULT_POSTAL_CODE || "49286",
        default_shipping_profile: shippingProfileId || "158932641011",
        default_return_policy:    returnProfileId   || "158932641012",
        default_handling_time: "1",
        default_payment_policy:   paymentProfileId  || "158932641013",
      };

      // Attempt a fresh fetch to pick up any profile edits made this session.
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        // Spread only truthy policy fields so we never overwrite a good
        // state value with an empty string from the DB.
        if (data) {
          userProfile = {
            ...userProfile,
            ...data,
            default_shipping_profile: data.default_shipping_profile || userProfile.default_shipping_profile,
            default_return_policy:    data.default_return_policy    || userProfile.default_return_policy,
            default_payment_policy:   data.default_payment_policy   || userProfile.default_payment_policy,
          };
        }
      }
      csvContent = generateEbayCSV(items, userProfile);
    } else {
      csvContent = generateWhatnotCSV(items);
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${platform}_bulk_export.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Derived state helpers ─────────────────────────────────────────────────
  const isRunning = stage === "clustering" || stage === "generating";
  const buttonLabel =
    stage === "clustering"
      ? "Grouping Photos…"
      : stage === "generating"
      ? `Processing ${progress.current} of ${progress.total}…`
      : "Auto-Group & Generate";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 selection:bg-indigo-100">
      <Navbar mode="batch" onSettingsClick={() => setIsSettingsOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Upload pool ── */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Batch Upload Pool
              </h2>
              <p className="text-sm text-slate-500">
                Upload all photos for this session. AI will automatically group
                them into distinct items.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRunning}
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
                onClick={handleProcess}
                disabled={images.length === 0 || isRunning}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
              >
                {isRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span>{buttonLabel}</span>
              </button>
            </div>
          </div>

          {/* Photo strip */}
          {images.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2 mb-4">
              {images.map((src, idx) => (
                <div
                  key={idx}
                  className="aspect-square relative rounded-lg overflow-hidden border border-slate-200"
                >
                  <img
                    src={src}
                    alt={`Upload ${idx}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">
                    {idx}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Progress banner */}
          {stage === "clustering" && (
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl flex items-center gap-3 mt-4 border border-blue-100">
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              <p className="text-sm font-medium">
                Step 1 of 2 — Grouping {images.length} photos into items…
              </p>
            </div>
          )}

          {stage === "generating" && (
            <div className="bg-indigo-50 text-indigo-800 p-4 rounded-xl flex items-center gap-3 mt-4 border border-indigo-100">
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Step 2 of 2 — Generating listing{" "}
                  <span className="font-bold">
                    {progress.current + 1}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold">{progress.total}</span>…
                </p>
                {/* Simple progress bar */}
                <div className="mt-2 h-1.5 w-full bg-indigo-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        progress.total > 0
                          ? (progress.current / progress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {stage === "done" && (
            <div className="bg-green-50 text-green-800 p-4 rounded-xl flex items-center gap-3 mt-4 border border-green-100">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">
                All {listings.length} listing{listings.length !== 1 ? "s" : ""}{" "}
                generated successfully.
              </p>
            </div>
          )}

          {stage === "error" && errorMsg && (
            <div className="bg-red-50 text-red-800 p-4 rounded-xl flex items-center gap-3 mt-4 border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
          )}
        </section>

        {/* ── Generated queue ── */}
        {listings.length > 0 && (
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-lg font-bold text-slate-800">
                Generated Queue ({listings.length}
                {isRunning && progress.total > 0
                  ? ` / ${progress.total}`
                  : ""}
                )
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExportCSV("ebay")}
                  disabled={isRunning}
                  className="flex items-center space-x-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>eBay CSV</span>
                </button>
                <button
                  onClick={() => handleExportCSV("whatnot")}
                  disabled={isRunning}
                  className="flex items-center space-x-2 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-100 transition-colors disabled:opacity-50"
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
                    <tr
                      key={listing.id || idx}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                          {listing.photos?.[0] && (
                            <img
                              src={listing.photos[0]}
                              alt="thumb"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 font-medium text-slate-900 max-w-[300px] truncate"
                        title={listing.title}
                      >
                        {listing.title}
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">
                        {listing.category}{" "}
                        <span className="text-xs opacity-70">
                          ({listing.categoryId})
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-600">
                        {listing.price ? `$${listing.price}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-600">
                          {listing.photos?.length ?? 0}
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

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
