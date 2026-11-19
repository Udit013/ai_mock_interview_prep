import React from 'react'
import {cn, getTechLogos} from "@/lib/utils";
import Image from "next/image";

const DisplayTechIcons = async ({ techStack }: TechIconProps) => {
    // Only three are shown, so only look up three.
    const techIcons = await getTechLogos((techStack ?? []).slice(0, 3));

    return (
        <div className="flex flex-row">{techIcons.map(({ tech, url }, index) => (
            <div key={tech} tabIndex={0} role="img" aria-label={tech} className={cn("relative group flex-center rounded-full border border-line bg-surface p-1.5", index >= 1 && '-ml-2')}>
                <span className="tech-tooltip">{tech}</span>
                {url === "/tech.svg" ? (
                    // No logo for this tech: a theme-aware text badge instead of
                    // the white fallback image, which vanished on light backgrounds.
                    <span aria-hidden="true" className="flex size-4 items-center justify-center text-[0.55rem] font-semibold uppercase leading-none text-fg-muted">
                        {tech.replace(/[^a-z0-9]/gi, "").slice(0, 2)}
                    </span>
                ) : (
                    <Image src={url} alt="" width={100} height={100} className="size-4" />
                )}
            </div>
        ))}</div>
    )
}
export default DisplayTechIcons
