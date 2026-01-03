"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface CreatableSelectOption {
  value: string
  label: string
}

interface CreatableSelectProps {
  options: CreatableSelectOption[]
  value: string
  onSelect: (value: string) => void
  onCreate?: (value: string) => Promise<void>
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  createLabel?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  isLoading?: boolean
}

export function CreatableSelect({
  options,
  value,
  onSelect,
  onCreate,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar o crear...",
  emptyMessage = "No se encontraron resultados.",
  createLabel = "Crear",
  disabled = false,
  className,
  triggerClassName,
  isLoading = false,
}: CreatableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)

  const selectedOption = React.useMemo(() => {
    return options.find((option) => option.value === value) || null
  }, [options, value])

  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return options
    return options.filter((option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    )
  }, [options, inputValue])

  const showCreateOption = React.useMemo(() => {
    if (!inputValue.trim() || !onCreate) return false
    return !options.some(
      (option) => option.label.toLowerCase() === inputValue.toLowerCase()
    )
  }, [options, inputValue, onCreate])

  const handleCreate = async () => {
    if (!onCreate || !inputValue.trim()) return
    
    setIsCreating(true)
    try {
      await onCreate(inputValue.trim())
      onSelect(inputValue.trim())
      setInputValue("")
      setOpen(false)
    } catch (error) {
      console.error("Error creating option:", error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn("w-full justify-between", triggerClassName)}
        >
          <span className="truncate">
            {isLoading ? "Cargando..." : selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[300px] p-0", className)}>
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {filteredOptions.length === 0 && !showCreateOption && (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onSelect(option.value === value ? "" : option.value)
                    setInputValue("")
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{option.label}</span>
                </CommandItem>
              ))}
              {showCreateOption && (
                <CommandItem
                  onSelect={handleCreate}
                  disabled={isCreating}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span>
                    {isCreating ? "Creando..." : `${createLabel} "${inputValue}"`}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
