"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  IconCheck,
  IconChevronDown,
  IconDiamond,
  IconMapPin,
  IconPlus,
  IconSelector,
  IconTrash,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useRef, useState } from "react";
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
  _tempId?: string;
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
            "h-auto min-h-9 w-full justify-between border-neutral-200 dark:border-border bg-white dark:bg-card px-3 py-2 text-[13px]",
            disabled && "cursor-not-allowed opacity-50"
          )}
          disabled={disabled}
        >
          <div className="flex flex-1 flex-wrap gap-1.5">
            {selected.length === 0 ? (
              <span className="font-normal text-neutral-400">{placeholder}</span>
            ) : (
              selectedLabels.map((label, i) => (
                <motion.span
                  key={selected[i]}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-200 dark:border-border bg-neutral-100 dark:bg-muted px-2 py-0.5 text-[12px] font-medium text-neutral-600 dark:text-neutral-400"
                >
                  {label}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(selected[i]!, e)}
                    className="text-neutral-400 transition-colors hover:text-neutral-600"
                    aria-label={`Remove ${label}`}
                  >
                    <IconX size={12} stroke={1.5} />
                  </button>
                </motion.span>
              ))
            )}
          </div>
          <IconSelector size={14} stroke={1.5} className="ml-2 shrink-0 text-neutral-400" />
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
                        : "border-neutral-300"
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
                          <IconCheck size={12} stroke={2} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className="text-[13px]">{option.label}</span>
                  <span className="ml-auto text-[11px] text-neutral-400">
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
      className="space-y-3 rounded-lg border border-neutral-200 dark:border-border bg-neutral-50/50 dark:bg-accent/30 p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
          Rule {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={disabled}
          className="h-8 w-8 p-0 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <IconTrash size={14} stroke={1.5} />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Type</label>
          <Select
            value={rule.type}
            onValueChange={(value: "country" | "continent") =>
              onChange({ ...rule, type: value, values: [] })
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="country">
                <div className="flex items-center gap-2">
                  <IconMapPin size={14} stroke={1.5} className="text-neutral-400" />
                  Country
                </div>
              </SelectItem>
              <SelectItem value="continent">
                <div className="flex items-center gap-2">
                  <IconWorld size={14} stroke={1.5} className="text-neutral-400" />
                  Continent
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Condition</label>
          <Select
            value={rule.condition}
            onValueChange={(value: "in" | "not_in") =>
              onChange({ ...rule, condition: value })
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px]">
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
        <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
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
        <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Action</label>
        <Select
          value={rule.action}
          onValueChange={(value: "redirect" | "block") =>
            onChange({ ...rule, action: value })
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px]">
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
            <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Redirect URL
            </label>
            <Input
              value={rule.destination || ""}
              onChange={(e) =>
                onChange({ ...rule, destination: e.target.value })
              }
              placeholder="https://example.com/alternative"
              disabled={disabled}
              className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
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
            <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Block message (optional)
            </label>
            <Input
              value={rule.blockMessage || ""}
              onChange={(e) =>
                onChange({ ...rule, blockMessage: e.target.value })
              }
              placeholder="This content is not available in your region."
              disabled={disabled}
              className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
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
  const idCounter = useRef(0);
  const geoRules: GeoRuleFormData[] = form.watch("geoRules") || [];

  const generateId = useCallback(() => {
    return `rule-${Date.now()}-${idCounter.current++}`;
  }, []);

  const addRule = () => {
    const newRule: GeoRuleFormData = {
      _tempId: generateId(),
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
    <div className="rounded-lg border border-neutral-200 dark:border-border p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col gap-0.5">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-neutral-900 dark:text-foreground">
            Geotargeting Rules
            {disabled && (
              <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-2 py-px text-[11px] font-medium uppercase text-neutral-500 dark:text-neutral-400">
                <IconDiamond size={12} stroke={1.5} className="text-neutral-400" />
                Pro
              </span>
            )}
            {geoRules.length > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-full bg-neutral-100 dark:bg-muted px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400"
              >
                {geoRules.length} {geoRules.length === 1 ? "rule" : "rules"}
              </motion.span>
            )}
          </p>
          <span className="text-[12px] text-neutral-400">
            Redirect or block visitors based on their location
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showLimitBadge && !disabled && (
            <span className="text-[11px] text-neutral-400">
              {geoRules.length}/{maxRules}
            </span>
          )}
          <IconChevronDown
            size={16}
            stroke={1.5}
            className={cn(
              "shrink-0 text-neutral-400 transition-transform duration-200",
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
                <div className="rounded-lg border border-dashed border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 p-6 text-center">
                  <IconWorld size={28} stroke={1.5} className="mx-auto text-neutral-300" />
                  <p className="mt-2 text-[13px] text-neutral-600 dark:text-neutral-400">
                    Upgrade to Pro to use geotargeting rules
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-400">
                    Redirect visitors to different URLs or block access based on
                    their country or continent.
                  </p>
                </div>
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    {geoRules.map((rule, index) => (
                      <GeoRuleItem
                        key={rule._tempId ?? `fallback-${index}`}
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
                      className="rounded-lg border border-dashed border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 p-6 text-center"
                    >
                      <IconWorld size={28} stroke={1.5} className="mx-auto text-neutral-300" />
                      <p className="mt-2 text-[13px] text-neutral-600 dark:text-neutral-400">
                        No geotargeting rules yet
                      </p>
                      <p className="mt-1 text-[12px] text-neutral-400">
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
                      "w-full gap-2 border-neutral-200 dark:border-border text-[13px] transition-all",
                      canAddMore
                        ? "hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
                        : "opacity-50"
                    )}
                  >
                    <IconPlus size={14} stroke={1.5} />
                    Add Rule
                    {!canAddMore && (
                      <span className="text-[11px] text-neutral-400">
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
