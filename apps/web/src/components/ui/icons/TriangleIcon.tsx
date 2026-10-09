// 위를 가리키는 삼각형, 가로세로 비율은 자리마다 className으로 지정
const TriangleIcon = ({ className = 'h-[0.7em] w-[1em]' }: { className?: string }) => (
  <svg
    viewBox="0 0 10 10"
    preserveAspectRatio="none"
    className={className}
    fill="currentColor"
    aria-hidden
  >
    <path d="M5 0 10 10H0z" />
  </svg>
)

export default TriangleIcon
