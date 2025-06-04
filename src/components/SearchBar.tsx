import React, { useCallback } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
  className?: string;
}

const SearchBar: React.FC<Props> = React.memo(({ value, onChange, resultCount, className = '' }) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="Rechercher un notaire..."
          className="w-full px-4 py-2 pl-10 pr-4 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
      {resultCount !== undefined && (
        <div className="absolute right-0 top-0 h-full flex items-center pr-3">
          <span className="text-sm text-gray-500">{resultCount} résultat{resultCount !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar; 