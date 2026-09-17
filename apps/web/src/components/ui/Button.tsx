import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary: 'h-14 rounded-2xl bg-ink px-8 text-lg text-base-bg hover:bg-ink/90',
  secondary: 'h-14 rounded-2xl border border-line-strong px-6 text-lg hover:bg-hover',
  icon: 'size-11 rounded-[13px] border border-line-strong text-lg hover:bg-hover',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
}

const Button = ({ variant = 'secondary', className = '', ...props }: ButtonProps) => {
  return (
    <button
      type="button"
      className={`flex cursor-pointer items-center justify-center transition-soft active:scale-[0.97] disabled:cursor-default disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export default Button
