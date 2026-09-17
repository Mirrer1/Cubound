interface GuideText {
  web: string
  touch?: string // 터치 기기용 문구
}

export const GUIDE_TEXTS: Record<string, GuideText> = {
  move: { web: '방향키로 한 칸씩 굴러가요', touch: '화면을 대각선으로 밀면 큐브가 굴러가요' },
  goal: { web: '여기가 집이에요. 구멍까지 가 보세요' },
  height: { web: '내려갈 수는 있지만 올라갈 수는 없어요' },
  box: { web: '큐브로 밀어서 상자를 옮겨요' },
  restart: {
    web: '막히면 여기나 R 키로 처음부터 해요',
    touch: '막히면 여기를 눌러 처음부터 해요',
  },
  switch: { web: '무언가 올라가 있는 동안 스위치가 눌려요' },
  door: { web: '스위치가 눌려 있으면 문이 열려요' },
  ladder: { web: '사다리 칸에 들어가면 사다리를 들어요' },
  climb: { web: '한 층 높은 칸에 사다리를 놓고 올라가요. 타고 내려오면 다시 들어요' },
  // 보스 이동 제한 작업 때 제한 수를 넣어 채운다
  moveLimit: { web: '' },
}

export const guideText = (id: string, touch: boolean) =>
  (touch ? GUIDE_TEXTS[id].touch : undefined) ?? GUIDE_TEXTS[id].web
