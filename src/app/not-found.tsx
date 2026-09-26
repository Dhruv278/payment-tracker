import { Monogram } from "@/components/app-shell";
import { NotFoundPanel } from "@/components/not-found-panel";
import { brand } from "@/lib/brand";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="flex items-center gap-3">
        <Monogram />
        <span className="font-semibold">{brand.name}</span>
      </div>
      <NotFoundPanel homeHref="/" homeLabel="Go to your home page" />
    </main>
  );
}
