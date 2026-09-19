import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// TypeScript로 쓴 도구를 Vite로 불러 실행한다. 게임 코드를 그대로 import하기 위함
const server = await createServer({
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true, watch: null },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
})

const { main } = await server.ssrLoadModule('/tools/stageCheck.ts')
await main(process.argv.slice(2))
await server.close()
