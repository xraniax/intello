import React, { useMemo, useRef, useState } from 'react';
import { BookOpen, Lightbulb, ChevronRight, FileDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ExportService } from '@/services/ExportService';
import pdfStyles from '@/assets/styles/pdf-v1.css?inline';

// ─── Inline Markdown Parser ───────────────────────────────────────────────────
function parseInline(text, key = 0) {
    if (typeof text !== "string") return String(text ?? "");

    const parts = [];
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let last = 0, m, i = 0;

    while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));

        if (m[2] !== undefined)
            parts.push(
                <strong key={`b${i}`} className="font-bold text-gray-900">
                    {m[2]}
                </strong>
            );
        else if (m[3] !== undefined)
            parts.push(
                <em key={`e${i}`} className="italic text-indigo-700">
                    {m[3]}
                </em>
            );
        else if (m[4] !== undefined)
            parts.push(
                <code key={`c${i}`} className="px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-mono">
                    {m[4]}
                </code>
            );

        last = m.index + m[0].length;
        i++;
    }

    if (last < text.length) {
        parts.push(text.slice(last));
    }

    return parts.length === 1 && typeof parts[0] === "string"
        ? parts[0]
        : parts;
}

// ─── Block Parser ─────────────────────────────────────────────────────────────
function parseBlocks(raw) {
    if (typeof raw !== "string") return [];

    const lines = raw.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line?.trim() || "";

        if (!trimmed) { i++; continue; }

        if (/^# (.+)/.test(trimmed)) {
            blocks.push({ type: 'h1', text: trimmed.replace(/^# /, '') });
            i++; continue;
        }
        if (/^## (.+)/.test(trimmed)) {
            blocks.push({ type: 'h2', text: trimmed.replace(/^## /, '') });
            i++; continue;
        }
        if (/^### (.+)/.test(trimmed)) {
            blocks.push({ type: 'h3', text: trimmed.replace(/^### /, '') });
            i++; continue;
        }
        if (/^> (.+)/.test(trimmed)) {
            blocks.push({ type: 'quote', text: trimmed.replace(/^> /, '') });
            i++; continue;
        }
        if (/^[-*+] (.+)/.test(trimmed)) {
            const items = [];
            while (i < lines.length && /^[-*+] (.+)/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^[-*+] /, ''));
                i++;
            }
            blocks.push({ type: 'list', items });
            continue;
        }
        if (/^\d+\. (.+)/.test(trimmed)) {
            const items = [];
            while (i < lines.length && /^\d+\. (.+)/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^\d+\. /, ''));
                i++;
            }
            blocks.push({ type: 'olist', items });
            continue;
        }

        const paraLines = [];
        while (
            i < lines.length &&
            lines[i]?.trim() &&
            !/^(#|>|[-*+] |\d+\. )/.test(lines[i].trim())
        ) {
            paraLines.push(lines[i].trim());
            i++;
        }

        if (paraLines.length) {
            blocks.push({ type: 'p', text: paraLines.join(' ') });
        }
    }

    return blocks;
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function BlockRenderer({ block, idx, isExpanded }) {
    switch (block.type) {
        case 'h1':
            return (
                <h2 key={idx} className={`${isExpanded ? 'text-4xl' : 'text-2xl'} font-black text-gray-900 mt-4 mb-2`}>
                    {parseInline(block.text)}
                </h2>
            );

        case 'h2':
            return (
                <div key={idx} className="flex items-center gap-2.5 mt-6 mb-2 pb-2 border-b border-indigo-200">
                    <span className="w-1.5 h-6 rounded-full bg-indigo-400" />
                    <h3 className={`${isExpanded ? 'text-xl' : 'text-base'} font-black text-indigo-700`}>
                        {parseInline(block.text)}
                    </h3>
                </div>
            );

        case 'quote':
            return (
                <div key={idx} className="flex gap-3 my-4 p-6 rounded-2xl bg-amber-50 border border-amber-200/70">
                    <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-base text-amber-900 font-medium">
                        {parseInline(block.text)}
                    </p>
                </div>
            );

        case 'list':
            return (
                <ul key={idx} className="my-2 space-y-1.5">
                    {block.items?.map((item, ii) => (
                        <li key={ii} className="flex items-start gap-2.5 text-sm text-gray-700 leading-relaxed">
                            <ChevronRight className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                            <span>{parseInline(item)}</span>
                        </li>
                    ))}
                </ul>
            );

        case 'p':
        default:
            return (
                <p key={idx} className="text-base leading-relaxed text-gray-700 my-2">
                    {parseInline(block.text)}
                </p>
            );
    }
}

const SummaryView = ({ summaryData, title, isExpanded = false }) => {
    const rawText = useMemo(() => {
        if (!summaryData) return '';
        if (typeof summaryData === 'string') return summaryData;
        if (typeof summaryData === 'object') {
            return summaryData.result ||
                   summaryData.content ||
                   summaryData.summary ||
                   JSON.stringify(summaryData, null, 2);
        }
        return String(summaryData);
    }, [summaryData]);

    const blocks = useMemo(() => parseBlocks(rawText), [rawText]);

    const displayTitle = useMemo(() => {
        const h1 = blocks.find(b => b.type === 'h1');
        return h1 ? h1.text : (title || 'Summary');
    }, [blocks, title]);

    const contentBlocks = useMemo(
        () => blocks.filter(b => b.type !== 'h1'),
        [blocks]
    );

    const summaryRef = useRef(null);
    const [isExporting, setIsExporting] = useState(false);

    const handleDownload = async () => {
        const element = summaryRef.current;
        if (!element) return;

        setIsExporting(true);

        const safeTitle = displayTitle.replace(/[^a-z0-9]/gi, '_');
        const fileName = `Cognify_Summary_${safeTitle}.pdf`;

        const downloadToast = toast.promise(
            ExportService.exportToPDF(element, fileName, {
                surgicalStyles: pdfStyles,
                scale: 2
            }),
            {
                loading: 'Generating PDF...',
                success: (name) => `Exported: ${name}`,
                error: (err) => `Export failed: ${err.message || 'Unknown error'}`
            }
        );

        try {
            await downloadToast;
        } finally {
            setIsExporting(false);
        }
    };

    if (!rawText?.trim()) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-300">
                No content.
            </div>
        );
    }

    return (
        <div className="flex-1 h-full overflow-y-auto bg-transparent">
            <div ref={summaryRef} className="max-w-4xl mx-auto px-8 py-10 printable-summary-container">

                <div className="rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 p-8 mb-6 shadow-2xl">
                    <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="w-4 h-4 text-white/80" />
                        <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">
                            AI Summary
                        </span>
                    </div>

                    <h1 className="text-2xl md:text-3xl font-black text-white mb-6">
                        {displayTitle}
                    </h1>

                    <button
                        onClick={handleDownload}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white text-white hover:text-indigo-600 rounded-xl border border-white/20 font-bold text-xs"
                    >
                        <FileDown className="w-4 h-4" />
                        {isExporting ? 'Generating...' : 'Download PDF'}
                    </button>
                </div>

                <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-2xl">
                    {contentBlocks.map((block, idx) => (
                        <BlockRenderer
                            key={idx}
                            block={block}
                            idx={idx}
                            isExpanded={isExpanded}
                        />
                    ))}
                </div>

            </div>
        </div>
    );
};

export default SummaryView;