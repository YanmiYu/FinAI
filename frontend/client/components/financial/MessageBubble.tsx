import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: string;
}

export function UserMessage({ message }: MessageBubbleProps) {
  return (
    <div className="flex justify-end mb-6">
      <div className="max-w-2xl bg-primary text-primary-foreground rounded-lg px-4 py-3">
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
