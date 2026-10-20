// Wraps document.getElementById so the DOM's null never leaks past this seam.
export const getElementById = (id: string): HTMLElement | undefined => document.getElementById(id) ?? undefined;
