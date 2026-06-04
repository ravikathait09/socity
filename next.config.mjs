/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["mongoose", "bcryptjs"],
};

export default nextConfig;
