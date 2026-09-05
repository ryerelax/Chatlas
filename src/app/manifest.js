// TODO: Replace favicon.ico with final branded PWA icons (192x192 and 512x512
// PNG) once the real Chatlas logo is ready.
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
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
