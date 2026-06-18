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
    // Externals del servidor: webpack no los bundlea; Node los resuelve en
    // runtime. En el build de servidor `config.externals` es un ARRAY, así que
    // asignarle propiedades no surte efecto: anteponemos un mapa de externals.
    if (isServer) {
      const serverExternals = {
        exceljs: 'commonjs exceljs',
        // @vercel/blob (API routes de transcripción) arrastra `undici`, cuyos
        // campos privados (`#x in obj`) no parsea el webpack de Next 13.5.1. Node
        // ya resuelve `undici` en runtime.
        undici: 'commonjs undici',
      };
      config.externals = Array.isArray(config.externals)
        ? [serverExternals, ...config.externals]
        : [serverExternals, config.externals].filter(Boolean);
    }

    // tesseract.js arrastra node-fetch -> 'encoding' (dep opcional) por su ruta
    // Node, que en el navegador nunca se ejecuta. Neutralizamos 'encoding' en
    // ambos builds para que webpack no avise.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      encoding: false,
    };
    // qpdf-wasm (Emscripten) hace require('fs'|'path'|'crypto') en su glue; en el
    // build de cliente esos builtins de Node no existen, los neutralizamos.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
      // En el navegador, @vercel/blob `upload()` usa el fetch nativo; evitamos que
      // arrastre `undici` al bundle de cliente (sus campos privados no parsean en
      // el webpack de Next 13.5.1).
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        undici: false,
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
