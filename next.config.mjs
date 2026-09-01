/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The pet renders in an Electron BrowserWindow (file://), not a browser tab.
  // Relative asset prefix keeps the _next/ CSS and JS reachable under file://.
  output: "export",
  trailingSlash: true,
  assetPrefix: "./",
};

export default nextConfig;
