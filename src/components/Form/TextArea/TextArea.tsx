import { clsx } from 'clsx';
import '../Form.scss';
import './TextArea.scss';

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  required?: boolean;
  className?: string; 
}

export default function TextArea({ label, value, onChange, placeholder, rows = 3, disabled = false, required = false, className }: Props) {
  return (
    <label className={clsx('form__field', className)}>
      {label && (
        <span className="form__label">
          {label}{required && <span className="form__required">*</span>}
        </span>
      )}
      <textarea
        className="form__textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
      />
    </label>
  );
}
