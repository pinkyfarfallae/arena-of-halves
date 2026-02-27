import { clsx } from 'clsx';
import '../Form.scss';
import './Input.scss';

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export default function Input({ label, value, onChange, placeholder, type = 'text', disabled = false, required = false, className }: Props) {
  return (
    <label className={clsx('form__field', className)}>
      {label && (
        <span className="form__label">
          {label}{required && <span className="form__required">*</span>}
        </span>
      )}
      <input
        className="form__input"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}
