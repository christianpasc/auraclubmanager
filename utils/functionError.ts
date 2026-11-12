import type { FunctionsError } from '@supabase/supabase-js';

// Pulls the real message out of a failed Edge Function call.
//
// supabase-js reports any non-2xx as the generic "Edge Function returned a
// non-2xx status code" and tucks the actual response on error.context. Showing
// the raw message tells a user nothing — especially now that these functions
// answer 403 with a reason worth reading ("confirm your email first").

export interface FunctionFailure {
    /** Human-readable message from the function, when it sent one. */
    message: string;
    /** Machine-readable code, e.g. 'email_not_verified' or 'not_a_member'. */
    reason?: string;
}

export async function readFunctionError(
    error: FunctionsError | Error | null | undefined,
    fallback: string,
): Promise<FunctionFailure> {
    if (!error) return { message: fallback };

    try {
        const body = await (error as any).context?.json?.();
        if (body?.error) {
            return { message: String(body.error), reason: body.reason };
        }
    } catch {
        // Response was not JSON, or the body had already been read.
    }

    return { message: (error as Error).message || fallback };
}
