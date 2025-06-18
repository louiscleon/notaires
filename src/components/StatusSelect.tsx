import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { NotaireStatut } from '../types';

interface StatusOption {
  value: NotaireStatut;
  label: string;
  icon: string;
}

const statusOptions: StatusOption[] = [
  { value: 'non_defini', label: 'Non défini', icon: '❓' },
  { value: 'favori', label: 'Favori', icon: '⭐️' },
  { value: 'envisage', label: 'À envisager', icon: '🤔' },
  { value: 'non_interesse', label: 'Non intéressé', icon: '❌' }
];

interface StatusSelectProps {
  value: NotaireStatut;
  onChange: (value: NotaireStatut) => void;
  label?: string;
  className?: string;
}

const StatusSelect: React.FC<StatusSelectProps> = ({ 
  value, 
  onChange, 
  label = "Statut", 
  className = "" 
}) => {
  const selectedOption = statusOptions.find(opt => opt.value === value);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <Listbox value={value} onChange={onChange}>
        <div className="relative">
          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white py-2.5 pl-3 pr-10 text-left border border-gray-300 hover:border-teal-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-colors duration-200">
            <span className="flex items-center space-x-2">
              <span className="text-xl">{selectedOption?.icon}</span>
              <span className="block truncate text-gray-900">{selectedOption?.label}</span>
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-[9999] w-full mt-1 max-h-60 overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {statusOptions.map((option) => (
                <Listbox.Option
                  key={option.value}
                  className={({ active }) =>
                    `relative cursor-pointer select-none py-2 pl-3 pr-9 ${
                      active ? 'bg-teal-50 text-teal-900' : 'text-gray-900'
                    }`
                  }
                  value={option.value}
                >
                  {({ selected, active }) => (
                    <div className="flex items-center space-x-2">
                      <span className="text-xl block">{option.icon}</span>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        {option.label}
                      </span>
                      {selected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-teal-600">
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
};

export default StatusSelect; 