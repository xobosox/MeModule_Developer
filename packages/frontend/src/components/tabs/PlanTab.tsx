interface PlanTabProps {
  content: string;
}

export default function PlanTab({ content }: PlanTabProps) {
  if (!content) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Start a conversation to see your module plan here.
      </div>
    );
  }

  return (
    <div
      className="p-4 prose prose-invert prose-sm max-w-none overflow-y-auto h-full"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
