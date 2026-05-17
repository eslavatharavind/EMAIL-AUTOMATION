// Mark this file as a Client Component in Next.js because it uses React hooks and framer-motion animations
'use client'

// Import motion from framer-motion to enable advanced UI animations
import { motion } from 'framer-motion'
// Import React hooks for managing local state (useState) and side effects (useEffect)
import { useEffect, useState } from 'react'
// Import our custom classNames utility to merge Tailwind classes cleanly
import { cn } from '@/lib/utils'
// Import trend icons from lucide-react to show if stats are going up or down
import { TrendingUp, TrendingDown } from 'lucide-react'
// Import the LucideIcon type for TypeScript typing of the icon prop
import { LucideIcon } from 'lucide-react'

// Define the TypeScript interface for the properties this StatCard component accepts
interface StatCardProps {
  // The title or label of the stat (e.g., 'Total Emails')
  title: string
  // The numeric value of the stat to display
  value: number
  // The React component representing the icon
  icon: LucideIcon
  // Tailwind class string for the icon's SVG color
  iconColor: string
  // Tailwind class string for the background color behind the icon
  iconBg: string
  // Optional: The percentage trend compared to a previous period
  trend?: number
  // Optional: The text to show next to the trend (default is 'vs last month')
  trendLabel?: string
  // Optional: The animation delay in seconds to stagger multiple cards
  delay?: number
  // Optional: A custom formatting function to parse the number (like currency)
  formatter?: (val: number) => string
}

// Internal component to animate a number counting up from 0 to the target
function AnimatedCounter({ target, duration = 1.5 }: { target: number; duration?: number }) {
  // State to hold the current count value as it increments
  const [count, setCount] = useState(0)

  // useEffect runs when the component mounts or when 'target' or 'duration' changes
  useEffect(() => {
    // Record the timestamp when the animation starts
    const start = Date.now()
    // Define the frame update function
    const tick = () => {
      // Calculate how many seconds have elapsed since start
      const elapsed = (Date.now() - start) / 1000
      // Calculate progress from 0 to 1, capped at 1 when duration is reached
      const progress = Math.min(elapsed / duration, 1)
      // Apply an easing curve (cubic ease-out) so it slows down near the end
      const eased = 1 - Math.pow(1 - progress, 3)
      // Update state with the calculated integer value
      setCount(Math.round(target * eased))
      // If animation is not yet complete, request another animation frame
      if (progress < 1) requestAnimationFrame(tick)
    }
    // Kick off the first animation frame
    const raf = requestAnimationFrame(tick)
    // Cleanup function to cancel the animation if the component unmounts early
    return () => cancelAnimationFrame(raf)
  }, [target, duration]) // Dependencies array for useEffect

  // Return the count formatted with commas (e.g. 1,000) inside a React fragment
  return <>{count.toLocaleString()}</>
}

// Export the main StatCard component, destructuring its props and assigning default values
export default function StatCard({
  title, // the label
  value, // the final number
  icon: Icon, // alias the lowercase icon prop to capitalized Icon so it can be rendered as a component
  iconColor, // color of the icon
  iconBg, // background of the icon wrapper
  trend, // percentage change
  trendLabel = 'vs last month', // default text for the trend label
  delay = 0, // default animation delay is 0
  formatter, // optional formatter function
}: StatCardProps) { // Type the props with our interface
  
  // Return the component JSX
  return (
    // motion.div gives us framer-motion animation capabilities on a standard div
    <motion.div
      // Initial state before animation starts: invisible and slightly pushed down
      initial={{ opacity: 0, y: 20 }}
      // Animate state: fade to fully visible and move to its original vertical position
      animate={{ opacity: 1, y: 0 }}
      // Configure transition: take 0.5s, wait for the specified delay, use a spring for bounciness
      transition={{ duration: 0.5, delay }}
      // Interactive animation: when the user hovers over it, lift it up slightly and add a shadow
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      // Styling: white/dark background, rounded corners, border, padding, flexbox layout, transitions
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col gap-4 transition-all duration-200"
    >
      {/* Container for the top part (text left, icon right) */}
      <div className="flex items-start justify-between">
        {/* Container for title and number */}
        <div>
          {/* Render the title with small, muted text */}
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          {/* Render the main number with large, bold text */}
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {/* If a formatter is passed, use it; otherwise, use the AnimatedCounter component */}
            {formatter ? formatter(value) : <AnimatedCounter target={value} />}
          </p>
        </div>
        {/* Render the icon wrapper, merging the standard padding/rounding with the dynamic background class */}
        <div className={cn('p-2.5 rounded-xl', iconBg)}>
          {/* Render the icon component itself, merging standard sizing with dynamic color */}
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
      </div>

      {/* Conditionally render the trend section only if a trend value is provided */}
      {trend !== undefined && (
        // Container for the trend row: align items centered horizontally with a small gap
        <div className="flex items-center gap-1.5">
          {/* Check if trend is positive or negative and render corresponding icon */}
          {trend >= 0 ? (
            // Positive trend: Show green trending up arrow
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            // Negative trend: Show red trending down arrow
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          )}
          {/* Render the percentage text. Color it green if positive, red if negative */}
          <span className={cn('text-xs font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {/* Display '+' if positive, the number, and the '%' sign */}
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
          {/* Render the trend label (e.g. 'vs last month') in muted text */}
          <span className="text-xs text-slate-400">{trendLabel}</span>
        </div>
      )}
    </motion.div>
  )
} // Close the StatCard component
