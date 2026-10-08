import { type ChildProcess, fork } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin, ViteDevServer } from 'vite'

interface SolutionEntry {
  hash: string
  path?: string[]
}

interface ChildReply {
  ready?: boolean
  file?: string
  id?: string
  hash?: string
  same?: boolean
  path?: string[]
  ms?: number
  error?: string
}

const ID = 'virtual:dev-solutions'
const RESOLVED = `\0${ID}`
const EVENT = 'cubound:solution'
const STAGE_FILE = /\/src\/stages\/world-[^/]+\/[^/]+\.json$/

const slash = (file: string) => file.replaceAll('\\', '/')

const idOf = (file: string) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')).id as string
  } catch {
    return undefined
  }
}

// 개발 서버에서 판 JSON이 바뀔 때마다 그 판 풀이를 자식 프로세스에서 미리 구해 화면에 넘기는 플러그인
export const devSolutions = (): Plugin => {
  let cache: Record<string, SolutionEntry> = {}
  let serving = false
  let cacheFile = ''
  let stagesDir = ''

  const readCache = (): Record<string, SolutionEntry> =>
    existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {}

  const start = (server: ViteDevServer) => {
    const logger = server.config.logger
    cache = readCache()
    const queue: string[] = []
    let busy = false
    let ready = false
    let batchStarted = 0
    let solved = 0
    const child: ChildProcess = fork(fileURLToPath(new URL('./devSolveChild.mjs', import.meta.url)))

    const pump = () => {
      if (busy || !ready) return
      const file = queue.shift()
      if (!file) {
        if (batchStarted && solved > 0)
          logger.info(`[풀이] ${solved}판 ${((Date.now() - batchStarted) / 1000).toFixed(1)}초`)
        batchStarted = 0
        solved = 0
        return
      }
      if (!batchStarted) batchStarted = Date.now()
      busy = true
      const id = idOf(file)
      child.send({ file, known: id ? cache[id]?.hash : undefined })
    }

    const enqueue = (file: string) => {
      if (!queue.includes(file)) queue.push(file)
      pump()
    }

    child.on('message', (reply: ChildReply) => {
      if (reply.ready) ready = true
      else busy = false
      if (reply.error) logger.warn(`[풀이] ${reply.file}: ${reply.error}`)
      if (reply.id && reply.hash && !reply.same) {
        const entry = { hash: reply.hash, path: reply.path }
        // 같은 캐시를 쓰는 다른 개발 서버가 그사이 쓴 판 보존
        cache = { ...readCache(), ...cache, [reply.id]: entry }
        mkdirSync(dirname(cacheFile), { recursive: true })
        writeFileSync(cacheFile, JSON.stringify(cache))
        const mod = server.moduleGraph.getModuleById(RESOLVED)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'custom', event: EVENT, data: { id: reply.id, entry } })
        logger.info(
          `[풀이] ${reply.id} ${reply.path ? `${reply.path.length}수` : '못 구함'} ${((reply.ms ?? 0) / 1000).toFixed(1)}초`,
        )
        solved++
      }
      pump()
    })

    for (const world of readdirSync(stagesDir).filter((name) => name.startsWith('world-')))
      for (const name of readdirSync(join(stagesDir, world)).filter((n) => n.endsWith('.json')))
        enqueue(slash(join(stagesDir, world, name)))

    const onFile = (file: string) => {
      if (STAGE_FILE.test(slash(file))) enqueue(slash(file))
    }
    server.watcher.on('add', onFile)
    server.watcher.on('change', onFile)
    server.httpServer?.on('close', () => child.kill())
    process.on('exit', () => child.kill())
  }

  return {
    name: 'cubound-dev-solutions',
    configResolved(config) {
      serving = config.command === 'serve' && !process.env.VITEST
      cacheFile = join(config.root, 'node_modules/.cache/cubound/solutions.json')
      stagesDir = join(config.root, 'src/stages')
    },
    resolveId(id) {
      if (id === ID) return RESOLVED
    },
    load(id) {
      if (id === RESOLVED) return `export default ${serving ? JSON.stringify(cache) : '{}'}`
    },
    configureServer(server) {
      if (serving) start(server)
    },
  }
}
