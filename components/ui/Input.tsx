import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block text-[13px] font-medium text-[#374151] mb-1.5">{label}</label>
        )}
        <input
          ref={ref}
          className={`w-full bg-bg-input border ${error ? 'border-red shadow-[0_0_0_3px_#FEE2E2]' : 'border-border-input'} rounded-[10px] px-3.5 py-3 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_#DCFCE7] transition-all ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-[12px] text-red">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-[12px] text-text-tertiary">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
