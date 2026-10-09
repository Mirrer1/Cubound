const GuideIcon = ({ className = 'size-[1em]' }: { className?: string }) => (
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
    <path d="M7.8 8a4.2 4.2 0 1 1 6.7 3.4c-1.5 1-2.5 1.9-2.5 3.7v.6" />
    <path d="M12 19.6h.01" />
  </svg>
)

export default GuideIcon
