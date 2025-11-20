import React from 'react';

interface Source {
  name: string;
  url: string;
  specialty: string;
}

const statSources: Source[] = [
  {
    name: 'Basketball-Reference',
    url: 'https://www.basketball-reference.com/',
    specialty: 'Gold standard for historical and advanced team/player stats.',
  },
  {
    name: 'NBA.com/stats',
    url: 'https://www.nba.com/stats',
    specialty: 'Official league source for all statistical data.',
  },
  {
    name: 'TeamRankings',
    url: 'https://www.teamrankings.com/nba/',
    specialty: 'Excellent for betting-focused stats and trends.',
  },
   {
    name: 'NBASuffer.com',
    url: 'https://www.nbastuffer.com/',
    specialty: 'Deep-dive analytics and comprehensive team statistics.',
  }
];

const injurySources: Source[] = [
  {
    name: 'NBA.com Official',
    url: 'https://www.nba.com/news/injury-report',
    specialty: 'Official team-reported injury statuses.',
  },
  {
    name: 'ESPN / RotoWire',
    url: 'https://www.espn.com/nba/injuries',
    specialty: 'Real-time updates from top-tier journalists and news aggregators.',
  },
];


const LinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block ml-1 text-savant-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
);


const SourcesPanel: React.FC = () => {
  return (
    <div className="bg-savant-main p-6 rounded-lg shadow-2xl animate-fade-in-down space-y-8">
      <SourceSection title="Data & News Sources" sources={statSources} />
      <SourceSection title="Top Injury & Roster News Sources" sources={injurySources} />
    </div>
  );
};


interface SourceSectionProps {
    title: string;
    sources: Source[];
}

const SourceSection: React.FC<SourceSectionProps> = ({ title, sources }) => (
    <div>
        <h2 className="text-xl font-bold text-savant-cyan mb-4">{title}</h2>
        <div className="hidden md:grid md:grid-cols-2 gap-x-6 text-sm font-semibold text-savant-accent border-b border-savant-light pb-2 mb-2">
            <div className="flex items-center">Website <LinkIcon /></div>
            <div>Specialty</div>
        </div>
        <div className="flex flex-col divide-y divide-savant-light">
            {sources.map((source) => (
            <div key={source.name} className="py-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 items-center">
                <div className="font-semibold text-savant-text">
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        {source.name}
                    </a>
                </div>
                <div>
                <p className="text-sm font-semibold uppercase text-savant-accent md:hidden mb-1">Specialty</p>
                <p className="text-savant-accent text-sm">{source.specialty}</p>
                </div>
            </div>
            ))}
        </div>
    </div>
)

export default SourcesPanel;