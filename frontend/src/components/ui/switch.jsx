import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-primary data-[state=checked]:border-transparent",
      "data-[state=unchecked]:bg-[#2A2A2A] data-[state=unchecked]:border data-[state=unchecked]:border-[rgba(201,167,255,0.4)]",
      className
    )}
    {...props}
    ref={ref}>
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full shadow-lg ring-0 transition-transform",
        "data-[state=checked]:translate-x-4 data-[state=checked]:bg-background",
        "data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-white data-[state=unchecked]:ring-1 data-[state=unchecked]:ring-white"
      )} />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
