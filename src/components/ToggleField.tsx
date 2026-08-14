import React from 'react';

export interface ToggleFieldProps {
  id: string;
  name: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
}

export function ToggleField({
  id,
  name,
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: ToggleFieldProps) {
  return (
    <div className="form-group">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ flex: 1 }}>
          <label
            htmlFor={id}
            style={{
              display: 'block',
              fontWeight: 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {label}
          </label>
          {description ? (
            <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
              {description}
            </small>
          ) : null}
        </div>
        <label
          htmlFor={id}
          style={{
            position: 'relative',
            display: 'inline-flex',
            width: '46px',
            height: '28px',
            flexShrink: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <input
            type="checkbox"
            id={id}
            name={name}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            style={{
              opacity: 0,
              width: 0,
              height: 0,
              position: 'absolute',
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '999px',
              backgroundColor: disabled
                ? '#d0d7de'
                : checked
                  ? '#2ecc71'
                  : '#c7ccd1',
              transition: 'background-color 0.2s ease',
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '3px',
              left: checked ? '21px' : '3px',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.24)',
              transition: 'left 0.2s ease',
            }}
          />
        </label>
      </div>
    </div>
  );
}
