import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.31.94', '192.168.1.8'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
