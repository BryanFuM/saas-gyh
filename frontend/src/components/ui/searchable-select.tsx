"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

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

export interface SearchableSelectOption {
  value: string | number
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string | number | null
  onSelect: (value: string | number | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
}

export function SearchableSelect({
  options,
  value,
  onSelect,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron resultados.",
  disabled = false,
  className,
  triggerClassName,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = React.useMemo(() => {
    return options.find((option) => option.value === value) || null
  }, [options, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", triggerClassName)}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[400px] p-0", className)}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option.value === value ? null : option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.sublabel && (
                      <span className="text-xs text-muted-foreground">
                        {option.sublabel}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Specialized version for Products with stock info
interface ProductSelectProps {
  products: Array<{
    id: number
    name: string
    type: string
    quality: string
    conversion_factor: number
  }>
  stockMap: Record<number, number>
  value: number | null
  onSelect: (productId: number | null) => void
  disabled?: boolean
}

export function ProductSelect({
  products,
  stockMap,
  value,
  onSelect,
  disabled = false,
}: ProductSelectProps) {
  const options: SearchableSelectOption[] = React.useMemo(() => {
    return products.map((product) => ({
      value: product.id,
      label: `${product.name} - ${product.type} (${product.quality})`,
      sublabel: `Stock: ${(stockMap[product.id] || 0).toFixed(2)} javas | Factor: ${product.conversion_factor} kg/java`,
    }))
  }, [products, stockMap])

  return (
    <SearchableSelect
      options={options}
      value={value}
      onSelect={(val) => onSelect(val as number | null)}
      placeholder="Buscar producto..."
      searchPlaceholder="Nombre del producto..."
      emptyMessage="No se encontró el producto."
      disabled={disabled}
    />
  )
}

// Specialized version for Clients with debt info
interface ClientSelectProps {
  clients: Array<{
    id: number
    name: string
    current_debt: number | string
    whatsapp_number?: string
  }>
  value: number | null
  onSelect: (clientId: number | null) => void
  disabled?: boolean
}

export function ClientSelect({
  clients,
  value,
  onSelect,
  disabled = false,
}: ClientSelectProps) {
  const options: SearchableSelectOption[] = React.useMemo(() => {
    return clients.map((client) => ({
      value: client.id,
      label: client.name,
      sublabel: `Deuda: S/. ${Number(client.current_debt).toFixed(2)}${client.whatsapp_number ? ` | Tel: ${client.whatsapp_number}` : ""}`,
    }))
  }, [clients])

  return (
    <SearchableSelect
      options={options}
      value={value}
      onSelect={(val) => onSelect(val as number | null)}
      placeholder="Buscar cliente..."
      searchPlaceholder="Nombre del cliente..."
      emptyMessage="No se encontró el cliente."
      disabled={disabled}
    />
  )
}
