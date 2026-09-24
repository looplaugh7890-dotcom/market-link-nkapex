import { useEffect, useState } from 'react';
import { errorMessage } from '../services/api';

// Runs `fn()` (returns an axios promise) whenever `deps` change.
export default function useFetch(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    setState((previousState) => ({ ...previousState, loading: true, error: '' }));
    fn()
      .then((res) => !cancelled && setState({ data: res.data, loading: false, error: '' }))
      .catch((err) => !cancelled && setState({ data: null, loading: false, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
