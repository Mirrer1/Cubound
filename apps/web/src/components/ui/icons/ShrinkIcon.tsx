// 가운데를 가리키는 두 화살표, 확대로 돌아가기
const ShrinkIcon = ({ className = 'size-[1em]' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 4l-6 6M14 4v6h6M4 20l6-6M10 20v-6H4" />
  </svg>
)

export default ShrinkIcon
