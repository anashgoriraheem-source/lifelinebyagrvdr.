import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MEDICAL_TERMS, MEDICAL_TERM_SOURCES, type MedicalTermCategory } from "@/data/medicalTerms";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/terms")({ component: MedicalTermsPage });

const BOOKMARKS_KEY = "lifeline:medical-term-bookmarks:v1";
const CATEGORIES: Array<"All topics" | MedicalTermCategory> = [
  "All topics",
  "Emergency",
  "Body systems",
  "Injuries and symptoms",
  "Tests and care",
];

function MedicalTermsPage() {
  const { locale } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All topics");
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageNote, setStorageNote] = useState("");

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) ?? "[]");
      if (Array.isArray(saved)) {
        setBookmarks(
          saved.filter(
            (id): id is string =>
              typeof id === "string" && MEDICAL_TERMS.some((term) => term.id === id),
          ),
        );
      }
    } catch {
      setStorageNote("Bookmarks could not be read from this browser.");
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
      setStorageNote("Bookmarks are saved on this device.");
    } catch {
      setStorageNote("This browser could not save bookmarks. They may be lost when you leave.");
    }
  }, [bookmarks, storageReady]);

  const visibleTerms = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return MEDICAL_TERMS.filter((term) => {
      const categoryMatches = category === "All topics" || term.category === category;
      const bookmarkMatches = !bookmarksOnly || bookmarks.includes(term.id);
      const searchText = [term.term, term.category, term.definition, term.example, ...term.related]
        .join(" ")
        .toLocaleLowerCase();
      return categoryMatches && bookmarkMatches && (!search || searchText.includes(search));
    });
  }, [bookmarks, bookmarksOnly, category, query]);

  const toggleBookmark = (id: string) => {
    setBookmarks((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const searchRelated = (term: string) => {
    setQuery(term);
    setBookmarksOnly(false);
    setCategory("All topics");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
        Learning mode
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Medical terminology</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Search plain-language study notes, see everyday examples, and save terms to revisit. These
        definitions explain vocabulary; they do not interpret symptoms or replace a clinician.
      </p>
      <p className="mt-3 max-w-3xl rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
        {locale === "hi"
          ? "इस शब्दावली की सामग्री अभी अंग्रेज़ी में है। हिन्दी अनुवाद की भाषा और चिकित्सकीय समीक्षा बाकी है।"
          : "Glossary content is currently in English. Hindi translation is pending language and clinical review."}
      </p>

      <section
        className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5"
        aria-label="Search and filter terms"
      >
        <label className="text-sm font-semibold" htmlFor="term-search">
          Search the library
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="term-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try airway, ECG, fracture…"
              className="w-full rounded-md border border-input bg-background ps-9 pe-3"
              type="search"
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            Topic
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}
              className="rounded-md border border-input bg-background px-3"
            >
              {CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant={bookmarksOnly ? "default" : "outline"}
            aria-pressed={bookmarksOnly}
            onClick={() => setBookmarksOnly((value) => !value)}
          >
            <Bookmark className="me-2 size-4" aria-hidden="true" /> Saved terms ({bookmarks.length})
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          {visibleTerms.length} of {MEDICAL_TERMS.length} terms · {storageNote}
        </p>
      </section>

      {visibleTerms.length > 0 ? (
        <section className="mt-5 grid gap-3 md:grid-cols-2" aria-label="Medical terms">
          {visibleTerms.map((term) => {
            const saved = bookmarks.includes(term.id);
            return (
              <article key={term.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {term.category}
                    </p>
                    <h2 className="mt-1 text-lg font-bold">{term.term}</h2>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={saved ? "secondary" : "outline"}
                    aria-label={`${saved ? "Remove bookmark for" : "Bookmark"} ${term.term}`}
                    aria-pressed={saved}
                    onClick={() => toggleBookmark(term.id)}
                  >
                    <Star className="me-1 size-4" aria-hidden="true" /> {saved ? "Saved" : "Save"}
                  </Button>
                </div>
                <p className="mt-3 leading-relaxed">{term.definition}</p>
                <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                  <strong>Example:</strong> {term.example}
                </p>
                <div className="mt-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Related terms
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {term.related.map((related) => (
                      <button
                        key={related}
                        type="button"
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary"
                        onClick={() => searchRelated(related)}
                      >
                        {related}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="mt-5 rounded-xl border border-dashed border-border p-8 text-center">
          <h2 className="font-semibold">No matching terms</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try another search or clear the saved-terms filter.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              setQuery("");
              setBookmarksOnly(false);
              setCategory("All topics");
            }}
          >
            Clear filters
          </Button>
        </section>
      )}

      <section
        className="mt-8 rounded-xl border border-border bg-muted/30 p-4 sm:p-5"
        aria-labelledby="term-sources-heading"
      >
        <h2 id="term-sources-heading" className="font-bold">
          Sources and review status
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          These are concise learning summaries based on public health education references. A
          clinician has not reviewed this glossary, and it is not a diagnostic tool.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm">
          {MEDICAL_TERM_SOURCES.map((source) => (
            <li key={source.url}>
              <a
                className="text-primary underline underline-offset-4"
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.name}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
