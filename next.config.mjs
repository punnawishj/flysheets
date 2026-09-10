/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Allow <Image> to load files straight from your Supabase Storage project.
      // Replace with your project ref, e.g. abcxyzproject.supabase.co
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
