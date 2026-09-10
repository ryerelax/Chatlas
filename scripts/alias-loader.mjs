// Resolves the project's "@/*" -> "src/*" import alias (defined in jsconfig.json
// for Next.js/webpack) so standalone maintenance scripts under scripts/ can import
// src/ modules the same way the rest of the app does. Registered via register-aliases.mjs.
const ALIAS_PREFIX = "@/";
const SRC_DIR_URL = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(ALIAS_PREFIX)) {
    const target = new URL(`${specifier.slice(ALIAS_PREFIX.length)}.js`, SRC_DIR_URL).href;
    return nextResolve(target, context);
  }

  return nextResolve(specifier, context);
}
