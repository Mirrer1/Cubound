const BackIcon = ({ className = 'size-[1em]' }: { className?: string }) => (
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
    <path d="M21.1 12H2.9M7 8 2.9 12 7 16" />
  </svg>
)

export default BackIcon
