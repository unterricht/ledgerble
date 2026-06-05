import { useState, useEffect, useCallback } from 'react';

// FileState mirrors the old ui.js file-state object
function makeFileState(error, data) {
  if (data && data.postings) return { error, postings: data.postings, postingsCost: data.postingsCost || [], prices: data.prices || [] };
  return { error, postings: data || [], postingsCost: [], prices: [] };
}

export function useAppState() {
  const [files, setFiles] = useState(() => new Map());
  const [currency, setCurrency] = useState('USD');
  const [period, setPeriod] = useState('Monthly');
  const [dateRange, setDateRange] = useState(null);     // [fromIdx, toIdx] | null
  const [query, setQueryRaw] = useState('');
  const [view, setView] = useState('overview');
  const [deselectedAccounts, setDeselected] = useState(() => new Set());
  const [deselectedAssetAccounts, setDeselectedAssets] = useState(() => new Set());
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [postingType, setPostingType] = useState('all');

  // search routes to postings (mirrors the mockup onSearch)
  const setQuery = useCallback((v) => {
    setQueryRaw(v);
    setView((cur) => (v && cur !== 'postings' ? 'postings' : cur));
  }, []);

  const toggleAccount = useCallback((path) => {
    setDeselected((p) => { const n = new Set(p); n.has(path) ? n.delete(path) : n.add(path); return n; });
  }, []);

  // subscribe to parsed results once
  useEffect(() => {
    if (!window.api || !window.api.onParsed) return;
    window.api.onParsed((file, result, error) => {
      setFiles((prev) => { const n = new Map(prev); n.set(file, makeFileState(error, result)); return n; });
    });
  }, []);

  return {
    files, setFiles,
    currency, setCurrency,
    period, setPeriod,
    dateRange, setDateRange,
    query, setQuery,
    view, setView,
    deselectedAccounts, toggleAccount, setDeselected,
    deselectedAssetAccounts, setDeselectedAssets,
    inspectorOpen, setInspectorOpen,
    postingType, setPostingType,
  };
}
