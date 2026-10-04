import React from 'react'
import {cn, getTechLogos} from "@/lib/utils";
import Image from "next/image";

const DisplayTechIcons = async ({ techStack }: TechIconProps) => {
    // Only three are shown, so only look up three.
    const techIcons = await getTechLogos((techStack ?? []).slice(0, 3));

    return (
        <div className="flex flex-row">{techIcons.map(({ tech, url }, index) => (
            <div key={tech} className={cn("relative group bg-dark-300 rounded-full p-2 flex-center", index >= 1 && '-ml-3')}>
                <span className="tech-tooltip">{tech}</span>
                <Image src={url} alt={tech} width={100} height={100} className="size-5" />
            </div>
        ))}</div>
    )
}
export default DisplayTechIcons
