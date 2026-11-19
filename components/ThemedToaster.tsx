"use client";

import { Toaster } from "sonner";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";

/** Sonner, kept in step with the page theme (including manual choices). */
const ThemedToaster = () => {
  const theme = useResolvedTheme();
  return <Toaster theme={theme} richColors closeButton position="top-center" />;
};

export default ThemedToaster;
