import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import IconResolver from 'unplugin-icons/resolver'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import inject from '@rollup/plugin-inject'

// 获取当前文件的目录名
const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  console.log('env', env)
  return {
    base: './',
    publicDir: 'public',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        imgs: resolve(__dirname, 'src/assets/imgs')
      }
    },
    build: {
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          mobile: resolve(__dirname, 'mobile.html')
        },
        output: {
          dir: './dist',
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              return id
                .toString()
                .split('node_modules/')[1]
                .split('/')[0]
                .toString()
            }
          }
        }
      }
    },
    server: {
      hmr: true,
      open: true,
      port: 8080,
      proxy: {
        '/api': {
          target: env.VITE_APP_BASE_URL,
          ws: true,
          changeOrigin: true,
          bypass: (req, res, config) =>
            console.log(`请求被转发至：${config.target}${req.url}`)
        }
      }
    },
    plugins: [
      vue(),
      AutoImport({
        imports: ['vue', 'vue-router'],
        dirs: [
          './src/utils',
          './src/api',
          './src/composables',
          './src/constants',
          './src/store'
        ],
        resolvers: [ElementPlusResolver(), IconResolver({ prefix: 'Icon' })],
        dts: 'src/auto-imports.d.ts'
      }),
      Components({
        dirs: ['src/components/'],
        resolvers: [ElementPlusResolver({ importStyle: false })],
        dts: 'src/components.d.ts'
      }),
      inject({
        _: 'lodash',
        dayjs: 'dayjs',
        Cookies: 'js-cookie',
        include: ['src/**/*.vue', 'src/**/*.js']
      })
    ]
  }
})