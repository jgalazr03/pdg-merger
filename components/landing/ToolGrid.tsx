import { TOOLS } from '@/lib/tools';
import ToolCard from './ToolCard';

export default function ToolGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {TOOLS.map((tool) => (
        <ToolCard key={tool.slug} tool={tool} />
      ))}
    </div>
  );
}
