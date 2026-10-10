import type { ButtonHTMLAttributes, Ref } from 'react'

const VARIANTS = {
  primary: 'h-14 rounded-2xl bg-ink px-8 text-lg text-base-bg hover:bg-ink/90',
  secondary: 'h-14 rounded-2xl border px-3 text-lg sm:px-6',
  icon: 'size-11 shrink-0 rounded-[0.8125rem] border text-lg',
  tool: 'shrink-0 rounded-[0.8125rem] border tool-size',
  ghost: 'shrink-0 rounded-[0.8125rem] tool-size',
  text: 'h-11 rounded-[0.8125rem] px-4 text-sm text-mute',
}

const TONES = {
  light: 'border-line-strong hover:bg-hover',
  dark: 'border-ink bg-ink text-base-bg hover:bg-ink/90',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  strong?: boolean // 시선을 끌어야 할 때 쓰는 진한 면
  ref?: Ref<HTMLButtonElement>
}

const Button = ({
  variant = 'secondary',
  strong = false,
  className = '',
  ...props
}: ButtonProps) => {
  const tone = variant === 'primary' ? '' : TONES[strong ? 'dark' : 'light']

  return (
    <button
      type="button"
      className={`relative flex cursor-pointer items-center justify-center transition-soft after:absolute after:top-1/2 after:left-1/2 after:h-[max(100%,44px)] after:w-[max(100%,44px)] after:-translate-x-1/2 after:-translate-y-1/2 active:scale-[0.97] disabled:cursor-default disabled:opacity-40 ${VARIANTS[variant]} ${tone} ${className}`}
      {...props}
    />
  )
}

export default Button
