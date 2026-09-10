import { BrowserRouter, HashRouter } from "react-router-dom";

// The web app (Vercel/Netlify) is served over real HTTP, where
// vercel.json/netlify.toml both rewrite every path to index.html so
// react-router-dom's BrowserRouter (plain "/dashboard"-style URLs, backed by
// the HTML5 History API) works correctly on a deep link or a page refresh.
//
// The desktop app (see desktop/main/main.js) instead loads the built
// frontend via a file:// URL with no server behind it at all, so there is
// nothing to catch a path like "/dashboard" and fall back to index.html --
// HashRouter's "#/dashboard"-style URLs are resolved entirely client-side
// and work identically regardless of how the page was loaded, which is why
// the desktop build needs it.
//
// VITE_TARGET=desktop is set only by desktop/scripts/build-frontend.mjs,
// never by the existing `npm run build` used for the Vercel/Netlify
// deploys -- so this export is BrowserRouter, unchanged, for every build
// except the desktop one.
export const Router = import.meta.env.VITE_TARGET === "desktop" ? HashRouter : BrowserRouter;
