import Editor from "@monaco-editor/react";

interface MonacoEditorProps {
  path: string;
  content: string;
  onChange: (value: string) => void;
}

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    default:
      return "plaintext";
  }
}

export default function MonacoEditor({ path, content, onChange }: MonacoEditorProps) {
  return (
    <Editor
      path={path}
      defaultLanguage={getLanguage(path)}
      defaultValue={content}
      theme="vs-dark"
      onChange={(value) => onChange(value ?? "")}
      options={{
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  );
}
