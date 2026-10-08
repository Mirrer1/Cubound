declare module 'virtual:dev-solutions' {
  import type { SolutionEntry } from '@/dev/solutionCache'

  const solutions: Record<string, SolutionEntry>
  export default solutions
}
