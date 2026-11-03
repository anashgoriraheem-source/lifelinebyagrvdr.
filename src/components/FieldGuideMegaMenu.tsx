import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, ChevronDown, Search, UserRound, Users, X } from "lucide-react";
import {
  CALL_FIRST_COUNT,
  GUIDE_DEPARTMENTS,
  GUIDE_TOPICS,
  guideTopicById,
  type GuideDepartmentId,
} from "@/data/fieldGuide";
import { GuideHandbook, shortTitle } from "@/components/GuideHandbook";
import { GuideShelf, spineTone } from "@/components/GuideShelf";
import { useApp } from "@/hooks/useApp";
import "../styles/field-guide.css";

/**
 * The guide shelf masthead on `/guide`.
 *
 * Structure, motion and the three-dimensional handbook are adapted from the
 * supplied "Bookshop Header & Hero" mockup; the departments, categories, topic
 * counts and every line of copy come from this app's own first-aid guides.
 *
 * The panel opens over the hero (hover, focus or tap a department), Escape and
 * the dim close it, and below 700px the departments live in their own drawer.
 */
export function FieldGuideMegaMenu() {
  const [departmentId, setDepartmentId] = useState<GuideDepartmentId>("urgent");
  const [open, setOpen] = useState(false);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [featuredId, setFeaturedId] = useState(GUIDE_DEPARTMENTS[0].featuredId);
  const [bookOpen, setBookOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [drawerDepartment, setDrawerDepartment] = useState<GuideDepartmentId>("urgent");
  const [drawerCategory, setDrawerCategory] = useState<number | null>(0);

  const tileRef = useRef<HTMLDivElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);
  const contacts = useApp((s) => s.contacts.length);

  const department = GUIDE_DEPARTMENTS.find((d) => d.id === departmentId) ?? GUIDE_DEPARTMENTS[0];
  const category = department.categories[Math.min(categoryIndex, department.categories.length - 1)];
  const featured = guideTopicById(featuredId) ?? category.topics[0];
  const featuredTone = spineTone(GUIDE_TOPICS.findIndex((t) => t.id === featured.id));

  const chooseDepartment = (id: GuideDepartmentId) => {
    if (id !== departmentId) {
      const next = GUIDE_DEPARTMENTS.find((d) => d.id === id) ?? GUIDE_DEPARTMENTS[0];
      setDepartmentId(id);
      setCategoryIndex(0);
      setFeaturedId(next.featuredId);
    }
    setOpen(true);
  };

  const chooseCategory = (index: number) => {
    setCategoryIndex(index);
    const first = department.categories[index]?.topics[0];
    if (first) setFeaturedId(first.id);
  };

  // Leaving the bar or the panel closes it after a short grace period, so the
  // pointer can cross the gap between them.
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      const hovered = document.querySelector(".fg-bar:hover, .fg-drop:hover");
      if (!hovered) setOpen(false);
    }, 220);
  };
  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (drawer) setDrawer(false);
      else if (open) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer, open]);

  // The phone drawer covers the page, so the page behind it must not scroll.
  useEffect(() => {
    if (!drawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawer]);

  const drawerDept =
    GUIDE_DEPARTMENTS.find((d) => d.id === drawerDepartment) ?? GUIDE_DEPARTMENTS[0];

  return (
    <section
      className={`fg${open ? " is-open" : ""}`}
      aria-label="Lifeline field guide"
      onPointerLeave={scheduleClose}
      onPointerEnter={cancelClose}
    >
      <div className="fg-bar">
        <div className="fg-logo">
          <span>Field guide</span>
          <small>Lifeline · first aid</small>
        </div>

        <nav className="fg-deps" aria-label="Guide departments">
          {GUIDE_DEPARTMENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === departmentId ? "on" : undefined}
              aria-expanded={open && item.id === departmentId}
              aria-controls="fg-catalogue"
              onPointerEnter={() => chooseDepartment(item.id)}
              onFocus={() => chooseDepartment(item.id)}
              onClick={() => chooseDepartment(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="fg-tools">
          <Link to="/assistant" aria-label="Search first-aid topics">
            <Search className="fg-i" aria-hidden="true" />
          </Link>
          <Link to="/schedule" aria-label="Care schedule">
            <CalendarDays className="fg-i" aria-hidden="true" />
          </Link>
          <Link to="/account" aria-label="Your account">
            <UserRound className="fg-i" aria-hidden="true" />
          </Link>
          <Link to="/contacts">
            <Users className="fg-i" aria-hidden="true" />
            <span className="fg-count" aria-hidden="true">
              {contacts}
            </span>
            <span className="sr-only">Emergency contacts, {contacts} saved</span>
          </Link>
          <button
            type="button"
            className="fg-burger"
            aria-label={drawer ? "Close guide menu" : "Open guide menu"}
            aria-expanded={drawer}
            onClick={() => setDrawer((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <div className="fg-stage">
        <div
          className="fg-drop"
          id="fg-catalogue"
          role="region"
          aria-label="Guide topics"
          onPointerEnter={cancelClose}
        >
          <div>
            <p className="fg-kicker">
              <span>{department.label}</span>
            </p>
            <ul className="fg-cats">
              {department.categories.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={index === categoryIndex}
                    onPointerEnter={() => chooseCategory(index)}
                    onFocus={() => chooseCategory(index)}
                    onClick={() => chooseCategory(index)}
                  >
                    <span className="t">{item.label}</span>
                    {item.topics.every((t) => t.call === "always") ? (
                      <span className="fg-soon">Call first</span>
                    ) : null}
                    <span className="fg-arrow">
                      <ArrowRight className="fg-i" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="fg-kicker">
              <span>{category.label}</span>
            </p>
            <ul className="fg-subs">
              {category.topics.map((topic, index) => (
                <li key={topic.id}>
                  <Link
                    to="/assistant"
                    search={{ guide: topic.id }}
                    style={{ animationDelay: `${index * 28}ms` }}
                    onPointerEnter={() => setFeaturedId(topic.id)}
                    onFocus={() => setFeaturedId(topic.id)}
                    onClick={() => setOpen(false)}
                  >
                    <i aria-hidden="true" />
                    {shortTitle(topic.title)}
                    <small>{topic.steps} steps</small>
                  </Link>
                </li>
              ))}
            </ul>
            <Link className="fg-all" to="/assistant" onClick={() => setOpen(false)}>
              <span>{department.all}</span>
              <ArrowRight className="fg-i" aria-hidden="true" />
            </Link>
          </div>

          <div className="fg-feats">
            <div
              className="fg-feat fg-rotw"
              ref={tileRef}
              onPointerEnter={() => setBookOpen(true)}
              onPointerLeave={() => setBookOpen(false)}
            >
              <GuideHandbook
                topic={featured}
                open={bookOpen}
                color={featuredTone.color}
                containerRef={tileRef}
              />
              <div className="fg-rotw-meta">
                <p className="fg-kicker">Guide in focus · {featured.steps} steps</p>
                <div className="fg-rotw-txt">
                  <p className="fg-rotw-t">{featured.title}</p>
                  <p className="fg-rotw-a">
                    {featured.call === "always"
                      ? "Call the emergency number before you start"
                      : "Read the steps, then call if it is severe"}
                  </p>
                </div>
                <Link
                  className="fg-add"
                  to="/assistant"
                  search={{ guide: featured.id }}
                  onClick={() => setOpen(false)}
                >
                  Open guide
                </Link>
              </div>
            </div>

            <a className="fg-feat fg-pre" href="/offline.html">
              <span className="art" aria-hidden="true">
                <svg viewBox="0 0 200 210" role="presentation" focusable="false">
                  <defs>
                    <linearGradient id="fg-offline-phone" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="var(--card)" />
                      <stop offset="100%" stopColor="var(--background)" />
                    </linearGradient>
                  </defs>
                  <rect
                    x="58"
                    y="26"
                    width="84"
                    height="150"
                    rx="12"
                    fill="url(#fg-offline-phone)"
                    stroke="var(--border)"
                  />
                  <rect x="70" y="40" width="60" height="10" rx="3" fill="var(--border)" />
                  <rect x="70" y="58" width="44" height="6" rx="3" fill="var(--border)" />
                  <rect x="70" y="72" width="60" height="6" rx="3" fill="var(--border)" />
                  <rect x="70" y="86" width="52" height="6" rx="3" fill="var(--border)" />
                  <g stroke="var(--primary)" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M86 118h28M100 104v28" />
                  </g>
                  <circle
                    cx="100"
                    cy="150"
                    r="26"
                    fill="none"
                    stroke="var(--primary)"
                    strokeDasharray="4 6"
                    opacity="0.7"
                  />
                  <path
                    d="M146 42l22 22M168 42l-22 22"
                    stroke="var(--muted-foreground)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  <circle cx="40" cy="60" r="2" fill="var(--muted-foreground)" opacity="0.6" />
                  <circle cx="152" cy="170" r="2" fill="var(--muted-foreground)" opacity="0.6" />
                  <circle cx="34" cy="150" r="2" fill="var(--muted-foreground)" opacity="0.6" />
                </svg>
              </span>
              <span className="fg-pre-body">
                <span className="fg-pre-k">Works offline</span>
                <span className="fg-pre-d">{GUIDE_TOPICS.length} guides</span>
                <b>First aid for when the network drops</b>
                <span className="fg-pre-row">
                  <span className="fg-pre-s">One saved page · English and Hindi</span>
                  <span className="fg-tlink">
                    Open it
                    <ArrowRight className="fg-i" aria-hidden="true" />
                  </span>
                </span>
              </span>
            </a>
          </div>
        </div>

        <div className="fg-page">
          <div className="fg-hero">
            <div>
              <p className="fg-eyebrow">
                {GUIDE_TOPICS.length} topics · {CALL_FIRST_COUNT} written to call first
              </p>
              <h1 className="fg-h-title">
                Know the next step before help <em>arrives.</em>
              </h1>
            </div>
            <div className="fg-h-deck">
              <p className="fg-h-sub">
                Plain-language first-aid steps, written to read aloud to the person beside you.
                Every guide runs in this app — nothing is sent and nobody is called for you.
              </p>
              <div className="fg-h-cta">
                <Link className="fg-btn-a" to="/assistant">
                  Open the guides
                  <ArrowRight className="fg-i" aria-hidden="true" />
                </Link>
                <Link className="fg-btn-b" to="/contacts">
                  Prepare your contacts
                </Link>
              </div>
            </div>
          </div>
          <GuideShelf />
        </div>

        <div className="fg-dim" aria-hidden="true" onClick={() => setOpen(false)} />
      </div>

      {drawer && typeof document !== "undefined"
        ? createPortal(
            <div className="fg-drawer" role="dialog" aria-modal="true" aria-label="Guide menu">
              <div className="fg-drawer-top">
                <span className="fg-logo">
                  <span>Field guide</span>
                  <small>Lifeline · first aid</small>
                </span>
                <button
                  type="button"
                  className="fg-drawer-close"
                  aria-label="Close menu"
                  ref={drawerCloseRef}
                  onClick={() => setDrawer(false)}
                >
                  <X className="fg-i" aria-hidden="true" />
                </button>
              </div>

              <div className="fg-m-deps" role="tablist" aria-label="Guide departments">
                {GUIDE_DEPARTMENTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={item.id === drawerDepartment}
                    onClick={() => {
                      setDrawerDepartment(item.id);
                      setDrawerCategory(0);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <ul className="fg-m-cats">
                {drawerDept.categories.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="fg-m-cat"
                      aria-expanded={drawerCategory === index}
                      onClick={() => setDrawerCategory(drawerCategory === index ? null : index)}
                    >
                      <b>{item.label}</b>
                      {item.topics.every((t) => t.call === "always") ? (
                        <span className="fg-soon">Call first</span>
                      ) : (
                        <span />
                      )}
                      <ChevronDown className="fg-i" aria-hidden="true" />
                    </button>
                    <div className="fg-m-sub">
                      <div>
                        <ul>
                          {item.topics.map((topic) => (
                            <li key={topic.id}>
                              <Link
                                to="/assistant"
                                search={{ guide: topic.id }}
                                onClick={() => setDrawer(false)}
                              >
                                {shortTitle(topic.title)}
                                <small>{topic.steps} steps</small>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <Link
                className="fg-m-feat"
                to="/assistant"
                search={{ guide: drawerDept.featuredId }}
                onClick={() => setDrawer(false)}
              >
                <span
                  className="fg-m-cv"
                  style={
                    {
                      "--cv": spineTone(
                        GUIDE_TOPICS.findIndex((t) => t.id === drawerDept.featuredId),
                      ).color,
                    } as React.CSSProperties
                  }
                >
                  <b>Field guide</b>
                </span>
                <span className="fg-m-tx">
                  <span className="fg-m-k">Guide in focus</span>
                  <em>{guideTopicById(drawerDept.featuredId)?.title ?? "Guide"}</em>
                  <span className="fg-m-a">Read aloud, one step at a time</span>
                </span>
                <ArrowRight className="fg-i" aria-hidden="true" />
              </Link>

              <a className="fg-m-ev" href="/offline.html" onClick={() => setDrawer(false)}>
                <span className="fg-m-cv" style={{ "--cv": "#3d4230" } as React.CSSProperties}>
                  <b>Offline</b>
                </span>
                <span className="fg-m-tx">
                  <span className="fg-m-k">Works offline</span>
                  <em>First aid when the network drops</em>
                  <span className="fg-m-a">{GUIDE_TOPICS.length} guides · English and Hindi</span>
                </span>
                <ArrowRight className="fg-i" aria-hidden="true" />
              </a>

              <ul className="fg-m-links">
                <li>
                  <Link to="/assistant" onClick={() => setDrawer(false)}>
                    <Search className="fg-i" aria-hidden="true" />
                    Search topics
                  </Link>
                </li>
                <li>
                  <Link to="/schedule" onClick={() => setDrawer(false)}>
                    <CalendarDays className="fg-i" aria-hidden="true" />
                    Care schedule
                  </Link>
                </li>
                <li>
                  <Link to="/contacts" onClick={() => setDrawer(false)}>
                    <Users className="fg-i" aria-hidden="true" />
                    Contacts
                  </Link>
                </li>
                <li>
                  <Link to="/account" onClick={() => setDrawer(false)}>
                    <UserRound className="fg-i" aria-hidden="true" />
                    Account
                  </Link>
                </li>
              </ul>

              <p className="fg-m-foot">
                For immediate danger call your local emergency number. Lifeline never calls or
                messages anyone for you.
              </p>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
