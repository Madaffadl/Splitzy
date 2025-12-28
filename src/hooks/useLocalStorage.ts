"use client";

import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(
    key: string,
    initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
    // State to store our value
    const [storedValue, setStoredValue] = useState<T>(initialValue);
    const [isHydrated, setIsHydrated] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const item = window.localStorage.getItem(key);
            if (item) {
                setStoredValue(JSON.parse(item));
            }
        } catch (error) {
            console.warn(`Error loading from localStorage key "${key}":`, error);
        }
        setIsHydrated(true);
    }, [key]);

    // Save to localStorage whenever value changes
    useEffect(() => {
        if (!isHydrated) return;

        try {
            window.localStorage.setItem(key, JSON.stringify(storedValue));
        } catch (error) {
            console.warn(`Error saving to localStorage key "${key}":`, error);
        }
    }, [key, storedValue, isHydrated]);

    const setValue = useCallback((value: T | ((prev: T) => T)) => {
        setStoredValue((prev) => {
            const nextValue = value instanceof Function ? value(prev) : value;
            return nextValue;
        });
    }, []);

    const resetValue = useCallback(() => {
        try {
            window.localStorage.removeItem(key);
        } catch (error) {
            console.warn(`Error removing localStorage key "${key}":`, error);
        }
        setStoredValue(initialValue);
    }, [key, initialValue]);

    return [storedValue, setValue, resetValue];
}
