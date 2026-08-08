"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, AlertCircle, RefreshCw, Package, Tag, Download, Home as HomeIcon, Settings } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { PhotoRole, PricingStrategy, Identification, CompsData, ItemSpecific } from "@/types/listing";
import { PhotoGallery } from "@/components/PhotoGallery";
import { MarketComps } from "@/components/MarketComps";
import { ShippingSection } from "@/components/ShippingSection";
import { handleImageUploadUtility } from "@/lib/uploadImage";
import { sanitizeEbayText } from "@/lib/sanitize";
import { createClient } from "@/lib/supabase/client";
import { generateEbayCSV } from "@/lib/exporters/ebay";
import { SettingsModal } from "@/components/SettingsModal";
import { Navbar } from "@/components/Navbar";
import { Profile, MasterItem } from "@/types/inventory";

export default function Home() {
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [canvasBg, setCanvasBg] = useState("transparent");
  const [publishedListing, setPublishedListing] = useState<{ url: string, message: string } | null>(null);
  const [isRefreshingDesc, setIsRefreshingDesc] = useState(false);
  const [descMode, setDescMode] = useState<"PREVIEW" | "EDIT">("PREVIEW");
  const [removingBgIndex, setRemovingBgIndex] = useState<number | null>(null);
  const [photoRoles, setPhotoRoles] = useState<string[]>([]);
  
  const [identification, setIdentification] = useState<Identification | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [compsData, setCompsData] = useState<CompsData | null>(null);
  const [showComps, setShowComps] = useState(true);
  const [pricingStrategy, setPricingStrategy] = useState<PricingStrategy>("MARKET");
  
  const [format, setFormat] = useState("FIXED_PRICE");
  const [bestOffer, setBestOffer] = useState(false);
  const [duration, setDuration] = useState("GTC");
  const [quantity, setQuantity] = useState("1");
  const [shippingType, setShippingType] = useState("CALCULATED");
  const [shippingCost, setShippingCost] = useState("0.00");
  const [handlingTime, setHandlingTime] = useState("1");
  const [weightLbs, setWeightLbs] = useState("0");
  const [weightOz, setWeightOz] = useState("0");
  const [shippingService, setShippingService] = useState("USPS Ground Advantage");
  const [shippingPaidBy, setShippingPaidBy] = useState("buyer");
  const [dimLength, setDimLength] = useState("0");
  const [dimWidth, setDimWidth] = useState("0");
  const [dimHeight, setDimHeight] = useState("0");
  const [eisEnabled, setEisEnabled] = useState(true);
  const [customSku, setCustomSku] = useState("");
  const [shippingProfileName, setShippingProfileName] = useState("");
  const [returnProfileName, setReturnProfileName] = useState("");
  const [paymentProfileName, setPaymentProfileName] = useState("");
  const [itemSpecifics, setItemSpecifics] = useState<ItemSpecific[]>([]);
  const [dbListingId, setDbListingId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        if (data.default_shipping_profile) setShippingProfileName(data.default_shipping_profile);
        if (data.default_return_policy) setReturnProfileName(data.default_return_policy);
        if (data.default_payment_policy) setPaymentProfileName(data.default_payment_policy);
        if (data.default_handling_time) setHandlingTime(data.default_handling_time);
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    if (!identification) return;

    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const payload = {
          id: dbListingId || undefined,
          user_id: user.id,
          title: identification.title || "Untitled Listing",
          description: identification.description || "",
          price: identification.price ? parseFloat(String(identification.price).replace(/[^0-9.]/g, '')) || 0 : 0,
          condition: identification.condition || "Used",
          category: identification.category || "Unknown",
          specifics: {
            brand: identification.brand || "",
            department: identification.department || "",
            size: identification.size || "",
            color: identification.color || "",
            sizeType: identification.sizeType || "",
            weightOz: identification.weightOz || "",
            item_specifics: itemSpecifics,
          },
          photos: images,
        };

        const { data, error } = await supabase
          .from("listings")
          .upsert(payload, { onConflict: "id" })
          .select()
          .single();

        if (error) {
          console.error("Error saving listing to Supabase:", error);
        } else if (data && !dbListingId) {
          setDbListingId(data.id);
        }
      } catch (err) {
        console.error("Failed to save listing to Supabase:", err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [identification, images, itemSpecifics, dbListingId]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const remainingSlots = 8 - images.length;
      const filesToProcess = newFiles.slice(0, remainingSlots);

      const newUrls: string[] = [];
      const newRoles: string[] = [];

      await handleImageUploadUtility(
        filesToProcess,
        (url) => {
          newUrls.push(url);
          newRoles.push("");
        }
      );

      if (newUrls.length > 0) {
        setImages((prev) => [...prev, ...newUrls]);
        setPhotoRoles((prev) => [...prev, ...newRoles]);
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPhotoRoles((prev) => prev.filter((_, i) => i !== index));
    if (images.length === 1) {
      setIdentification(null);
      setError(null);
      setCompsData(null);
      setPhotoRoles([]);
    }
  };

  const handleRemoveBg = async (index: number) => {
    setRemovingBgIndex(index);
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const src = images[index];
      
      const blob = await fetch(src).then(r => r.blob());
      const resultBlob = await removeBackground(blob, {
        model: "isnet"
      });
      
      const reader = new FileReader();
      const base64Url = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(resultBlob);
      });

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Url })
      });
      const uploadData = await uploadRes.json();
      
      if (uploadData.url) {
        setImages(prev => {
          const updated = [...prev];
          updated[index] = uploadData.url;
          return updated;
        });
      }
      setRemovingBgIndex(null);
    } catch (error) {
      console.error("Failed to remove background:", error);
      alert("Failed to remove background.");
      setRemovingBgIndex(null);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"));
    if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;

    setImages(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(sourceIndex, 1);
      result.splice(targetIndex, 0, removed);
      return result;
    });

    setPhotoRoles(prev => {
      const result = Array.from(prev);
      if (result.length > sourceIndex) {
        const [removed] = result.splice(sourceIndex, 1);
        result.splice(targetIndex, 0, removed);
      }
      return result;
    });
  };

  const triggerIdentify = async (deepInspection = false) => {
    if (images.length === 0) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await axios.post("/api/identify", { images, deepInspection });
      const data = res.data;
      
      if (!data.identified) {
        setError(data.unidentifiable_reason || "Could not identify the item clearly.");
        setIdentification(null);
        setCompsData(null);
        setPhotoRoles(new Array(images.length).fill(""));
      } else {
        data.conditionNeedsAttention = data.condition === 'NEEDS_REVIEW' || data.condition_confidence === 'low';
        setIdentification(data);
        setItemSpecifics(data.item_specifics || []);
        
        if (data.photo_roles && Array.isArray(data.photo_roles)) {
          const roleWeight: Record<string, number> = { 'hero': 0, 'tag_label': 1, 'angle_detail': 2, 'flaw': 3 };
          const sortedIndices = data.photo_roles.map((role: string, idx: number) => ({ role, idx })).sort((a: any, b: any) => {
             const weightA = roleWeight[a.role] ?? 4;
             const weightB = roleWeight[b.role] ?? 4;
             return weightA - weightB;
          });
          const newImages = sortedIndices.map((item: any) => images[item.idx]);
          const newRoles = sortedIndices.map((item: any) => item.role);
          setImages(newImages);
          setPhotoRoles(newRoles);
        }
        
        if (data.suggested_shipping_type) setShippingType(data.suggested_shipping_type.toUpperCase());
        if (data.suggested_paid_by) setShippingPaidBy(data.suggested_paid_by.toLowerCase());
        if (data.estimated_weight_lbs !== undefined) {
          const totalLbs = data.estimated_weight_lbs;
          setWeightLbs(Math.floor(totalLbs).toString());
          setWeightOz(Math.round((totalLbs - Math.floor(totalLbs)) * 16).toString());
        }
        
        if (data.key_search_keywords?.length > 0) {
          try {
            const compsRes = await axios.post("/api/comps", { 
              key_search_keywords: data.key_search_keywords,
              condition: data.condition
            });
            const comps = compsRes.data;
            setCompsData(comps);
            setIdentification((prev: any) => ({ ...prev, price: comps.suggestedPrice || "19.99" }));
          } catch (e) {
            console.error("Failed to fetch comps", e);
            setIdentification((prev: any) => ({ ...prev, price: "19.99" }));
          }
        } else {
            setIdentification((prev: any) => ({ ...prev, price: "19.99" }));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "An error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInputChange = (field: keyof Identification, value: string) => {
    if (identification) {
      const updates: any = { [field]: value };
      if (field === "condition") updates.conditionNeedsAttention = false;
      setIdentification({ ...identification, ...updates });
    }
  };

  const handleRegenerateDescription = async () => {
    if (!identification) return;
    setIsRefreshingDesc(true);
    try {
      const res = await axios.post("/api/description", {
        title: identification.title,
        condition: identification.condition,
        item_specifics: itemSpecifics
      });
      setIdentification({ ...identification, description: res.data.description });
    } catch (e: any) {
      console.error(e);
      alert("Failed to regenerate description: " + (e.response?.data?.error || e.message));
    } finally {
      setIsRefreshingDesc(false);
    }
  };

  const handleCopyHTML = () => {
    if (identification?.description) {
      navigator.clipboard.writeText(identification.description);
    }
  };

  const handleCopyText = () => {
    if (identification?.description) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = identification.description;
      const text = tempDiv.textContent || tempDiv.innerText || "";
      navigator.clipboard.writeText(text.trim());
    }
  };

  const applyPricingStrategy = (strategy: PricingStrategy) => {
    if (!compsData) return;
    setPricingStrategy(strategy);
    let newPrice = compsData.suggestedPrice;
    if (strategy === "MAX_PROFIT") newPrice = compsData.highPrice;
    if (strategy === "QUICK_SALE") newPrice = compsData.lowPrice;
    handleInputChange("price", newPrice);
  };

  const getEstimatedDaysToSell = () => {
    if (!compsData) return "--";
    const baseDays = compsData.estimatedDaysToSell || 14;
    if (pricingStrategy === "MAX_PROFIT") return baseDays + 14;
    if (pricingStrategy === "QUICK_SALE") return Math.max(1, baseDays - 7);
    return baseDays;
  };

  const updateItemSpecific = (index: number, field: string, value: string) => {
    const newSpecs = [...itemSpecifics];
    newSpecs[index] = { ...newSpecs[index], [field]: value };
    setItemSpecifics(newSpecs);
  };

  const addItemSpecific = () => {
    setItemSpecifics([...itemSpecifics, { name: "", value: "" }]);
  };

  const handleExportCSV = async () => {
    if (!identification) return;
    
    const validImages = images.filter((img) => typeof img === 'string' && img.trim().length > 0);
    const validPublicUrls = validImages
      .filter(url => url.startsWith("http://") || url.startsWith("https://"))
      .map(url => url.replace(/[,;]/g, '|'));

    if (validPublicUrls.length === 0 && images.length > 0) {
      alert("Please process images to get public HTTPS URLs before exporting to CSV. eBay does not accept local or blob URLs.");
      return;
    }

    const conditionId = identification.condition === "NEEDS_REVIEW" ? "" : (identification.condition || "");

    const resolveEbayLeafCategory = (inputCategory: any, title?: string): string => {
      const text = `${String(inputCategory || '')} ${String(title || '')}`.toLowerCase();
      const numericOnly = String(inputCategory || '').replace(/[^0-9]/g, '');

      // Known invalid parent category IDs that trigger ErrorCode 87
      const INVALID_PARENTS = ['220', '1', '260', '11233', '11450', '293', '6000'];

      // If the input is already a numeric string and NOT a known parent ID, use it
      if (numericOnly.length >= 4 && !INVALID_PARENTS.includes(numericOnly)) {
        return numericOnly;
      }

      // Automatic keyword-to-leaf mapping for common reseller inventory:
      if (text.includes('card') || text.includes('mtg') || text.includes('pokemon') || text.includes('magic') || text.includes('yugioh')) return '260010'; // CCG Individual Cards
      if (text.includes('comic') || text.includes('graphic novel')) return '183498'; // Comic Books (Modern Age)
      if (text.includes('video game') || text.includes('nintendo') || text.includes('playstation') || text.includes('xbox') || text.includes('sega')) return '139973'; // Video Games
      if (text.includes('toy') || text.includes('action figure') || text.includes('funko')) return '246'; // Action Figures
      if (text.includes('shirt') || text.includes('apparel') || text.includes('clothing') || text.includes('hat') || text.includes('vintage tee')) return '15687'; // Men's T-Shirts
      if (text.includes('metal') || text.includes('coin') || text.includes('relic')) return '11116'; // US Coins
      if (text.includes('stamp')) return '260'; // Stamps

      // Fallback default safe leaf ID (Trading / Collectible Cards)
      return '260010';
    };

    const finalCategory = resolveEbayLeafCategory(identification.categoryId || identification.category, identification.title);

    // Fetch user profile from Supabase
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let userProfile: Profile = {
      id: '',
      user_id: user?.id || '',
      ai_credits_used: 0,
      updated_at: '',
      default_postal_code: process.env.NEXT_PUBLIC_DEFAULT_POSTAL_CODE || "49286",
      default_shipping_profile: shippingProfileName || "Standard Shipping",
      default_return_policy: returnProfileName || "No Returns",
      default_handling_time: handlingTime || "1",
      default_payment_policy: paymentProfileName || "eBay Payments",
    };

    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (data) {
        userProfile = { ...userProfile, ...data };
      }
    }

    const masterItem: MasterItem = {
      id: dbListingId || 'temp-id',
      title: identification.title || '',
      description: identification.description || '',
      price: identification.price || '19.99',
      category: identification.category || '',
      categoryId: finalCategory,
      condition: conditionId,
      photos: validPublicUrls,
      brand: identification.brand || 'Unbranded',
      size: identification.size || 'L',
      color: identification.color || 'Black',
      department: identification.department || 'Men',
      weightOz: String(identification.weightOz || '8'),
      sizeType: identification.sizeType || 'Regular',
    };

    const csvContent = generateEbayCSV([masterItem], userProfile);
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ebay_listing_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleListOnEbay = async () => {
    setIsListing(true);
    try {
      const payload = {
        title: identification?.title,
        price: identification?.price || "19.99",
        condition: identification?.condition,
        description: identification?.description,
        images: images,
        format,
        bestOfferEnabled: bestOffer,
        listingDuration: duration,
        quantity,
        shippingType,
        shippingCost,
        handlingTime,
        weightLbs,
        weightOz,
        dimLength,
        dimWidth,
        dimHeight,
        shippingService,
        shippingPaidBy,
        eisEnabled,
        customSku,
        itemSpecifics
      };
      
      const res = await axios.post("/api/ebay/publish", payload);
      setPublishedListing({ url: res.data.itemUrl, message: res.data.message });
    } catch (err: any) {
      alert("Failed to list: " + (err.response?.data?.error || err.message));
    } finally {
      setIsListing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar mode="single" onSettingsClick={() => setIsSettingsOpen(true)} />
      <div className="max-w-[1400px] mx-auto p-4 md:p-8">
        {identification && !publishedListing && (
           <div className="mb-6 flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-200 shadow-sm max-w-max">
             <Check className="w-4 h-4" />
             <span className="text-sm font-semibold">Ready to List</span>
           </div>
        )}

        {publishedListing && (
          <div className="mb-8 p-6 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-800">Listing Published Successfully!</h3>
                <p className="text-emerald-600 text-sm">{publishedListing.message}</p>
              </div>
            </div>
            <a 
              href={publishedListing.url} 
              target="_blank" 
              rel="noreferrer"
              className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all w-full sm:w-auto text-center"
            >
              View on eBay Sandbox
            </a>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-5 space-y-6">
            <PhotoGallery
              images={images}
              photoRoles={photoRoles}
              isAnalyzing={isAnalyzing}
              removingBgIndex={removingBgIndex}
              fileInputRef={fileInputRef}
              cameraInputRef={cameraInputRef}
              handleImageUpload={handleImageUpload}
              removeImage={removeImage}
              handleRemoveBg={handleRemoveBg}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              triggerIdentify={triggerIdentify}
              identification={identification}
              error={error}
              canvasBg={canvasBg}
              setCanvasBg={setCanvasBg}
            />

            {error && (
              <div className="glass border-red-200 rounded-2xl p-6 flex flex-col items-center text-center space-y-3 bg-red-50/50 shadow-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-10 h-10 text-red-500" />
                <div>
                  <h3 className="text-lg font-bold text-red-700">Analysis Failed</h3>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
                <button
                  onClick={() => triggerIdentify(true)}
                  disabled={isAnalyzing}
                  className="mt-2 bg-white border border-red-200 text-red-700 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-red-50 hover:shadow transition-all flex items-center space-x-2"
                >
                   {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>Deep Scan / Try Again</span>
                </button>
              </div>
            )}
            
            {isAnalyzing && !identification && (
               <div className="lg:hidden glass rounded-2xl p-6 shadow-sm space-y-6 opacity-70">
                  <div className="h-8 bg-slate-200 rounded w-1/3 animate-pulse"></div>
                  <div className="space-y-3">
                    <div className="h-10 bg-slate-200 rounded w-full animate-pulse"></div>
                    <div className="h-10 bg-slate-200 rounded w-full animate-pulse"></div>
                    <div className="h-24 bg-slate-200 rounded w-full animate-pulse"></div>
                  </div>
               </div>
            )}
          </div>

          <div className="lg:col-span-7 space-y-6">
            
            {isAnalyzing && !identification && (
               <div className="hidden lg:block glass rounded-2xl p-8 shadow-sm space-y-8 opacity-70 min-h-[500px]">
                  <div className="flex justify-between items-center">
                    <div className="h-8 bg-slate-200 rounded w-1/4 animate-pulse"></div>
                    <div className="h-6 bg-slate-200 rounded-full w-24 animate-pulse"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="h-24 bg-slate-100 rounded-xl animate-pulse"></div>
                     <div className="h-24 bg-slate-100 rounded-xl animate-pulse"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-12 bg-slate-200 rounded-lg w-full animate-pulse"></div>
                    <div className="h-12 bg-slate-200 rounded-lg w-full animate-pulse"></div>
                    <div className="h-32 bg-slate-200 rounded-lg w-full animate-pulse"></div>
                  </div>
               </div>
            )}

            {identification && !error && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                <MarketComps
                  compsData={compsData}
                  showComps={showComps}
                  setShowComps={setShowComps}
                  pricingStrategy={pricingStrategy}
                  applyPricingStrategy={applyPricingStrategy}
                  getEstimatedDaysToSell={getEstimatedDaysToSell}
                />

                <section className="glass rounded-2xl p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-200">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Listing Details
                    </h2>
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold shadow-sm">
                      {Math.round((identification.confidence_score || 0) * 100)}% Match
                    </span>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Title (Max 80 chars)</label>
                        <input
                          type="text"
                          maxLength={80}
                          value={identification.title || ""}
                          onChange={(e) => handleInputChange("title", e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-900 font-medium transition-all shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">eBay Category ID</label>
                        <input
                          type="text"
                          value={identification.categoryId || identification.category || "260010"}
                          onChange={(e) => handleInputChange("categoryId", e.target.value)}
                          placeholder="e.g. 260010"
                          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-900 font-medium transition-all shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Price (USD)</label>
                        <div className="relative">
                           <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                             <span className="text-slate-500 font-bold">$</span>
                           </div>
                           <input
                             type="number"
                             step="0.01"
                             value={identification.price || ""}
                             onChange={(e) => handleInputChange("price", e.target.value)}
                             className="w-full pl-8 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-emerald-700 transition-all shadow-sm"
                             placeholder="0.00"
                           />
                        </div>
                      </div>
                      <div>
                        {identification.conditionNeedsAttention && (
                          <div className="mb-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-[10px] font-bold border border-red-200 flex items-center gap-2">
                            <AlertCircle className="w-3 h-3" />
                            ⚠️ Attention Required: Please verify item condition before publishing.
                          </div>
                        )}
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Condition</label>
                        <select
                          value={identification.condition || "4000"}
                          onChange={(e) => handleInputChange("condition", e.target.value)}
                          className={`w-full px-4 py-3 bg-white rounded-xl outline-none font-medium shadow-sm appearance-none ${identification.conditionNeedsAttention ? 'border-2 border-red-500 bg-red-50/50' : 'border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'}`}
                        >
                          <option value="NEEDS_REVIEW" disabled>Select Condition...</option>
                          <option value="1000">New with tags / Brand New</option>
                          <option value="1500">New without tags / Open Box</option>
                          <option value="3000">Used - Excellent / Very Good</option>
                          <option value="4000">Used - Good</option>
                          <option value="5000">Used - Acceptable</option>
                          <option value="7000">For parts or not working</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Description</label>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={handleCopyHTML}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            Copy HTML
                          </button>
                          <button 
                            onClick={handleCopyText}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            Copy Text
                          </button>
                          <span className="text-slate-300">|</span>
                          <button 
                            onClick={() => setDescMode(descMode === "PREVIEW" ? "EDIT" : "PREVIEW")}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            {descMode === "PREVIEW" ? "Edit HTML" : "Preview"}
                          </button>
                          <span className="text-slate-300">|</span>
                          <button 
                            onClick={handleRegenerateDescription}
                            disabled={isRefreshingDesc}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${isRefreshingDesc ? 'animate-spin' : ''}`} />
                            {isRefreshingDesc ? 'Regenerating...' : 'AI Rewrite'}
                          </button>
                        </div>
                      </div>
                      
                      {descMode === "PREVIEW" ? (
                        <div 
                          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl shadow-sm overflow-y-auto max-h-64 prose prose-sm prose-slate prose-h3:text-sm prose-h3:font-bold prose-h3:mb-2 prose-h3:mt-4 prose-p:text-sm prose-p:mb-2 prose-ul:my-2 prose-ul:pl-5 prose-li:text-sm prose-li:mb-1"
                          dangerouslySetInnerHTML={{ __html: identification.description || "" }}
                        />
                      ) : (
                        <textarea
                          rows={8}
                          value={identification.description || ""}
                          onChange={(e) => handleInputChange("description", e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 text-sm leading-relaxed shadow-sm resize-none font-mono text-xs"
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4">Item Specifics</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {itemSpecifics.map((spec, idx) => (
                        <div key={idx} className="flex bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                          <input 
                            type="text" 
                            placeholder="Name" 
                            value={spec.name} 
                            onChange={(e) => updateItemSpecific(idx, "name", e.target.value)}
                            className="w-1/3 px-3 py-2 bg-slate-50 border-r border-slate-200 text-xs font-semibold text-slate-600 outline-none"
                          />
                          <input 
                            type="text" 
                            placeholder="Value" 
                            value={spec.value} 
                            onChange={(e) => updateItemSpecific(idx, "value", e.target.value)}
                            className="w-2/3 px-3 py-2 text-sm text-slate-900 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    <button onClick={addItemSpecific} className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors">+ Add Custom Field</button>
                  </div>

                  <ShippingSection
                    shippingType={shippingType}
                    setShippingType={setShippingType}
                    shippingPaidBy={shippingPaidBy}
                    setShippingPaidBy={setShippingPaidBy}
                    shippingCost={shippingCost}
                    setShippingCost={setShippingCost}
                    shippingService={shippingService}
                    setShippingService={setShippingService}
                    eisEnabled={eisEnabled}
                    setEisEnabled={setEisEnabled}
                    weightLbs={weightLbs}
                    setWeightLbs={setWeightLbs}
                    weightOz={weightOz}
                    setWeightOz={setWeightOz}
                    dimLength={dimLength}
                    setDimLength={setDimLength}
                    dimWidth={dimWidth}
                    setDimWidth={setDimWidth}
                    dimHeight={dimHeight}
                    setDimHeight={setDimHeight}
                  />

                  <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4">Format Options</h3>
                        
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Listing Format</label>
                          <select value={format} onChange={e => setFormat(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm outline-none focus:ring-1 focus:ring-indigo-500">
                            <option value="FIXED_PRICE">Buy It Now</option>
                            <option value="AUCTION">Auction</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                           <div>
                             <label className="block text-xs font-medium text-slate-500 mb-1">Duration</label>
                             <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm outline-none focus:ring-1 focus:ring-indigo-500">
                               <option value="GTC">GTC</option>
                               <option value="DAYS_7">7 Days</option>
                               <option value="DAYS_5">5 Days</option>
                             </select>
                           </div>
                           <div>
                             <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
                             <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                           </div>
                        </div>

                        <label className="flex items-center space-x-2 cursor-pointer mt-2 group">
                           <div className="relative flex items-center justify-center">
                              <input type="checkbox" checked={bestOffer} onChange={e => setBestOffer(e.target.checked)} className="peer sr-only" />
                              <div className="w-5 h-5 border-2 border-slate-300 rounded bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors"></div>
                              <Check className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                           </div>
                           <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 transition-colors">Allow Best Offer</span>
                        </label>
                     </div>
                  </div>

                   <div className="mt-8 pt-6 border-t border-slate-200">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4">Business Policies (Optional)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                         <label className="block text-xs font-medium text-slate-500 mb-1">Shipping Policy</label>
                         <input type="text" value={shippingProfileName} onChange={e => setShippingProfileName(e.target.value)} placeholder="e.g. Default Shipping" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                      <div>
                         <label className="block text-xs font-medium text-slate-500 mb-1">Return Policy</label>
                         <input type="text" value={returnProfileName} onChange={e => setReturnProfileName(e.target.value)} placeholder="e.g. 30 Days Free" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                      <div>
                         <label className="block text-xs font-medium text-slate-500 mb-1">Payment Policy</label>
                         <input type="text" value={paymentProfileName} onChange={e => setPaymentProfileName(e.target.value)} placeholder="e.g. Managed Payments" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={() => triggerIdentify(true)}
                      disabled={isAnalyzing || isListing}
                      className="px-6 py-3.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:shadow-sm disabled:opacity-50 transition-all flex items-center justify-center space-x-2 w-full sm:w-auto"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span className="hidden sm:inline">Rescan Details</span>
                    </button>
                    
                    <button
                      onClick={handleExportCSV}
                      disabled={isAnalyzing || isListing || identification?.conditionNeedsAttention}
                      className="px-6 py-3.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:shadow-sm disabled:opacity-50 transition-all flex items-center justify-center space-x-2 w-full sm:w-auto"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export CSV</span>
                    </button>
                    
                    <button
                      onClick={handleListOnEbay}
                      disabled={isListing || isAnalyzing || identification?.conditionNeedsAttention}
                      className="flex-1 bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-600/30 disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-none transition-all flex items-center justify-center space-x-2"
                    >
                      {isListing ? <RefreshCw className="w-5 h-5 animate-spin text-indigo-200" /> : <Check className="w-5 h-5" />}
                      <span>{isListing ? "Publishing to eBay..." : "Publish to eBay"}</span>
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </main>
  );
}
