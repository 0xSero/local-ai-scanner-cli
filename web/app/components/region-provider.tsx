"use client";
import * as React from "react";

type RegionCode = "ALL" | "US" | "DE" | "GB" | "JP";

interface RegionContextValue {
  region: RegionCode;
  setRegion: (r: RegionCode) => void;
}

const RegionContext = React.createContext<RegionContextValue>({
  region: "ALL",
  setRegion: () => {},
});

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegion] = React.useState<RegionCode>("ALL");
  return (
    <RegionContext.Provider value={{ region, setRegion }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return React.useContext(RegionContext);
}

export type { RegionCode };
