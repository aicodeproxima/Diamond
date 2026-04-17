'use client';

import { forwardRef, useId } from 'react';
import { Input } from '@/components/ui/input';

interface PredictiveInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * List of known values to offer as native browser autocomplete suggestions.
   * Uses <datalist> under the hood so it works without any JS state and
   * integrates with the browser's existing autofill/autocomplete UI.
   */
  suggestions?: string[];
}

/**
 * Text input with predictive search powered by the native <datalist> element.
 * Users can type anything, but known values show up as suggestions as they
 * type. Use this anywhere the app already knows likely values
 * (names, groups, subjects, rooms, etc.).
 */
export const PredictiveInput = forwardRef<HTMLInputElement, PredictiveInputProps>(
  function PredictiveInput({ suggestions = [], list, ...rest }, ref) {
    const generatedId = useId();
    const listId = list || `predict-${generatedId}`;
    // Deduplicate and drop empties
    const unique = Array.from(new Set(suggestions.filter((s) => s && s.trim())));

    return (
      <>
        <Input ref={ref} list={listId} autoComplete="off" {...rest} />
        <datalist id={listId}>
          {unique.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </>
    );
  },
);
