export function packageJsonTemplate(name: string): string {
  return JSON.stringify(
    {
      name: name.toLowerCase().replace(/\s+/g, "-"),
      private: true,
      version: "0.0.1",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "react-router-dom": "^7.1.5",
        zustand: "^5.0.11",
      },
      devDependencies: {
        "@types/react": "^18.3.18",
        "@types/react-dom": "^18.3.5",
        "@vitejs/plugin-react": "^4.3.4",
        "@tailwindcss/vite": "^4.1.18",
        tailwindcss: "^4.1.18",
        typescript: "^5.7.3",
        vite: "^6.1.0",
      },
    },
    null,
    2
  );
}

export const viteConfigTemplate = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
});
`;

export const tsconfigTemplate = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2020",
      useDefineForClassFields: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
    },
    include: ["src"],
  },
  null,
  2
);

export function readmeTemplate(name: string): string {
  return `# ${name}

Built with MeModule Developer.
`;
}
