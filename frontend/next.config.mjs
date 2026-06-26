/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Force Next.js to transpile these packages so they share the same React
  // instance as the app — prevents the duplicate-React / ReactCurrentBatchConfig error.
  transpilePackages: [
    "three",
    "@react-three/fiber",
    "@react-three/drei",
    "@xyflow/react",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
  async rewrites() {
    // Use internal Docker hostname for server-side rewrites (container-to-container).
    // NEXT_PUBLIC_API_URL is the browser-facing URL; in Docker it resolves to localhost:8000.
    // At build time inside Docker, we must use http://backend:8000 for the rewrite destination.
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL || "http://backend:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

