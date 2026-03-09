/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
      },
    ],
  },
  webpack: config => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@genkit-ai/firebase': false,
      '@opentelemetry/exporter-jaeger': false,
    };

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /handlebars/, message: /require\.extensions is not supported by webpack/ },
      { module: /require-in-the-middle/, message: /Critical dependency/ },
    ];

    return config;
  },
};

export default nextConfig;
