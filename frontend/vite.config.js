import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  // desktop/scripts/build-frontend.mjs sets VITE_TARGET=desktop when
  // building for the Electron app, which loads the built page via a
  // file:// URL with no server behind it. Vite's default base ('/')
  // resolves asset URLs against a real server root, which breaks under
  // file://; a relative base ('./') is what Electron/file:// deployments
  // need. Every other build (the plain `npm run build` used by Vercel and
  // Netlify) is unaffected -- VITE_TARGET is never set there, so `base`
  // stays Vite's normal default.
  const isDesktop = process.env.VITE_TARGET === 'desktop'
  return {
    plugins: [react()],
    base: isDesktop ? './' : '/',
  }
})
