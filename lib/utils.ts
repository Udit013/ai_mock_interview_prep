import { interviewCovers, mappings } from "@/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const techIconBaseURL = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons";

const normalizeTechName = (tech: string) => {
  const key = tech.toLowerCase().replace(/\.js$/, "").replace(/\s+/g, "");
  return mappings[key as keyof typeof mappings];
};

/**
 * Icon existence never changes for a given URL, so remember the answer for the
 * life of the server instance instead of re-checking on every render. Storing
 * the promise also collapses concurrent checks for the same icon into one.
 */
const iconExistsCache = new Map<string, Promise<boolean>>();

const checkIconExists = (url: string): Promise<boolean> => {
  let pending = iconExistsCache.get(url);
  if (!pending) {
    pending = fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) })
      .then((response) => response.ok)
      .catch(() => {
        // A network blip isn't an answer — let the next render try again.
        iconExistsCache.delete(url);
        return false;
      });
    iconExistsCache.set(url, pending);
  }
  return pending;
};

/** Resolve logo URLs, falling back to a generic icon. */
export const getTechLogos = async (techArray: string[]) =>
  Promise.all(
    techArray.map(async (tech) => {
      const normalized = normalizeTechName(tech);
      // No mapping means no devicon — don't ask the CDN for ".../undefined".
      if (!normalized) return { tech, url: "/tech.svg" };
      const url = `${techIconBaseURL}/${normalized}/${normalized}-original.svg`;
      return { tech, url: (await checkIconExists(url)) ? url : "/tech.svg" };
    })
  );

export const getRandomInterviewCover = () => {
  const randomIndex = Math.floor(Math.random() * interviewCovers.length);
  return `/covers${interviewCovers[randomIndex]}`;
};
