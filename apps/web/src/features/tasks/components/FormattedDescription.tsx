import React, { ReactNode } from "react";

export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Parses inline formatting:
 * 1. Links: [text](url) -> only http:// and https://
 * 2. Bold: **text**
 * 3. Italic: *text*
 */
export function parseInline(text: string, keyPrefix = ""): ReactNode[] {
  const regex =
    /(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*\n]+?)\*\*)|(\*([^*\n]+?)\*)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let matchCount = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-${matchCount++}-${match.index}`;

    if (match[1]) {
      const label = match[2];
      const url = match[3];
      if (isSafeUrl(url)) {
        nodes.push(
          <a
            key={key}
            href={url.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            {parseInline(label, `${key}-a`)}
          </a>,
        );
      } else {
        nodes.push(match[0]);
      }
    } else if (match[4]) {
      nodes.push(
        <strong key={key}>{parseInline(match[5], `${key}-b`)}</strong>,
      );
    } else if (match[6]) {
      nodes.push(<em key={key}>{parseInline(match[7], `${key}-i`)}</em>);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function FormattedDescription({
  text,
  className = "formatted-description",
}: {
  text: string;
  className?: string;
}) {
  if (!text) return null;

  const lines = text.split(/\r?\n/);
  const elements: ReactNode[] = [];

  let currentListItems: string[] = [];
  let currentParagraphLines: string[] = [];

  const flushParagraph = (key: string) => {
    if (currentParagraphLines.length > 0) {
      elements.push(
        <p key={key}>
          {currentParagraphLines.map((line, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <br />}
              {parseInline(line, `${key}-${idx}`)}
            </React.Fragment>
          ))}
        </p>,
      );
      currentParagraphLines = [];
    }
  };

  const flushList = (key: string) => {
    if (currentListItems.length > 0) {
      elements.push(
        <ul key={key}>
          {currentListItems.map((item, idx) => (
            <li key={idx}>{parseInline(item, `${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      currentListItems = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const listMatch = line.match(/^\s*[-*]\s+(.*)$/);

    if (listMatch) {
      flushParagraph(`p-${index}`);
      currentListItems.push(listMatch[1]);
    } else if (trimmed === "") {
      flushParagraph(`p-${index}`);
      flushList(`ul-${index}`);
    } else {
      flushList(`ul-${index}`);
      currentParagraphLines.push(line);
    }
  });

  flushParagraph("p-final");
  flushList("ul-final");

  return <div className={className}>{elements}</div>;
}
