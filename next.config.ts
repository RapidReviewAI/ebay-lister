import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // DO NOT USE output: 'export' - It kills API routes!
  images: {
    unoptimized: true, // Necessary for some Vercel setups
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
