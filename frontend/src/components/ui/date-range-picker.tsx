"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  className?: string
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const presets = [
    {
      label: "Hoy",
      getValue: () => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999)
        return { from: today, to: endOfDay }
      },
    },
    {
      label: "Esta Semana",
      getValue: () => {
        const today = new Date()
        const start = startOfWeek(today, { weekStartsOn: 1 }) // Monday
        return { from: start, to: today }
      },
    },
    {
      label: "Este Mes",
      getValue: () => {
        const today = new Date()
        const start = startOfMonth(today)
        return { from: start, to: today }
      },
    },
    {
      label: "Últimos 30 Días",
      getValue: () => {
        const today = new Date()
        const start = subDays(today, 30)
        return { from: start, to: today }
      },
    },
    {
      label: "Mes Anterior",
      getValue: () => {
        const today = new Date()
        const lastMonth = subMonths(today, 1)
        const start = startOfMonth(lastMonth)
        const end = endOfMonth(lastMonth)
        return { from: start, to: end }
      },
    },
  ]

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "dd MMM yyyy", { locale: es })} -{" "}
                  {format(dateRange.to, "dd MMM yyyy", { locale: es })}
                </>
              ) : (
                format(dateRange.from, "dd MMM yyyy", { locale: es })
              )
            ) : (
              <span>Seleccionar fechas...</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="flex flex-col gap-1 border-r p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Filtros Rápidos
              </p>
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-sm"
                  onClick={() => {
                    onDateRangeChange(preset.getValue())
                    setOpen(false)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
              <hr className="my-2" />
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-sm text-muted-foreground"
                onClick={() => {
                  onDateRangeChange(undefined)
                  setOpen(false)
                }}
              >
                Limpiar
              </Button>
            </div>
            <div className="p-3">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={onDateRangeChange}
                numberOfMonths={2}
                locale={es}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
