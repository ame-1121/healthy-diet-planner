import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: '/healthy-diet-planner/',
  server: {
    port: 3456,
    host: '0.0.0.0',
    open: '/',
  },
})
