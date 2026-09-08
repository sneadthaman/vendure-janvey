"use client";

import {ThemeProvider as NextThemesProvider} from "next-themes";

export function ThemeProvider({children}: {children: React.ReactNode}) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            // Run the initial theme script in server HTML; client mounts use the
            // provider's effects, so their script must be an inert data block.
            scriptProps={{type: typeof window === "undefined" ? "text/javascript" : "text/plain"}}
        >
            {children}
        </NextThemesProvider>
    );
}
