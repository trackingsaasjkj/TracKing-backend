export const ok = <T>(data: T) => ({ success: true, data });
export const fail = (error: string) => ({ success: false, error });
