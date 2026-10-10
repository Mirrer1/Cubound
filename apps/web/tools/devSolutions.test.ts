import { cpSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { codeOf, migrateCache, readCacheFile, writeCacheFile } from './devSolutions'

const GAME = resolve('src/game')

const dirs: string[] = []
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cubound-cache-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('codeOf', () => {
  it('같은 게임 코드는 다른 폴더에서도 같은 지문이다', () => {
    const copy = join(tempDir(), 'src/game')
    cpSync(GAME, copy, { recursive: true })
    expect(codeOf(copy)).toBe(codeOf(GAME))
  })

  it('게임 코드가 바뀌면 지문도 바뀐다', () => {
    const copy = join(tempDir(), 'src/game')
    cpSync(GAME, copy, { recursive: true })
    writeFileSync(join(copy, 'types.ts'), '// x\n', { flag: 'a' })
    expect(codeOf(copy)).not.toBe(codeOf(GAME))
  })
})

describe('캐시 파일', () => {
  it('없는 파일은 빈 캐시다', () => {
    expect(readCacheFile(join(tempDir(), 'none.json'))).toEqual({})
  })

  it('깨진 파일은 던지지 않고 빈 캐시다', () => {
    const file = join(tempDir(), 'solutions-abc.json')
    writeFileSync(file, '{"1-1":{"hash":"a"}}{"1-2":{"hash":"b"}}')
    expect(readCacheFile(file)).toEqual({})
  })

  it('깨진 파일은 다음 저장 때 덮어쓴다', () => {
    const file = join(tempDir(), 'solutions-abc.json')
    writeFileSync(file, '{"1-1":')
    writeCacheFile(file, { '1-2': { hash: 'b' } })
    expect(readCacheFile(file)).toEqual({ '1-2': { hash: 'b' } })
  })

  it('이어 쓰면 마지막 내용만 온전히 남고 임시 파일이 안 남는다', () => {
    const dir = tempDir()
    const file = join(dir, 'solutions-abc.json')
    writeCacheFile(file, { '1-1': { hash: 'a' } })
    writeCacheFile(file, { ...readCacheFile(file), '1-2': { hash: 'b', path: ['up'] } })
    expect(readCacheFile(file)).toEqual({
      '1-1': { hash: 'a' },
      '1-2': { hash: 'b', path: ['up'] },
    })
    expect(readdirSync(dir)).toEqual(['solutions-abc.json'])
  })
})

describe('migrateCache', () => {
  it('예전 캐시 파일을 새 파일 하나로 모으고 지운다, 같은 판은 최근 파일 기준', () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'solutions.json'), '{"1-1":{"hash":"old"},"1-2":{"hash":"b"}}')
    writeFileSync(join(dir, 'solutions-abc.json'), '{"1-1":{"hash":"new"}}')
    utimesSync(join(dir, 'solutions.json'), 1, 1)
    const file = join(dir, 'devSolutions.json')
    expect(migrateCache(dir, file)).toEqual({ '1-1': { hash: 'new' }, '1-2': { hash: 'b' } })
    expect(readdirSync(dir)).toEqual(['devSolutions.json'])
  })

  it('새 파일이 있으면 새 파일이 앞선다', () => {
    const dir = tempDir()
    const file = join(dir, 'devSolutions.json')
    writeCacheFile(file, { '1-1': { hash: 'kept' } })
    writeFileSync(join(dir, 'solutions-abc.json'), '{"1-1":{"hash":"old"}}')
    expect(migrateCache(dir, file)).toEqual({ '1-1': { hash: 'kept' } })
    expect(readdirSync(dir)).toEqual(['devSolutions.json'])
  })

  it('폴더가 없으면 빈 캐시다', () => {
    const dir = join(tempDir(), 'none')
    expect(migrateCache(dir, join(dir, 'devSolutions.json'))).toEqual({})
  })
})
