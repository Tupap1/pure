import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FormErrorsProps {
  errors: Record<string, string>;
}

/**
 * Resumen de errores de validación de un formulario.
 *
 * Existe porque varios formularios guardaban el resultado de Zod en estado y nunca lo
 * mostraban: al fallar la validación el guardado se abortaba en silencio y el usuario
 * volvía a pulsar el botón sin saber qué faltaba.
 */
export const FormErrors: React.FC<FormErrorsProps> = ({ errors }) => {
  const messages = Object.entries(errors);
  if (messages.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex gap-2 rounded-lg border border-rose-300 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 p-3"
    >
      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
      <ul className="space-y-0.5 text-xs text-rose-700 dark:text-rose-300">
        {messages.map(([field, message]) => (
          <li key={field}>{message}</li>
        ))}
      </ul>
    </div>
  );
};
