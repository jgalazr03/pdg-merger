/** @type {import('next').NextConfig} */
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export when specifically building for static hosting
  ...(process.env.STATIC_EXPORT === 'true' ? { output: 'export' } : {}),
  
  // Enable experimental features for better performance
  experimental: {
    optimizeCss: true,
  },
  
  // Webpack configuration for ExcelJS and other dependencies
  webpack: (config, { isServer }) => {
    // Handle ExcelJS dependencies
    config.externals = config.externals || {};
    if (isServer) {
      config.externals['exceljs'] = 'commonjs exceljs';
    }

    // qpdf-wasm (Emscripten) hace require('fs'|'path'|'crypto') en su glue;
    // en el build de cliente esos builtins de Node no existen, los neutralizamos.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Better handling of worker files
    config.module.rules.push({
      test: /\.worker\.(js|ts)$/,
      use: {
        loader: 'worker-loader',
        options: {
          filename: 'static/[hash].worker.js',
          publicPath: '/_next/',
        },
      },
    });
    
    return config;
  },
  
  // Better performance settings
  compress: true,
  poweredByHeader: false,
  
  // Images optimization
  images: {
    unoptimized: process.env.STATIC_EXPORT === 'true',
  },
  
  // Better error handling in development
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      maxInactiveAge: 60 * 1000,
      pagesBufferLength: 5,
    },
  }),
};

module.exports = nextConfig;
