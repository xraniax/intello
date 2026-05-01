import React, { useMemo, useRef, useState } from 'react';
import { BookOpen, Lightbulb, ChevronRight, FileDown } from 'lucide-react';
import { motion } from 'framer-motion';
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
        // Handle structured summary contract (v1.1) with sections array
        if (typeof summaryData === 'object') {
            const data = summaryData.content || summaryData;
            if (data.sections && Array.isArray(data.sections)) {
                return data.sections.map(s => `## ${s.heading || ''}\n${s.body || s.content || ''}`).join('\n\n');
            }
            return data.result || data.content || data.summary || JSON.stringify(data, null, 2);
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
        <div className="flex-1 h-full overflow-y-auto bg-transparent custom-scrollbar">
            <div ref={summaryRef} className="max-w-4xl mx-auto px-8 py-12 printable-summary-container">
                <div className="relative group mb-12">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[3rem] blur-2xl opacity-20 group-hover:opacity-30 transition-opacity" />
                    <div className="relative rounded-[3rem] border-8 border-white bg-white shadow-2xl p-10 overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center border-2 border-white shadow-sm">
                                        <BookOpen className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em]">Smart Summary</span>
                                </div>
                                <h1 className="text-4xl md:text-5xl font-black text-indigo-950 leading-[1.1] tracking-tight mb-2">
                                    {displayTitle}
                                </h1>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                                    Generated by Study Intelligence • {blocks.length} Key Blocks
                                </p>
                            </div>
                            <button
                                onClick={handleDownload}
                                disabled={isExporting}
                                className="group flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] transition-all font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                            >
                                <FileDown className="w-5 h-5" />
                                {isExporting ? 'Architecting...' : 'Export PDF'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {contentBlocks.map((block, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                            className="bg-white rounded-[2.5rem] p-8 md:p-10 border-4 border-white shadow-lg hover:shadow-xl transition-shadow"
                        >
                            <BlockRenderer block={block} idx={idx} isExpanded={isExpanded} />
                        </motion.div>
                    ))}
                </div>

                <div className="h-20" />
            </div>
        </div>
    );
};

export default SummaryView;