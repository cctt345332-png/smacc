const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const isVercel = Boolean(process.env.VERCEL);

const nextConfig = {
  // Vercel packages Next applications itself. In Next 16.3, combining its
  // adapter with standalone output can omit next-server.js.nft.json.
  ...(isVercel
    ? {}
    : {
        output: "standalone",
        outputFileTracingRoot: path.join(__dirname),
      }),
};

module.exports = withNextIntl(nextConfig);
