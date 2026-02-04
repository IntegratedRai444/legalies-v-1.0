import type { NextConfig } from "next";
import path from "node:path";

const loaderPath = require.resolve('orchids-visual-edits/loader.js');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Only apply turbopack config when NOT disabled and when loader is compatible
  ...(process.env.NEXT_DISABLE_TURBOPACK !== '1' ? {
    turbopack: {
      root: process.cwd(),
      // Temporarily disable custom loader for turbopack compatibility
      // rules: {
      //   "*.{jsx,tsx}": {
      //     loaders: [loaderPath]
      //   }
      // }
    }
  } : {
    // Webpack configuration with custom loader
    webpack: (config, { isServer }) => {
      if (!isServer) {
        config.module.rules.push({
          test: /\.(jsx|tsx)$/,
          use: loaderPath,
          exclude: /node_modules/,
        });
      }
      return config;
    }
  })
}

export default nextConfig;
// Orchids restart: 1769854111221
