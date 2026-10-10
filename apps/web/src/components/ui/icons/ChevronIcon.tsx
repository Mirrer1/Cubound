// 왼쪽을 가리키는 꺾쇠
const ChevronIcon = ({ className = 'size-[1em]' }: { className?: string }) => (
  <svg
    viewBox="4.4 4.5 15 15"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M14.4 7 9.4 12l5 5" />
  </svg>
)

export default ChevronIcon
