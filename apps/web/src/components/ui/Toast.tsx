import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'

interface ToastProps {
  show: string | null // 빈 값은 숨긴 상태
  children: ReactNode
}

// 화면 위 가운데 알약 안내
const Toast = ({ show, children }: ToastProps) => {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--toast-y)+env(safe-area-inset-top))] z-20 flex justify-center"
    >
      <AnimatePresence>
        {show !== null && (
          <motion.div
            key="toast"
            className="flex h-(--toast-h) items-center gap-3 rounded-full bg-ink px-5 text-(length:--toast-f) whitespace-nowrap text-base-bg shadow-[0_8px_24px_color-mix(in_srgb,var(--color-ink)_20%,transparent)]"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.3, ease: 'easeIn' } }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Toast
