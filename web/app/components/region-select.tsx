"use client";
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useRegion } from "./region-provider";

const ITEMS = [
  { value: "ALL", label: "All regions" },
  { value: "US", label: "United States" },
  { value: "DE", label: "Germany" },
  { value: "GB", label: "United Kingdom" },
  { value: "JP", label: "Japan" },
  { value: "PL", label: "Poland" },
];

export function RegionSelect() {
  const { region, setRegion } = useRegion();

  return (
    <Select value={region} onValueChange={(v) => setRegion(v as typeof region)}>
      <SelectTrigger className="w-[130px] gap-1 text-xs">
        <span className="text-muted-foreground">Region:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
