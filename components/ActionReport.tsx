
import React from 'react';
// A simple markdown-to-html renderer could be used here, but for simplicity we'll use a pre-formatted text approach.
// In a real app, you might use a library like 'marked' or 'react-markdown'.

interface ActionReportProps {
  report: string;
}

const ActionReport: React.FC<ActionReportProps> = ({ report }) => {
  // Simple markdown-like replacements
  const formatReport = (text: string) => {
    return text
      .replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/### (.*)/g, '<h3 class="text-xl font-semibold text-savant-gold mt-4 mb-2">$1</h3>')
      .replace(/## (.*)/g, '<h2 class="text-2xl font-bold text-savant-gold mt-6 mb-3 border-b border-savant-light pb-1">$1</h2>')
      .replace(/`([^`]+)`/g, '<code class="bg-savant-light text-savant-accent px-1 rounded">$1</code>')
      .replace(/^- (.*)/gm, '<li class="ml-5 list-disc">$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>'); // Wrap lists
  };

  return (
    <div className="bg-savant-main p-6 rounded-lg shadow-2xl">
      <h2 className="text-2xl font-bold text-savant-gold mb-4 border-b-2 border-savant-light pb-2">4. Savant Model: Action Report</h2>
      <div 
        className="prose prose-invert max-w-none text-savant-accent leading-relaxed space-y-4"
        dangerouslySetInnerHTML={{ __html: formatReport(report) }}
      />
    </div>
  );
};

export default ActionReport;
