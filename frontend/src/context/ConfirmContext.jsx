import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ConfirmContext = createContext(() => Promise.resolve(true));

// const confirm = useConfirm(); if (await confirm({ title, message, confirmText, danger })) ...
// A styled, keyboard-friendly replacement for window.confirm (Esc cancels, Enter confirms).
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const okRef = useRef(null);

  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  useEffect(() => {
    if (!state) return undefined;
    okRef.current?.focus();
    const onKey = (event) => event.key === 'Escape' && close(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-back" onMouseDown={(event) => event.target === event.currentTarget && close(false)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="cf-title" aria-describedby="cf-msg">
            <h2 id="cf-title">{state.title || 'Are you sure?'}</h2>
            {state.message && <p id="cf-msg" className="muted">{state.message}</p>}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => close(false)}>
                Cancel
              </button>
              <button ref={okRef} className={`btn ${state.danger ? 'btn-danger' : ''}`} onClick={() => close(true)}>
                {state.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
