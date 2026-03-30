import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

const SUGGESTION_CHIPS = [
  "BABA price",
  "TSLA 7 day trend",
  "Why did NVDA rise?",
  "Market overview today",
];

export function ChatInput({ onSend, disabled = false, isLoading = false }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !disabled && !isLoading) {
      onSend(message);
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
  };

  return (
    <div className="bg-card border-t border-border">
      {/* Suggestions */}
      {message === "" && (
        <div className="px-6 py-4 border-b border-border">
          <p className="text-sm text-muted-foreground mb-3 font-medium">Quick suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleSuggestionClick(chip)}
                className="px-3 py-1.5 rounded-full border border-border text-sm text-foreground hover:bg-surface transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-6 py-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about stocks, trends, or financial concepts..."
              disabled={disabled || isLoading}
              className={cn(
                "w-full bg-surface border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground resize-none outline-none transition-colors",
                "focus:border-primary focus:ring-1 focus:ring-primary",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              rows={1}
              style={{ minHeight: "44px", maxHeight: "120px" }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={disabled || isLoading || !message.trim()}
            className={cn(
              "flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors font-medium",
              message.trim() && !disabled && !isLoading
                ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
            )}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
