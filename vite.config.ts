import { readFile } from 'node:fs/promises'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// This backup stays outside the web root and the production bundle.
function localGardenBackup(file?: string): Plugin {
  const serve: Connect.NextHandleFunction = async (req, res, next) => {
    if (req.url !== '/local-garden.json') return next()
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
    const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host ?? '')
    if (!file || !local || !localHost || req.method !== 'GET' || req.headers['sec-fetch-site'] === 'cross-site' ||
        (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)) {
      res.statusCode = 404
      return res.end()
    }
    try {
      const data = await readFile(file)
      res.setHeader('Content-Type', 'application/json')
      res.end(data)
    } catch {
      res.statusCode = 404
      res.end()
    }
  }
  return {
    name: 'local-garden-backup',
    configureServer(server) { server.middlewares.use(serve) },
    configurePreviewServer(server) { server.middlewares.use(serve) },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), localGardenBackup(loadEnv(mode, process.cwd(), 'GARDEN_').GARDEN_BACKUP_FILE)],
  build: {
    rollupOptions: {
      output: {
        // Split the heavy 3D stack (three + react-three) into a stable vendor
        // chunk so it caches independently of app-code changes. The Scene is
        // also dynamically imported (React.lazy) so it loads in its own chunk.
        manualChunks: {
          three: ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
}))
