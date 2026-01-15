"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  Gem,
  Globe,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";

const CONTINENTS = {
  AF: "Africa",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
} as const;

type GeoRuleFormData = {
  type: "country" | "continent";
  condition: "in" | "not_in";
  values: string[];
  action: "redirect" | "block";
  destination?: string;
  blockMessage?: string;
};

type GeoRulesFormProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  disabled?: boolean;
  maxRules?: number;
  isUnlimited?: boolean;
};

const countryOptions = Object.entries(COUNTRIES).map(([code, name]) => ({
  value: code,
  label: name,
}));

const continentOptions = Object.entries(CONTINENTS).map(([code, name]) => ({
  value: code,
  label: name,
}));

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  disabled,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (value: string) => {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    },
    [selected, onChange]
  );

  const handleRemove = useCallback(
    (value: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(selected.filter((v) => v !== value));
    },
    [selected, onChange]
  );

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-auto min-h-9 px-3 py-2",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1.5 flex-1">
            {selected.length === 0 ? (
              <span className="text-gray-500 font-normal">{placeholder}</span>
            ) : (
              selectedLabels.map((label, i) => (
                <motion.span
                  key={selected[i]}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100"
                >
                  {label}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(selected[i]!, e)}
                    className="text-blue-500 hover:text-blue-700 transition-colors"
                    aria-label={`Remove ${label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.span>
              ))
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                  className="cursor-pointer"
                >
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border transition-colors",
                      selected.includes(option.value)
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300"
                    )}
                  >
                    <AnimatePresence>
                      {selected.includes(option.value) && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0 }}
                          transition={{ duration: 0.1 }}
                        >
                          <Check className="h-3 w-3" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className="text-sm">{option.label}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {option.value}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function GeoRuleItem({
  index,
  rule,
  onChange,
  onRemove,
  disabled,
}: {
  index: number;
  rule: GeoRuleFormData;
  onChange: (rule: GeoRuleFormData) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const options = rule.type === "country" ? countryOptions : continentOptions;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, height: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Rule {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={disabled}
          className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Type</label>
          <Select
            value={rule.type}
            onValueChange={(value: "country" | "continent") =>
              onChange({ ...rule, type: value, values: [] })
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="country">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-gray-500" />
                  Country
                </div>
              </SelectItem>
              <SelectItem value="continent">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-gray-500" />
                  Continent
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Condition</label>
          <Select
            value={rule.condition}
            onValueChange={(value: "in" | "not_in") =>
              onChange({ ...rule, condition: value })
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in">Is in</SelectItem>
              <SelectItem value="not_in">Is not in</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">
          {rule.type === "country" ? "Countries" : "Continents"}
        </label>
        <MultiSelect
          options={options}
          selected={rule.values}
          onChange={(values) => onChange({ ...rule, values })}
          placeholder={`Select ${rule.type === "country" ? "countries" : "continents"}...`}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">Action</label>
        <Select
          value={rule.action}
          onValueChange={(value: "redirect" | "block") =>
            onChange({ ...rule, action: value })
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="redirect">Redirect to URL</SelectItem>
            <SelectItem value="block">Block access</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AnimatePresence mode="wait">
        {rule.action === "redirect" ? (
          <motion.div
            key="redirect"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-1.5"
          >
            <label className="text-xs font-medium text-gray-600">
              Redirect URL
            </label>
            <Input
              value={rule.destination || ""}
              onChange={(e) =>
                onChange({ ...rule, destination: e.target.value })
              }
              placeholder="https://example.com/alternative"
              disabled={disabled}
              className="h-9"
            />
          </motion.div>
        ) : (
          <motion.div
            key="block"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-1.5"
          >
            <label className="text-xs font-medium text-gray-600">
              Block message (optional)
            </label>
            <Input
              value={rule.blockMessage || ""}
              onChange={(e) =>
                onChange({ ...rule, blockMessage: e.target.value })
              }
              placeholder="This content is not available in your region."
              disabled={disabled}
              className="h-9"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function GeoRulesForm({
  form,
  disabled = false,
  maxRules,
  isUnlimited = false,
}: GeoRulesFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const geoRules: GeoRuleFormData[] = form.watch("geoRules") || [];

  const addRule = () => {
    const newRule: GeoRuleFormData = {
      type: "country",
      condition: "in",
      values: [],
      action: "redirect",
      destination: "",
    };
    form.setValue("geoRules", [...geoRules, newRule]);
  };

  const updateRule = (index: number, rule: GeoRuleFormData) => {
    const updated = [...geoRules];
    updated[index] = rule;
    form.setValue("geoRules", updated);
  };

  const removeRule = (index: number) => {
    form.setValue(
      "geoRules",
      geoRules.filter((_, i) => i !== index)
    );
  };

  const canAddMore = isUnlimited || !maxRules || geoRules.length < maxRules;
  const showLimitBadge = !isUnlimited && maxRules !== undefined;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col">
          <p className="flex items-center gap-2 text-lg font-semibold">
            Geotargeting Rules
            {disabled && (
              <span className="flex max-w-fit items-center space-x-1 whitespace-nowrap rounded-full border border-gray-300 bg-gray-100 px-2 py-px text-xs font-medium capitalize text-gray-800">
                <Gem className="h-4 w-4 text-slate-500" />
                <span className="uppercase">Pro</span>
              </span>
            )}
            {geoRules.length > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
              >
                {geoRules.length} {geoRules.length === 1 ? "rule" : "rules"}
              </motion.span>
            )}
          </p>
          <span className="text-sm text-gray-500">
            Redirect or block visitors based on their location
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showLimitBadge && !disabled && (
            <span className="text-xs text-gray-400">
              {geoRules.length}/{maxRules}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-5 w-5 transform transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {disabled ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                  <Globe className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    Upgrade to Pro to use geotargeting rules
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Redirect visitors to different URLs or block access based on
                    their country or continent.
                  </p>
                </div>
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    {geoRules.map((rule, index) => (
                      <GeoRuleItem
                        key={index}
                        index={index}
                        rule={rule}
                        onChange={(updated) => updateRule(index, updated)}
                        onRemove={() => removeRule(index)}
                        disabled={disabled}
                      />
                    ))}
                  </AnimatePresence>

                  {geoRules.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center"
                    >
                      <Globe className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">
                        No geotargeting rules yet
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Add rules to redirect or block visitors based on their
                        location.
                      </p>
                    </motion.div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRule}
                    disabled={!canAddMore}
                    className={cn(
                      "w-full gap-2 transition-all",
                      canAddMore
                        ? "hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                        : "opacity-50"
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    Add Rule
                    {!canAddMore && (
                      <span className="text-xs text-gray-400">
                        (limit reached)
                      </span>
                    )}
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
