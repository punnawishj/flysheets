/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Allow <Image> to load files straight from your Supabase Storage project.
      // Replace with your project ref, e.g. abcxyzproject.supabase.co
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    serverActions: {
      // Next.js rejects any Server Action submission over 1MB by default --
      // silently, with no error your own code ever gets to catch or show.
      // A real PDF study-sheet upload blows past that instantly, so this
      // raises the ceiling to match the 20MB Supabase Storage accepts.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
