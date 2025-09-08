import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    // Allow hot refresh server to run on port 5174
    hmr: {
      port: 5174,
    },
  },
})
