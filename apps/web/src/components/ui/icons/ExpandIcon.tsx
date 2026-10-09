// 바깥을 가리키는 두 화살표, 전체 보기
const ExpandIcon = ({ className = 'size-[1em]' }: { className?: string }) => (
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
    <path d="M14 10l6-6M14 4h6v6M10 14l-6 6M4 14v6h6" />
  </svg>
)

export default ExpandIcon
