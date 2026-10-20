/// <reference types="vite/client" />

// CSS Modules: Vite handles these at runtime; tsc needs the declaration.
declare module '*.module.css' {
    const classes: Record<string, string>;
    export default classes;
}

declare module '*.module.scss' {
    const classes: Record<string, string>;
    export default classes;
}
