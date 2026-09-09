import {useEffect, useMemo, useState} from 'react';
import {Select} from 'sapvt-ltd-web-packages';
import './CreatableLookupSelect.css';

const ADD_NEW = '__add_new__';

export interface CreatableLookupSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  addNewLabel?: string;
  newValuePlaceholder?: string;
  disabled?: boolean;
  showSearch?: boolean;
}

/**
 * Pick an existing HR label, or choose “Add new…” and type one.
 */
export function CreatableLookupSelect({
  options,
  value,
  onChange,
  placeholder = '—',
  addNewLabel = '+ Add new…',
  newValuePlaceholder = 'Type a new value',
  disabled = false,
  showSearch = true,
}: CreatableLookupSelectProps) {
  const knownList = useMemo(
    () =>
      [
        ...new Set(
          options.map((o) => String(o || '').trim()).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [options],
  );
  const known = useMemo(() => new Set(knownList), [knownList]);

  const valueIsCustom = Boolean(value && !known.has(value));
  const [adding, setAdding] = useState(valueIsCustom);
  const [draft, setDraft] = useState(valueIsCustom ? value : '');

  useEffect(() => {
    if (value && !known.has(value)) {
      setAdding(true);
      setDraft(value);
      return;
    }
    if (value && known.has(value)) {
      setAdding(false);
      setDraft('');
      return;
    }
    if (!value && !adding) {
      setDraft('');
    }
  }, [value, known, adding]);

  const selectOptions = useMemo(
    () => [
      {value: '', label: placeholder},
      ...knownList.map((label) => ({value: label, label})),
      {value: ADD_NEW, label: addNewLabel},
    ],
    [knownList, placeholder, addNewLabel],
  );

  const selectValue = adding ? ADD_NEW : value && known.has(value) ? value : '';

  return (
    <div className="creatable-lookup">
      <Select
        options={selectOptions}
        value={selectValue}
        disabled={disabled}
        showSearch={showSearch}
        onChange={(next) => {
          if (next === ADD_NEW) {
            setAdding(true);
            setDraft('');
            onChange('');
            return;
          }
          setAdding(false);
          setDraft('');
          onChange(next);
        }}
      />
      {adding ? (
        <input
          className="text-input creatable-lookup__input"
          value={draft}
          disabled={disabled}
          placeholder={newValuePlaceholder}
          autoComplete="off"
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            onChange(next);
          }}
        />
      ) : null}
    </div>
  );
}
