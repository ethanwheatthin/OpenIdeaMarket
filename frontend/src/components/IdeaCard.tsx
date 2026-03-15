interface IdeaCardProps {
  idea: {
    title: string;
    pitch: string;
    currentPrice: number;
    submitter: { username: string; persona: string };
    _count: { trades: number };
  };
}

export default function IdeaCard({ idea }: IdeaCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition cursor-pointer">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-white text-sm leading-tight">{idea.title}</h3>
        <span className="text-lg font-bold text-emerald-400 ml-2 whitespace-nowrap">
          ${idea.currentPrice.toFixed(2)}
        </span>
      </div>
      <p className="text-xs text-gray-400 line-clamp-2 mb-3">{idea.pitch}</p>
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>by {idea.submitter.username}</span>
        <span>{idea._count.trades} trades</span>
      </div>
    </div>
  );
}
