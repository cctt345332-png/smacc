/** @type {import('next').NextConfig} */
const nextConfig = {
  // static export — لا نحتاج server في Electron
  output: "export",
  trailingSlash: true,

  // لا نحتاج image optimization في Electron
  images: {
    unoptimized: true,
  },

  // تعطيل strict mode
  reactStrictMode: false,
};

module.exports = nextConfig;
