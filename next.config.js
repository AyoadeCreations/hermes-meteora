/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Externalize heavy Node-only packages so the server bundle
  // doesn't re-compile them on every request in dev.
  serverExternalPackages: [
    'better-sqlite3',
    'pg',
    'pg-native',
    '@meteora-ag/dynamic-bonding-curve-sdk',
    '@solana/web3.js',
    '@solana/spl-token',
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Browser polyfills for Solana packages
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        os: false,
        buffer: require.resolve('buffer/'),
      };
    }

    // Suppress noisy dynamic-require warning from WalletConnect / viem
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /node_modules\/pino/ },
      { module: /node_modules\/ox\// },
    ];

    return config;
  },
};

module.exports = nextConfig;
