import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  /*
   * 개발 서버에서 /api 와 /ws 를 백엔드로 프록시한다.
   *
   * 프록시가 없으면 프론트엔드가 다른 오리진의 :8080 을 직접 호출해
   * 개발 중에도 CORS 설정에 의존해야 한다. 프록시를 쓰면 브라우저에
   * 같은 오리진으로 보이므로 포트를 바꿔 실행해도(--port, --host)
   * 그대로 동작한다.
   */
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
