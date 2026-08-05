'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
    const [dark, setDark] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = stored ? stored === 'dark' : prefersDark;
        setDark(isDark);
        document.documentElement.classList.toggle('dark', isDark);
    }, []);

    function toggle() {
        setDark(prev => {
            const next = !prev;
            document.documentElement.classList.toggle('dark', next);
            localStorage.setItem('theme', next ? 'dark' : 'light');
            return next;
        });
    }

    return (
        <ThemeContext.Provider value={{ dark, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
