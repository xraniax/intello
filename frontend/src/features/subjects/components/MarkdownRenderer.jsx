import React from 'react';

/**
 * MarkdownRenderer
 * Lightweight markdown renderer without external dependencies.
 * Supports: headers, bold, italic, inline code, code blocks,
 * ordered/unordered lists, blockquotes, horizontal rules, and tables.
 */

// Parses inline markdown within a text string
const renderInline = (text, key = '') => {
    if (!text) return null;

    const parts = [];
    let remaining = text;
    let i = 0;

    const patterns = [
        // Bold+italic
        { re: /\*\*\*(.+?)\*\*\*/g, render: (m, $1, k) => <strong key={k}><em>{$1}</em></strong> },
        // Bold
        { re: /\*\*(.+?)\*\*/g, render: (m, $1, k) => <strong key={k}>{$1}</strong> },
        // Italic
        { re: /\*(.+?)\*/g, render: (m, $1, k) => <em key={k}>{$1}</em> },
        // Inline code
        { re: /`([^`]+)`/g, render: (m, $1, k) => (
            <code key={k} className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[0.85em] border border-indigo-100">
                {$1}
            </code>
        )},
    ];

    // Combine all patterns into one
    const combined = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g;
    let lastIndex = 0;
    let match;
    const result = [];
    let idx = 0;

    combined.lastIndex = 0;
    while ((match = combined.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            result.push(text.slice(lastIndex, match.index));
        }

        if (match[1] !== undefined) {
            result.push(<strong key={`${key}-${idx++}`}><em>{match[1]}</em></strong>);
        } else if (match[2] !== undefined) {
            result.push(<strong key={`${key}-${idx++}`}>{match[2]}</strong>);
        } else if (match[3] !== undefined) {
            result.push(<em key={`${key}-${idx++}`}>{match[3]}</em>);
        } else if (match[4] !== undefined) {
            result.push(
                <code key={`${key}-${idx++}`} className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[0.85em] border border-indigo-100">
                    {match[4]}
                </code>
            );
        }
        lastIndex = combined.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        result.push(text.slice(lastIndex));
    }

    return result.length === 1 && typeof result[0] === 'string' ? result[0] : result;
};

const MarkdownRenderer = ({ content, className = '' }) => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements = [];
    let i = 0;
    let blockKey = 0;

    const nextKey = () => `md-${blockKey++}`;

    while (i < lines.length) {
        const line = lines[i];

        // ── Fenced code block ─────────────────────────────────────────────────
        if (line.trimStart().startsWith('```')) {
            const lang = line.trim().slice(3).trim();
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // skip closing ```
            elements.push(
                <div key={nextKey()} className="my-3 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                    {lang && (
                        <div className="px-4 py-1.5 bg-gray-800 text-gray-400 text-[10px] font-mono uppercase tracking-widest flex items-center justify-between">
                            <span>{lang}</span>
                        </div>
                    )}
                    <pre className={`${lang ? '' : 'rounded-xl'} bg-gray-900 text-gray-100 p-4 overflow-x-auto text-[13px] font-mono leading-relaxed`}>
                        <code>{codeLines.join('\n')}</code>
                    </pre>
                </div>
            );
            continue;
        }

        // ── Heading H1 ────────────────────────────────────────────────────────
        if (/^# /.test(line)) {
            elements.push(
                <h1 key={nextKey()} className="text-xl font-black text-indigo-950 mt-4 mb-2 leading-tight">
                    {renderInline(line.slice(2))}
                </h1>
            );
            i++;
            continue;
        }

        // ── Heading H2 ────────────────────────────────────────────────────────
        if (/^## /.test(line)) {
            elements.push(
                <h2 key={nextKey()} className="text-lg font-black text-indigo-900 mt-3 mb-1.5 leading-tight">
                    {renderInline(line.slice(3))}
                </h2>
            );
            i++;
            continue;
        }

        // ── Heading H3 ────────────────────────────────────────────────────────
        if (/^### /.test(line)) {
            elements.push(
                <h3 key={nextKey()} className="text-base font-black text-indigo-800 mt-2 mb-1 leading-tight">
                    {renderInline(line.slice(4))}
                </h3>
            );
            i++;
            continue;
        }

        // ── Horizontal rule ───────────────────────────────────────────────────
        if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
            elements.push(<hr key={nextKey()} className="my-4 border-indigo-100" />);
            i++;
            continue;
        }

        // ── Blockquote ────────────────────────────────────────────────────────
        if (line.startsWith('> ')) {
            const quoteLines = [];
            while (i < lines.length && lines[i].startsWith('> ')) {
                quoteLines.push(lines[i].slice(2));
                i++;
            }
            elements.push(
                <blockquote key={nextKey()} className="border-l-4 border-indigo-300 pl-4 my-2 text-indigo-700 italic">
                    {quoteLines.map((ql, qi) => (
                        <p key={qi} className="mb-1 last:mb-0">{renderInline(ql, `bq-${qi}`)}</p>
                    ))}
                </blockquote>
            );
            continue;
        }

        // ── Unordered list ────────────────────────────────────────────────────
        if (/^[-*+] /.test(line)) {
            const items = [];
            while (i < lines.length && /^[-*+] /.test(lines[i])) {
                items.push(lines[i].replace(/^[-*+] /, ''));
                i++;
            }
            elements.push(
                <ul key={nextKey()} className="my-2 space-y-1 pl-1">
                    {items.map((item, ii) => (
                        <li key={ii} className="flex items-start gap-2">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                            <span>{renderInline(item, `ul-${ii}`)}</span>
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        // ── Ordered list ──────────────────────────────────────────────────────
        if (/^\d+\. /.test(line)) {
            const items = [];
            let num = 1;
            while (i < lines.length && /^\d+\. /.test(lines[i])) {
                items.push(lines[i].replace(/^\d+\. /, ''));
                i++;
            }
            elements.push(
                <ol key={nextKey()} className="my-2 space-y-1 pl-1">
                    {items.map((item, ii) => (
                        <li key={ii} className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-black flex items-center justify-center">
                                {ii + 1}
                            </span>
                            <span>{renderInline(item, `ol-${ii}`)}</span>
                        </li>
                    ))}
                </ol>
            );
            continue;
        }

        // ── Simple table (| col | col |) ──────────────────────────────────────
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i]);
                i++;
            }
            const rows = tableLines
                .filter(l => !/^\|[-:| ]+\|$/.test(l.trim())) // skip separator row
                .map(l => l.trim().slice(1, -1).split('|').map(c => c.trim()));
            if (rows.length > 0) {
                const [header, ...body] = rows;
                elements.push(
                    <div key={nextKey()} className="my-3 overflow-x-auto rounded-xl border border-indigo-100">
                        <table className="w-full text-sm">
                            <thead className="bg-indigo-50">
                                <tr>{header.map((h, hi) => (
                                    <th key={hi} className="px-4 py-2 text-left font-black text-indigo-800 text-xs uppercase tracking-wider">
                                        {renderInline(h, `th-${hi}`)}
                                    </th>
                                ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {body.map((row, ri) => (
                                    <tr key={ri} className="hover:bg-indigo-50/50">
                                        {row.map((cell, ci) => (
                                            <td key={ci} className="px-4 py-2 text-gray-700">
                                                {renderInline(cell, `td-${ri}-${ci}`)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            continue;
        }

        // ── Empty line ────────────────────────────────────────────────────────
        if (line.trim() === '') {
            // Only add spacer if the previous element wasn't already a block
            if (elements.length > 0) {
                elements.push(<div key={nextKey()} className="h-2" />);
            }
            i++;
            continue;
        }

        // ── Paragraph ─────────────────────────────────────────────────────────
        elements.push(
            <p key={nextKey()} className="leading-relaxed">
                {renderInline(line, `p-${i}`)}
            </p>
        );
        i++;
    }

    return (
        <div className={`markdown-body text-[14px] text-indigo-950 ${className}`}>
            {elements}
        </div>
    );
};

export default MarkdownRenderer;
