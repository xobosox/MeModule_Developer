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
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      devDependencies: {
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.2.0",
        typescript: "^5.3.0",
        vite: "^5.0.0",
      },
    },
    null,
    2
  );
}

export const viteConfigTemplate = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
