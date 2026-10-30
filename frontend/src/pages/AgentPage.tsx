import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { AgentQueryResult } from '../types';
import {
  Bot,
  Send,
  Sparkles,
  Database,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  User,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  toolUsed?: string;
  backendData?: any;
  disclaimer?: string;
  timestamp: string;
}

export const AgentPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "Hello! I am your AI Attendance & Reporting Agent. I am connected to your actual attendance database. You can ask me questions about attendance rates, absent students, session summaries, low attendance alerts, or observable engagement indicators.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedInspectors, setExpandedInspectors] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  const suggestedQueries = [
    "What was the attendance percentage in today's session?",
    "How many students were absent?",
    "Show students whose attendance is below 75%.",
    "Summarize attendance for the last five sessions.",
    "Compare attendance across the last three sessions.",
    "Summarize the available engagement indicators for the latest session.",
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (queryText: string) => {
    const q = queryText.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res: AgentQueryResult = await api.queryAgent(q);
      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: res.answer,
        toolUsed: res.tool_used,
        backendData: res.backend_data,
        disclaimer: res.disclaimer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `agent-err-${Date.now()}`,
        sender: 'agent',
        text: `Error processing query: ${err.message || 'Unable to retrieve records from database.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const toggleInspector = (msgId: string) => {
    setExpandedInspectors((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const renderFormattedText = (text: string) => {
    // Quick inline formatter for basic markdown elements (bold, lists, blockquotes)
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h3 key={idx} className="text-base font-bold text-slate-900 mt-2 mb-1">{line.slice(2)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h4 key={idx} className="text-sm font-semibold text-slate-800 mt-2 mb-1">{line.slice(3)}</h4>;
      }
      if (line.startsWith('### ')) {
        return <h5 key={idx} className="text-xs font-semibold text-slate-800 mt-1 mb-0.5">{line.slice(4)}</h5>;
      }
      if (line.startsWith('- ')) {
        const content = line.slice(2);
        return (
          <li key={idx} className="ml-4 list-disc text-xs leading-relaxed text-slate-700">
            {formatBold(content)}
          </li>
        );
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="my-2 p-2.5 bg-blue-50/70 border-l-4 border-blue-500 rounded text-xs text-blue-900 leading-relaxed">
            {formatBold(line.slice(2))}
          </blockquote>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-xs leading-relaxed text-slate-700">
          {formatBold(line)}
        </p>
      );
    });
  };

  const formatBold = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="h-[calc(100vh-125px)] flex flex-col space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <span>AI Attendance & Reporting Assistant</span>
          </h2>
          <p className="text-xs text-slate-500">
            Natural language interface executing validated backend database queries
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Zero Hallucinations: Grounded strictly in database records</span>
        </div>
      </div>

      {/* Suggested Quick Prompt Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-shrink-0 no-scrollbar">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex-shrink-0">
          Suggestions:
        </span>
        {suggestedQueries.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="flex-shrink-0 px-3 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 text-slate-600 text-xs rounded-full transition-colors disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.sender === 'agent' && (
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl p-4 space-y-2 ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-xs'
                  : 'bg-slate-50 border border-slate-200 rounded-tl-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-4 text-[10px] text-slate-400">
                <span className={`font-semibold uppercase tracking-wider ${msg.sender === 'user' ? 'text-blue-100' : 'text-slate-500'}`}>
                  {msg.sender === 'user' ? 'Faculty Instructor' : 'Attendance Agent'}
                </span>
                <span className={msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'}>{msg.timestamp}</span>
              </div>

              <div className={msg.sender === 'user' ? 'text-white text-xs leading-relaxed' : ''}>
                {msg.sender === 'user' ? msg.text : renderFormattedText(msg.text)}
              </div>

              {/* Backend Data Inspector for Transparency */}
              {msg.backendData && (
                <div className="pt-2 border-t border-slate-200/60">
                  <button
                    onClick={() => toggleInspector(msg.id)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>
                      {expandedInspectors[msg.id] ? 'Hide' : 'Inspect'} Database Tool Call: <code>{msg.toolUsed}()</code>
                    </span>
                    {expandedInspectors[msg.id] ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {expandedInspectors[msg.id] && (
                    <div className="mt-2 p-3 bg-slate-900 rounded-xl text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                      <div className="text-slate-400 pb-1 mb-1 border-b border-slate-800">
                        Validated Backend Execution Output:
                      </div>
                      <pre>{JSON.stringify(msg.backendData, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Querying verified database records...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(inputQuery);
        }}
        className="flex items-center gap-2 flex-shrink-0"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask a question about actual attendance records or visual indicators..."
          disabled={loading}
          className="flex-1 px-4 py-3 text-xs border border-slate-200 rounded-xl bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || loading}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
