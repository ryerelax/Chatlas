export default function manifest() {
  return {
    name: "Chatlas",
    short_name: "Chatlas",
    description: "Discover attractions and experiences around Melaka.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0F5A43",
    icons: [
      {
        src: "/branding/chatlas-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/chatlas-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
