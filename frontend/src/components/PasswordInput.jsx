import { useState } from 'react';
import { IconEye, IconEyeOff } from './Icons';

// Password field with a show/hide (eye) button. Accepts the same props as <input>.
export default function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw-field">
      <input {...props} type={show ? 'text' : 'password'} />
      <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
        {show ? <IconEyeOff width={20} height={20} /> : <IconEye width={20} height={20} />}
      </button>
    </span>
  );
}
