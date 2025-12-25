// ============================================
// GREPRE SMART LIFE - CUSTOM HOOKS
// ============================================

import { Colors } from '@/constants';
import { useAppStore, useBillStore, useDocumentStore } from '@/stores';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Keyboard, useColorScheme as useNativeColorScheme } from 'react-native';

// ============ THEME HOOK ============

export function useTheme() {
  const { colorScheme, settings } = useAppStore();
  const systemColorScheme = useNativeColorScheme();

  const actualScheme = settings.theme === 'system' 
    ? (systemColorScheme || 'light') 
    : settings.theme;

  return {
    colorScheme: actualScheme,
    colors: Colors[actualScheme],
    isDark: actualScheme === 'dark',
  };
}

// ============ REFRESH HOOK ============

export function useRefreshData() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetchBills = useBillStore((state) => state.fetchBills);
  const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
  const fetchReminders = useAppStore((state) => state.fetchReminders);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchBills(),
        fetchDocuments(),
        fetchReminders(),
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchBills, fetchDocuments, fetchReminders]);

  return { isRefreshing, refresh };
}

// ============ KEYBOARD HOOK ============

export function useKeyboard() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
    });

    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  return { isKeyboardVisible, keyboardHeight, dismissKeyboard };
}

// ============ DIMENSIONS HOOK ============

export function useDimensions() {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription.remove();
  }, []);

  return {
    width: dimensions.width,
    height: dimensions.height,
    isPortrait: dimensions.height > dimensions.width,
    isLandscape: dimensions.width > dimensions.height,
  };
}

// ============ DEBOUNCE HOOK ============

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============ SEARCH HOOK ============

export function useSearch<T>(
  items: T[],
  searchFn: (item: T, query: string) => boolean,
  delay: number = 300
) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, delay);
  const [results, setResults] = useState<T[]>(items);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(items);
    } else {
      const filtered = items.filter((item) => searchFn(item, debouncedQuery.toLowerCase()));
      setResults(filtered);
    }
  }, [debouncedQuery, items, searchFn]);

  return { query, setQuery, results };
}

// ============ LOADING HOOK ============

export function useLoading(initialState: boolean = false) {
  const [isLoading, setIsLoading] = useState(initialState);
  const [error, setError] = useState<string | null>(null);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  const setLoadingError = useCallback((errorMessage: string) => {
    setIsLoading(false);
    setError(errorMessage);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { isLoading, error, startLoading, stopLoading, setLoadingError, clearError };
}

// ============ FORM HOOK ============

export function useForm<T extends Record<string, any>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setFieldError = useCallback(<K extends keyof T>(field: K, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const setFieldTouched = useCallback(<K extends keyof T>(field: K) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  const isValid = Object.keys(errors).length === 0;

  return {
    values,
    errors,
    touched,
    setValue,
    setFieldError,
    setFieldTouched,
    reset,
    isValid,
    setValues,
    setErrors,
  };
}
