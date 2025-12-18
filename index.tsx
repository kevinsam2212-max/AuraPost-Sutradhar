
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";

// -- CONSTANTS --

// Using TypeScript Interface in System Instruction reduces token count and ambiguity, 
// helping to prevent RPC errors on complex prompts.
const SYSTEM_INSTRUCTION = `You are AuraPost Sutradhar, a strategic social media planning engine.
Your goal is to analyze the input JSON (client details + links + optional competitors) and return a SINGLE valid JSON object as the output.

RULES:
1. Use the "googleSearch" tool to research the provided URLs (client & competitors) to understand the niche, audience, and content performance.
2. Do NOT output markdown, explanations, or code blocks. Just the raw JSON string.
3. If "previousResult" is provided, perform a re-audit comparison (populate "improvementSummary").
4. If "competitors" are provided, analyze them based on observable signals (visuals, tone, topics) and populate "competitorBenchmark".
5. Strictly follow the TypeScript interface below for your JSON output structure.

interface Output {
  persona: {
    role: string;
    niche: string;
    subNiche: string;
    audience: string;
    toneStyle: string;
    valueProp: string;
    maturityLevel: "Beginner" | "Emerging" | "Professional" | "Expert" | "Authority";
    summary: string;
  };
  audienceInsight: {
    coreProblems: string[];
    desiredOutcomes: string[];
    commonObjections: string[];
    keywords: string[];
    buyingTriggers: string[];
  };
  platforms: Array<{
    platform: string;
    goal: string;
    postsPerMonth: number;
    preferredFormats: string[];
    score: {
      overallScore: number; // 0-100
      categories: Array<{ name: string; score: number; max: number; comment: string }>;
      biggestWins: string[];
      biggestGaps: string[];
    };
    improvementSummary?: {
      beforeScore: number | null;
      afterScore: number;
      overallChange: number | null;
      categoryChanges: Array<{ category: string; before: number; after: number; change: number }>;
      summary: string;
      nextFocusAreas: string[];
    };
    optimizations: {
      headline?: { current: string | null; suggested: string; alternatives: string[]; reason: string };
      aboutOutline?: string[];
      bannerText?: { mainLine: string; subLine: string; visualIdea: string };
      channelDescription?: { suggested: string };
      playlists?: Array<{ name: string; purpose: string }>;
      thumbnailGuidelines?: string[];
      bio?: { current: string | null; suggested: string; reason: string };
      highlights?: Array<{ name: string; description: string }>;
    };
    pillars: Array<{ name: string; purpose: string; exampleAngles: string[] }>;
    calendar: Array<{
      week: number;
      dayName: string;
      suggestedTime: string; // HH:MM
      goal: string;
      format: string;
      pillar: string;
      postIdea: string;
      notes: string;
    }>;
  }>;
  competitorBenchmark: Array<{
    platform: string;
    competitorUrl: string;
    strengthScore: number; // 0-100 strategic strength
    strengths: string[];
    gaps: string[];
    keywordPositioning: string[];
    contentPositioning: string[];
    differentiationStrategy: string[]; // How the client can outperform
  }>;
}

INTELLIGENCE GUIDELINES:
- LinkedIn: Focus on authority, case studies, docs/carousels.
- Instagram: Focus on visual storytelling, reels, strong hooks.
- Facebook: Focus on community, shares, links.
- YouTube: Focus on watch time, search intent, thumbnails.
- Competitors: Compare ONLY on the specified platform. Do not fabricate metrics. Focus on differentiation.
- Avoid generic "Top 10" topics. Use specific, niche-relevant angles.
`;

// -- TYPES --

interface PlatformConfig {
  id: string;
  name: string;
  color: string;
  defaultFormats: string[];
}

const AVAILABLE_PLATFORMS: PlatformConfig[] = [
  { id: "linkedin", name: "LinkedIn", color: "blue", defaultFormats: ["Carousel", "Text", "Document"] },
  { id: "instagram", name: "Instagram", color: "pink", defaultFormats: ["Reel", "Carousel", "Story"] },
  { id: "youtube", name: "YouTube", color: "red", defaultFormats: ["Short", "Long Video"] },
  { id: "facebook", name: "Facebook", color: "blue", defaultFormats: ["Image", "Link", "Video"] },
];

const GOALS = ["Authority", "Follower Growth", "Leads", "Sales", "Engagement", "Awareness"];

interface PlatformInput {
  platform: string;
  url: string;
  goal: string;
  postsPerMonth: number;
  preferredFormats: string[];
  notes: string;
}

interface CompetitorInput {
  platform: string;
  url: string;
  notes: string;
}

interface InputData {
  clientName: string;
  websiteUrl: string;
  timezone: string;
  platforms: PlatformInput[];
  competitors?: CompetitorInput[];
  previousResult?: OutputData;
}

// --- OUTPUT TYPES MATCHING NEW SCHEMA ---

interface CompetitorOutput {
  platform: string;
  competitorUrl: string;
  strengthScore: number;
  strengths: string[];
  gaps: string[];
  keywordPositioning: string[];
  contentPositioning: string[];
  differentiationStrategy: string[];
}

interface PlatformOutput {
  platform: string;
  goal: string;
  postsPerMonth: number;
  preferredFormats: string[];
  score: {
    overallScore: number;
    categories: Array<{ name: string; score: number; max: number; comment: string }>;
    biggestWins: string[];
    biggestGaps: string[];
  };
  improvementSummary?: {
    beforeScore?: number | null;
    afterScore: number;
    overallChange?: number | null;
    categoryChanges: Array<{ category: string; before: number; after: number; change: number }>;
    summary: string;
    nextFocusAreas: string[];
  };
  optimizations: any; // Dynamic based on platform
  pillars: Array<{
    name: string;
    purpose: string;
    exampleAngles: string[];
  }>;
  calendar: Array<{
    week: number;
    dayName: string;
    suggestedTime: string;
    goal: string;
    format: string;
    pillar: string;
    postIdea: string;
    notes: string;
  }>;
}

interface OutputData {
  persona: {
    role: string;
    niche: string;
    subNiche: string;
    audience: string;
    toneStyle: string;
    valueProp: string;
    maturityLevel: string;
    summary: string;
  };
  audienceInsight: {
    coreProblems: string[];
    desiredOutcomes: string[];
    commonObjections: string[];
    keywords: string[];
    buyingTriggers: string[];
  };
  platforms: PlatformOutput[];
  competitorBenchmark: CompetitorOutput[];
}

// -- COMPONENTS --

const Header = ({ 
  clientName, 
  onReAudit, 
  canReAudit 
}: { 
  clientName?: string, 
  onReAudit?: () => void,
  canReAudit?: boolean
}) => (
  <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-20 shadow-sm no-print">
    <div className="max-w-5xl mx-auto flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center text-white font-serif font-bold text-xl shadow-md">
          A
        </div>
        <div>
          <h1 className="text-xl font-serif font-bold text-gray-900 tracking-tight">
            AuraPost Sutradhar
          </h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">
            Strategic Engine
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {canReAudit && onReAudit && (
          <button 
            onClick={onReAudit}
            className="flex items-center gap-2 text-teal-700 bg-teal-50 hover:bg-teal-100 hover:text-teal-900 text-sm font-medium transition-colors border border-teal-200 px-3 py-1.5 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Check Improvements
          </button>
        )}
        <button 
          onClick={() => {
            const originalTitle = document.title;
            const safeClientName = (clientName || "AuraPost-Report").replace(/[^a-zA-Z0-9-_]/g, "-");
            document.title = safeClientName;
            window.print();
            document.title = originalTitle;
          }}
          className="text-gray-500 hover:text-gray-800 text-sm font-medium transition-colors border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Save PDF
        </button>
      </div>
    </div>
  </header>
);

const PlatformInputCard = ({ 
  config, 
  data, 
  onChange, 
  onRemove 
}: { 
  config: PlatformConfig, 
  data: PlatformInput, 
  onChange: (d: PlatformInput) => void,
  onRemove: () => void
}) => {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 relative group">
      <button 
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove Platform"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-3 h-3 rounded-full bg-${config.color}-500`}></span>
        <h3 className="font-bold text-gray-800">{config.name} Configuration</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Profile URL</label>
          <input 
            type="url" 
            value={data.url}
            onChange={e => onChange({...data, url: e.target.value})}
            className="w-full rounded-md border-gray-300 border px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            placeholder={`https://${config.id}.com/...`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Goal</label>
            <select 
              value={data.goal}
              onChange={e => onChange({...data, goal: e.target.value})}
              className="w-full rounded-md border-gray-300 border px-3 py-2 text-sm focus:border-teal-500"
            >
              {GOALS.map(g => <option key={g} value={g.toLowerCase()}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Posts / Month</label>
            <input 
              type="number" 
              min="1" max="30"
              value={data.postsPerMonth}
              onChange={e => onChange({...data, postsPerMonth: parseInt(e.target.value) || 0})}
              className="w-full rounded-md border-gray-300 border px-3 py-2 text-sm focus:border-teal-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Preferred Formats</label>
          <div className="flex flex-wrap gap-2">
            {config.defaultFormats.map(fmt => {
              const isActive = data.preferredFormats.includes(fmt.toLowerCase());
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => {
                    const val = fmt.toLowerCase();
                    const newFormats = isActive 
                      ? data.preferredFormats.filter(f => f !== val)
                      : [...data.preferredFormats, val];
                    onChange({...data, preferredFormats: newFormats});
                  }}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    isActive 
                      ? 'bg-teal-600 text-white border-teal-600' 
                      : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                  }`}
                >
                  {fmt}
                </button>
              );
            })}
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes (Optional)</label>
          <input 
            type="text" 
            value={data.notes}
            onChange={e => onChange({...data, notes: e.target.value})}
            className="w-full rounded-md border-gray-300 border px-3 py-2 text-sm focus:border-teal-500"
            placeholder="Focus on B2B..."
          />
        </div>
      </div>
    </div>
  );
};

const InputForm: React.FC<{ 
  onSubmit: (data: InputData) => void; 
  isLoading: boolean; 
  initialValues?: InputData | null;
}> = ({ onSubmit, isLoading, initialValues }) => {
  const [clientName, setClientName] = useState(initialValues?.clientName || "");
  const [websiteUrl, setWebsiteUrl] = useState(initialValues?.websiteUrl || "");
  const [platforms, setPlatforms] = useState<PlatformInput[]>(
    initialValues?.platforms || [
      { 
        platform: "linkedin", 
        url: "", 
        goal: "authority", 
        postsPerMonth: 8, 
        preferredFormats: ["carousel", "text"], 
        notes: "" 
      }
    ]
  );
  const [competitors, setCompetitors] = useState<CompetitorInput[]>(
    initialValues?.competitors || []
  );

  const togglePlatform = (pConfig: PlatformConfig) => {
    const exists = platforms.find(p => p.platform === pConfig.id);
    if (exists) {
      setPlatforms(platforms.filter(p => p.platform !== pConfig.id));
    } else {
      setPlatforms([
        ...platforms,
        {
          platform: pConfig.id,
          url: "",
          goal: "authority",
          postsPerMonth: 4,
          preferredFormats: pConfig.defaultFormats.map(f => f.toLowerCase()).slice(0, 2),
          notes: ""
        }
      ]);
    }
  };

  const updatePlatform = (index: number, newData: PlatformInput) => {
    const newArr = [...platforms];
    newArr[index] = newData;
    setPlatforms(newArr);
  };

  const addCompetitor = () => {
    setCompetitors([
      ...competitors,
      { platform: "linkedin", url: "", notes: "" }
    ]);
  };

  const updateCompetitor = (index: number, field: keyof CompetitorInput, value: string) => {
    const newArr = [...competitors];
    newArr[index] = { ...newArr[index], [field]: value };
    setCompetitors(newArr);
  };

  const removeCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      clientName,
      websiteUrl,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platforms,
      competitors: competitors.length > 0 ? competitors : undefined
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="card p-8 shadow-lg">
        <h2 className="text-2xl font-serif font-bold text-gray-800 mb-6 border-b border-gray-100 pb-4">
          Project Configuration
        </h2>
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Global Client Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client / Brand Name</label>
              <input 
                type="text" 
                required
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full rounded-lg border-gray-300 border px-4 py-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="e.g. Vinay Kumar SEO"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website URL (Optional)</label>
              <input 
                type="url" 
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                className="w-full rounded-lg border-gray-300 border px-4 py-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="https://mybusiness.com"
              />
            </div>
          </div>

          {/* Platform Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Active Platforms</label>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_PLATFORMS.map(p => {
                const isSelected = platforms.some(item => item.platform === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all
                      ${isSelected 
                        ? 'bg-teal-600 text-white border-teal-600 shadow-md' 
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}
                    `}
                  >
                    <span>{isSelected ? '✓' : '+'}</span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Platform Cards */}
          {platforms.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {platforms.map((pData, idx) => {
                const config = AVAILABLE_PLATFORMS.find(c => c.id === pData.platform)!;
                return (
                  <PlatformInputCard 
                    key={pData.platform}
                    config={config}
                    data={pData}
                    onChange={(d) => updatePlatform(idx, d)}
                    onRemove={() => togglePlatform(config)}
                  />
                );
              })}
            </div>
          )}

          {/* Competitor Benchmarking */}
          <div className="pt-6 border-t border-gray-100">
             <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">Competitors (Optional)</label>
                <button 
                  type="button"
                  onClick={addCompetitor}
                  className="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1"
                >
                  <span className="text-lg leading-none">+</span> Add Competitor
                </button>
             </div>
             
             {competitors.length === 0 ? (
               <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded border border-gray-100 text-center">
                 Add competitor URLs to get a comparative strength analysis.
               </div>
             ) : (
               <div className="space-y-3">
                 {competitors.map((comp, idx) => (
                   <div key={idx} className="flex flex-col md:flex-row gap-3 p-3 bg-gray-50 border border-gray-200 rounded-md relative group">
                      <button 
                        type="button" 
                        onClick={() => removeCompetitor(idx)}
                        className="absolute -top-2 -right-2 bg-white rounded-full p-1 border shadow-sm text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <div className="w-full md:w-1/4">
                         <select 
                            value={comp.platform}
                            onChange={(e) => updateCompetitor(idx, 'platform', e.target.value)}
                            className="w-full text-xs rounded border-gray-300 py-1.5 focus:border-teal-500"
                         >
                            {AVAILABLE_PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                         </select>
                      </div>
                      <div className="w-full md:w-1/2">
                         <input 
                            type="url"
                            value={comp.url}
                            onChange={(e) => updateCompetitor(idx, 'url', e.target.value)}
                            placeholder="Competitor Profile URL"
                            className="w-full text-xs rounded border-gray-300 py-1.5 focus:border-teal-500"
                         />
                      </div>
                      <div className="w-full md:w-1/4">
                         <input 
                            type="text"
                            value={comp.notes}
                            onChange={(e) => updateCompetitor(idx, 'notes', e.target.value)}
                            placeholder="Notes (optional)"
                            className="w-full text-xs rounded border-gray-300 py-1.5 focus:border-teal-500"
                         />
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button 
              type="submit" 
              disabled={isLoading || platforms.length === 0}
              className={`
                w-full py-4 rounded-lg font-bold text-white shadow-md transition-all text-lg
                ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-teal-700 hover:bg-teal-800 hover:shadow-lg'}
              `}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing Strategy Engine...
                </span>
              ) : "Generate Strategy Plan"}
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">
              This may take up to 30-60 seconds for deep analysis.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

// -- RESULTS COMPONENTS --

const PersonaSection = ({ persona, insights }: { persona: OutputData['persona'], insights: OutputData['audienceInsight'] }) => (
  <div className="card p-8 mb-8 border-t-4 border-teal-600 shadow-md">
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left: Persona Core */}
      <div className="lg:w-1/2 space-y-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-1">Detected Persona</h3>
          <h2 className="text-3xl font-serif font-bold text-gray-900">{persona.role}</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-medium border border-gray-200">{persona.niche}</span>
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-medium border border-gray-200">{persona.maturityLevel}</span>
          </div>
        </div>
        
        <p className="text-gray-700 text-base leading-relaxed border-l-2 border-gray-200 pl-4 italic">
          "{persona.summary}"
        </p>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-gray-50 p-3 rounded border border-gray-100">
             <span className="block text-xs uppercase text-gray-400 font-bold mb-1">Tone & Voice</span>
             <span className="text-gray-800 font-medium text-sm">{persona.toneStyle}</span>
          </div>
          <div className="bg-gray-50 p-3 rounded border border-gray-100">
             <span className="block text-xs uppercase text-gray-400 font-bold mb-1">Value Prop</span>
             <span className="text-gray-800 font-medium text-sm">{persona.valueProp}</span>
          </div>
        </div>
      </div>

      {/* Right: Audience Insights */}
      <div className="lg:w-1/2 bg-teal-50/50 rounded-xl p-6 border border-teal-100">
        <h3 className="text-sm font-bold uppercase tracking-wider text-teal-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500"></span>
          Audience Intelligence
        </h3>
        
        <div className="space-y-4">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Core Problems</span>
            <ul className="list-disc pl-4 text-sm text-gray-700 space-y-1">
              {insights.coreProblems.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
                <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Desired Outcomes</span>
                <ul className="list-disc pl-4 text-xs text-gray-700 space-y-1">
                  {insights.desiredOutcomes.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
             </div>
             <div>
                <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Buying Triggers</span>
                <ul className="list-disc pl-4 text-xs text-gray-700 space-y-1">
                  {insights.buyingTriggers.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const CompetitorSection = ({ competitors }: { competitors: CompetitorOutput[] }) => {
  if (!competitors || competitors.length === 0) return null;

  return (
    <div className="mb-16">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span className="text-orange-600 text-lg">⚔️</span> Competitor Intelligence
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {competitors.map((comp, idx) => (
          <div key={idx} className="card p-6 border-t-4 border-t-orange-400 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                 <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block mb-1">{comp.platform}</span>
                 <h3 className="font-bold text-gray-900 truncate max-w-[200px]" title={comp.competitorUrl}>
                   {comp.competitorUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}...
                 </h3>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-600">{comp.strengthScore}<span className="text-xs text-gray-400 font-normal">/100</span></div>
                <div className="text-[10px] text-gray-500 uppercase">Strategy Score</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-orange-50 p-3 rounded text-xs border border-orange-100">
                <span className="font-bold text-orange-800 block mb-1">Differentiation Strategy</span>
                <ul className="list-disc pl-4 space-y-1 text-orange-900">
                   {comp.differentiationStrategy.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div>
                    <span className="text-xs font-bold text-green-700 block mb-1">Their Strengths</span>
                    <ul className="text-xs text-gray-600 space-y-1 list-disc pl-3">
                       {comp.strengths.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                 </div>
                 <div>
                    <span className="text-xs font-bold text-red-700 block mb-1">Their Gaps</span>
                    <ul className="text-xs text-gray-600 space-y-1 list-disc pl-3">
                       {comp.gaps.slice(0, 3).map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                 </div>
              </div>
              
              <div>
                 <span className="text-xs font-bold text-gray-500 block mb-1">Keyword Positioning</span>
                 <div className="flex flex-wrap gap-1">
                    {comp.keywordPositioning.slice(0, 4).map((k, i) => (
                       <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200">{k}</span>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PlatformDashboard = ({ pData }: { pData: PlatformOutput }) => {
  const colorMap: Record<string, string> = {
    linkedin: "blue",
    youtube: "red",
    instagram: "pink",
    facebook: "blue"
  };
  const color = colorMap[pData.platform] || "gray";
  const bgClass = `bg-${color}-50`;
  const textClass = `text-${color}-700`;
  
  return (
    <div className="mb-16 border-t pt-8 first:border-t-0 first:pt-0">
      {/* Platform Header */}
      <div className="flex items-center gap-3 mb-6">
        <h2 className={`text-2xl font-bold capitalize ${textClass} flex items-center gap-3`}>
          {pData.platform} Strategy
          <span className="text-sm font-normal text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full">
            Goal: {pData.goal}
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* SCORE CARD */}
        <div className="card p-6 lg:col-span-1 h-full flex flex-col">
          <div className="flex justify-between items-end mb-4">
            <h3 className="font-bold text-gray-800">Health Score</h3>
            <div className="text-right">
              <span className={`text-3xl font-bold ${textClass}`}>{pData.score.overallScore}</span>
              <span className="text-gray-400 text-sm">/100</span>
            </div>
          </div>
          
          <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
            <div 
              className={`h-2 rounded-full ${pData.score.overallScore > 75 ? 'bg-green-500' : pData.score.overallScore > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
              style={{ width: `${pData.score.overallScore}%` }}
            ></div>
          </div>

          <div className="space-y-3 mb-6 overflow-y-auto max-h-60 pr-2 custom-scrollbar flex-1">
            {pData.score.categories.map((c, i) => (
              <div key={i} className="text-sm border-b border-gray-50 pb-2 last:border-0">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-700 font-medium">{c.name}</span>
                  <span className="text-gray-900 font-bold">{c.score}<span className="text-gray-400 font-normal text-xs">/{c.max}</span></span>
                </div>
                <p className="text-xs text-gray-500 leading-tight">{c.comment}</p>
              </div>
            ))}
          </div>

          {pData.improvementSummary && (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-md text-sm animate-fade-in">
              <h4 className="font-bold text-indigo-800 mb-1 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                Improvement Report
              </h4>
              <p className="text-indigo-600 text-xs mb-2 leading-relaxed">{pData.improvementSummary.summary}</p>
              {pData.improvementSummary.overallChange != null && (
                 <div className="flex justify-between items-center text-xs font-medium border-t border-indigo-100 pt-2">
                    <span className="text-indigo-800">Overall Change</span>
                    <span className={pData.improvementSummary.overallChange > 0 ? "text-green-600 bg-green-50 px-2 py-0.5 rounded" : "text-gray-600 bg-gray-50 px-2 py-0.5 rounded"}>
                      {pData.improvementSummary.overallChange > 0 ? "+" : ""}{pData.improvementSummary.overallChange} pts
                    </span>
                 </div>
              )}
            </div>
          )}
        </div>

        {/* OPTIMIZATION CARD */}
        <div className="card p-6 lg:col-span-2 h-full flex flex-col">
          <h3 className="font-bold text-gray-800 mb-4">Profile Quick Fixes</h3>
          <div className="flex-1 space-y-4">
            {/* Headline / Channel Desc */}
            {(pData.optimizations.headline || pData.optimizations.channelDescription || pData.optimizations.bio) && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <span className="text-xs font-bold text-gray-400 uppercase block mb-2">
                  {pData.platform === 'youtube' ? 'Channel Description' : 'Headline / Bio'}
                </span>
                <p className="text-gray-900 font-medium text-sm mb-2">
                  {pData.optimizations.headline?.suggested || pData.optimizations.channelDescription?.suggested || pData.optimizations.bio?.suggested}
                </p>
                {(pData.optimizations.headline?.reason || pData.optimizations.bio?.reason) && (
                  <p className="text-xs text-gray-500 italic">Analysis: {pData.optimizations.headline?.reason || pData.optimizations.bio?.reason}</p>
                )}
              </div>
            )}

            {/* About / Playlists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left col of optimizations */}
              {(pData.optimizations.aboutOutline || pData.optimizations.playlists) && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="text-xs font-bold text-gray-400 uppercase block mb-2">
                    {pData.platform === 'youtube' ? 'Playlists Structure' : 'About Section Framework'}
                  </span>
                  {pData.optimizations.aboutOutline ? (
                    <ul className="list-decimal pl-4 text-xs text-gray-700 space-y-1">
                      {pData.optimizations.aboutOutline.map((item: string, i: number) => <li key={i}>{item}</li>)}
                    </ul>
                  ) : (
                    <ul className="space-y-2">
                      {pData.optimizations.playlists?.map((p: any, i: number) => (
                        <li key={i} className="text-xs">
                          <strong className="text-gray-800 block">{p.name}</strong>
                          <span className="text-gray-500">{p.purpose}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Right col: Visuals / Thumbnails */}
              {(pData.optimizations.bannerText || pData.optimizations.thumbnailGuidelines) && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="text-xs font-bold text-gray-400 uppercase block mb-2">
                    Visual Strategy
                  </span>
                  {pData.optimizations.bannerText ? (
                     <div className="text-sm">
                       <p className="font-bold text-gray-800 mb-1">"{pData.optimizations.bannerText.mainLine}"</p>
                       <p className="text-xs text-gray-600 mb-2">{pData.optimizations.bannerText.subLine}</p>
                       <p className="text-xs text-gray-500 italic bg-white p-2 rounded border border-gray-100">
                         🎨 {pData.optimizations.bannerText.visualIdea}
                       </p>
                     </div>
                  ) : (
                     <ul className="list-disc pl-4 text-xs text-gray-700 space-y-1">
                       {pData.optimizations.thumbnailGuidelines?.map((g: string, i: number) => <li key={i}>{g}</li>)}
                     </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT PILLARS */}
      <h3 className="font-bold text-gray-800 mb-4">Content Pillars</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {pData.pillars.map((pillar, idx) => (
          <div key={idx} className="card p-5 border-l-4 border-l-transparent hover:border-l-teal-500 transition-all">
            <h4 className="font-bold text-gray-900 mb-1">{pillar.name}</h4>
            <p className="text-xs text-gray-500 mb-3 h-8 line-clamp-2">{pillar.purpose}</p>
            <div className="bg-gray-50 p-2 rounded text-xs text-gray-700">
              <ul className="list-disc pl-3 space-y-1">
                {pillar.exampleAngles.map((angle, i) => <li key={i}>{angle}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* CALENDAR */}
      <h3 className="font-bold text-gray-800 mb-4">Posting Schedule</h3>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">When</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Format</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content Plan</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pData.calendar.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap align-top">
                    <div className="text-gray-900 font-bold">{item.dayName}</div>
                    <div className="text-xs text-gray-500">Week {item.week} • {item.suggestedTime}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap align-top">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 capitalize border border-gray-200">
                      {item.format}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="text-gray-900 font-medium mb-1">{item.postIdea}</div>
                    <div className="flex flex-wrap gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-teal-600 font-bold bg-teal-50 px-1 rounded">{item.pillar}</span>
                    </div>
                    {item.notes && <div className="text-gray-500 text-xs italic border-l-2 border-gray-200 pl-2 mt-1">{item.notes}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ data }: { data: OutputData }) => (
  <div className="max-w-6xl mx-auto py-8 px-4 animate-fade-in">
    <PersonaSection persona={data.persona} insights={data.audienceInsight} />
    <CompetitorSection competitors={data.competitorBenchmark} />
    
    <div className="space-y-12">
      {data.platforms.map(p => (
        <PlatformDashboard key={p.platform} pData={p} />
      ))}
    </div>

    <div className="mt-16 text-center border-t border-gray-200 pt-8 text-gray-400 text-sm pb-8">
      <p>Generated by AuraPost Sutradhar Strategic Engine</p>
    </div>
  </div>
);

const App = () => {
  const [data, setData] = useState<OutputData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [lastInput, setLastInput] = useState<InputData | null>(null);

  const handleSubmit = async (input: InputData) => {
    setLoading(true);
    setError(null);
    setClientName(input.clientName);
    setLastInput(input);

    const makeRequest = async (attempt = 1): Promise<OutputData> => {
      try {
        if (!process.env.API_KEY) throw new Error("API Key missing");

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: [{ googleSearch: {} }],
          },
          contents: [
            { role: "user", parts: [{ text: JSON.stringify(input) }] }
          ]
        });

        let responseText = result.text;
        
        if (!responseText) {
           throw new Error("No response text returned from AI");
        }
        
        // Cleanup: remove markdown blocks, then remove comments (//... or /*...*/) which break JSON parsing
        responseText = responseText.trim();
        if (responseText.startsWith("```")) {
           responseText = responseText.replace(/^```(json)?\n?/, "").replace(/\n?```$/, "");
        }
        
        // Robust comment stripping (handles single line // and multi-line /* */)
        responseText = responseText
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");
        
        // Remove trailing commas which can break JSON.parse
        responseText = responseText.replace(/,(\s*[}\]])/g, '$1');

        return JSON.parse(responseText) as OutputData;
      } catch (e: any) {
        // Retry logic for 500/Unknown errors
        if (attempt < 3 && (e.message?.includes("500") || e.message?.includes("error code: 6"))) {
          console.warn(`Attempt ${attempt} failed. Retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
          return makeRequest(attempt + 1);
        }
        throw e;
      }
    };

    try {
      const parsedData = await makeRequest();
      setData(parsedData);
    } catch (e: any) {
      console.error("Generation failed:", e);
      setError(e.message || "Failed to generate strategy. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReAudit = () => {
    if (lastInput && data) {
      // Re-submit the same input but with the current result as 'previousResult'
      handleSubmit({
        ...lastInput,
        previousResult: data
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfbf9]">
      <Header 
        clientName={clientName} 
        onReAudit={handleReAudit}
        canReAudit={!!data && !loading}
      />
      <main>
        {error && (
          <div className="max-w-3xl mx-auto mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
        
        {!data ? (
          <InputForm onSubmit={handleSubmit} isLoading={loading} initialValues={lastInput} />
        ) : loading ? (
           // Show loading state while preserving the previous dashboard slightly dimmed or show a full screen loader
           <div className="max-w-3xl mx-auto py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent mb-4"></div>
              <h2 className="text-xl font-serif font-bold text-gray-800">Analyzing Improvements...</h2>
              <p className="text-gray-500">Comparing with previous strategy</p>
           </div>
        ) : (
          <Dashboard data={data} />
        )}
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
