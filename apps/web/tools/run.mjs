import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// TypeScript 도구를 Vite로 불러 실행, 게임 코드를 그대로 import하는 방법
const server = await createServer({
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true, watch: null },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
})

const { main } = await server.ssrLoadModule('/tools/stageCheck.ts')
await main(process.argv.slice(2))
await server.close()
