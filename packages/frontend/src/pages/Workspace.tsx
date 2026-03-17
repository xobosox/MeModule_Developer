import { useParams } from "react-router-dom";

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-2xl font-bold">Workspace</h1>
      <p className="text-slate-400 mt-2">Project: {id}</p>
    </div>
  );
}
