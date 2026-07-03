import ReactMarkdown from "react-markdown";

// Task descriptions and announcements are markdown-lite: paragraphs, bold,
// lists, links. Styled inline (no typography plugin) to keep things simple.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-bold [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:space-y-1">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
