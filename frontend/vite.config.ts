import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
      port: 5199,
      strictPort: true,
    },
    define: {
          'import.meta.env.VITE_API_URL': JSON.stringify('https://old-clothes-app-production.up.railway.app/api')
    }
})
