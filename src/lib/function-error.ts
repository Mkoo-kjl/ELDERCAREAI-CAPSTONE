import { FunctionsHttpError } from '@supabase/supabase-js';

type FunctionErrorBody = {
  error?: string;
  message?: string;
  code?: string | number;
  details?: { dataType?: string; status?: number; message?: string }[];
};

export async function getFunctionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.clone().json() as FunctionErrorBody;
      const detail = body.details?.map((item) => {
        const label = item.dataType ? `${item.dataType}: ` : '';
        return `${label}${item.message ?? `HTTP ${item.status ?? 'error'}`}`;
      }).join('\n');
      const message = body.error ?? body.message;
      if (message && detail) return `${message}\n\n${detail}`;
      if (message) return message;
    } catch {
      // Fall through to the SDK error message when the response is not JSON.
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
