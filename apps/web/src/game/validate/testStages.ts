import { validateStage } from './index'

export const VALID = {
  version: 1,
  id: '1-3',
  name: '테스트',
  heights: [
    [0, 0, 1],
    [0, -1, 1],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 1 },
  entities: [
    { type: 'box', x: 1, y: 0 },
    { type: 'switch', x: 0, y: 1, target: 'a' },
    { type: 'door', x: 2, y: 0, id: 'a' },
  ],
  best: 5,
  guides: [
    { id: 'box', target: { x: 1, y: 0 } },
    { id: 'restart', target: 'restart' },
    { id: 'moves', target: 'moves' },
  ],
  zones: [{ x: 0, y: 0, w: 3, h: 2 }],
}

export const errorsOf = (data: unknown) => {
  const result = validateStage(data)
  return result.ok ? [] : result.errors
}
