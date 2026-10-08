import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// 사용자의 개발 서버와 캐시와 감시를 나누지 않는 포트 없는 Vite, 게임 코드를 불러오는 용도
const server = await createServer({
  configFile: false,
  logLevel: 'error',
  root: fileURLToPath(new URL('..', import.meta.url)),
  cacheDir: fileURLToPath(new URL('../node_modules/.cache/cubound/vite', import.meta.url)),
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
})

const { solve } = await server.ssrLoadModule('/src/game/solver.ts')
const { stageHash } = await server.ssrLoadModule('/src/dev/solutionCache.ts')

// 해시가 known과 같으면 풀이 생략
process.on('message', ({ file, known }) => {
  try {
    const stage = JSON.parse(readFileSync(file, 'utf8'))
    const hash = stageHash(stage)
    if (hash === known) return process.send({ file, id: stage.id, hash, same: true })
    const started = Date.now()
    const result = solve(stage)
    process.send({
      file,
      id: stage.id,
      hash,
      path: result.status === 'solved' ? result.path : undefined,
      ms: Date.now() - started,
    })
  } catch (error) {
    process.send({ file, error: String(error) })
  }
})

process.on('disconnect', () => server.close().then(() => process.exit(0)))
process.send({ ready: true })
