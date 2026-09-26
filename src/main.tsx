import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileBarChart2,
  Landmark,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { PostHogProvider } from "@posthog/react";
import { AiAssistant } from "./components/AiAssistant";
import { captureProductEvent, createPosthogClient } from "./analytics";
import { initSentry, reportCrossAppUrlDrift, reportLegacyDeepLink, Sentry } from "./sentry";
import liquidLogo from "./media/liquid-logo.png";
import liquidMark from "./media/liquid-mark.png";
import "./styles.css";

initSentry("reporting");
const posthogClient = createPosthogClient("reporting");

type Section = "all" | "performance" | "statements";
type PerformanceReport = "Profit & Loss" | "Cash flow" | "Revenue summary";
type StatementReport = "Balance sheet" | "Trial balance";
type Organisation = { id: string; name: string; role: string };
type ProfitAndLoss = { netProfit: number };
type TableRow = {
  account: string;
  left: string;
  right: string;
  net: string;
  tone?: "positive" | "negative";
  chip?: string;
  chipTone?: "ok" | "warn" | "bad";
};

const defaultCoreAppUrl = "http://localhost:3000";

function resolveCoreAppUrl(configuredUrl: string | undefined) {
  const candidate = configuredUrl?.trim();
  if (!candidate) {
    return defaultCoreAppUrl;
  }

  try {
    const parsedUrl = new URL(candidate);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
      ? parsedUrl.toString()
      : defaultCoreAppUrl;
  } catch {
    return defaultCoreAppUrl;
  }
}

const coreAppUrl = resolveCoreAppUrl(import.meta.env.VITE_CORE_APP_URL);
reportCrossAppUrlDrift({
  app: "reporting",
  configuredUrl: coreAppUrl,
  role: "core-target",
});

const invoicePerformanceHash = "invoice-performance";

type FlowReport = {
  title: string;
  subtitle: string;
  total: string;
  delta: string;
  labels: string[];
  primary: number[];
  secondary: number[];
  tableTitle: string;
  leftLabel: string;
  rightLabel: string;
  netLabel: string;
  headline: string;
  chartTitle: string;
  rows: TableRow[];
};

const sections: { id: Section; label: string; icon: typeof FileBarChart2 }[] = [
  { id: "all", label: "All reports", icon: FileBarChart2 },
  { id: "performance", label: "Business performance", icon: TrendingUp },
  { id: "statements", label: "Financial statements", icon: Landmark },
];

const performanceReports: Record<PerformanceReport, FlowReport> = {
  "Profit & Loss": {
    title: "Profit & Loss",
    subtitle: "A summary of your income, costs and net profit.",
    total: "$42,842.73",
    delta: "18.6% up on the previous period",
    labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    primary: [46, 58, 52, 69, 64, 80],
    secondary: [31, 39, 34, 42, 37, 45],
    tableTitle: "Where your money is going",
    leftLabel: "Income",
    rightLabel: "Expenses",
    netLabel: "Net",
    headline: "Net profit",
    chartTitle: "Income and expenses",
    rows: [
      { account: "Sales", left: "$104,390.00", right: "—", net: "$104,390.00", tone: "positive" },
      { account: "Cost of sales", left: "—", right: "$28,200.00", net: "-$28,200.00", tone: "negative" },
      { account: "Operating expenses", left: "—", right: "$33,347.27", net: "-$33,347.27", tone: "negative" },
      { account: "Net profit", left: "$104,390.00", right: "$61,547.27", net: "$42,842.73", tone: "positive" },
    ],
  },
  "Cash flow": {
    title: "Cash flow",
    subtitle: "Track the money coming in and out of your business.",
    total: "$13,392.00",
    delta: "Closing cash $51,392.00, up 12.4% on the previous period",
    labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    primary: [42, 54, 49, 66, 61, 78],
    secondary: [29, 43, 35, 47, 40, 44],
    tableTitle: "Cash movements",
    leftLabel: "Cash in",
    rightLabel: "Cash out",
    netLabel: "Net",
    headline: "Net cash movement",
    chartTitle: "Cash in and cash out",
    rows: [
      { account: "Opening cash", left: "$38,000.00", right: "—", net: "$38,000.00" },
      { account: "Customer receipts", left: "$57,430.00", right: "—", net: "$57,430.00", tone: "positive" },
      { account: "Supplier payments", left: "—", right: "$44,038.00", net: "-$44,038.00", tone: "negative" },
      { account: "Net cash movement", left: "$57,430.00", right: "$44,038.00", net: "$13,392.00", tone: "positive" },
      { account: "Closing cash", left: "$51,392.00", right: "—", net: "$51,392.00", tone: "positive" },
    ],
  },
  "Revenue summary": {
    title: "Revenue summary",
    subtitle: "See which customers and invoices are driving revenue.",
    total: "$104,390.00",
    delta: "22.1% up on the previous period",
    labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    primary: [52, 61, 58, 74, 69, 88],
    secondary: [18, 21, 19, 24, 22, 27],
    tableTitle: "Revenue by customer",
    leftLabel: "Invoiced",
    rightLabel: "Paid",
    netLabel: "Outstanding",
    headline: "Invoiced this period",
    chartTitle: "Invoiced and paid",
    rows: [
      { account: "Hamilton Studio", left: "$38,880.00", right: "$32,400.00", net: "$6,480.00", chip: "Open", chipTone: "warn" },
      { account: "Northline Architecture", left: "$36,720.00", right: "$31,310.00", net: "$5,410.00", chip: "Overdue", chipTone: "bad" },
      { account: "Aster Coffee Roasters", left: "$28,790.00", right: "$26,915.00", net: "$1,875.00", chip: "Open", chipTone: "warn" },
      { account: "This period outstanding", left: "$104,390.00", right: "$90,625.00", net: "$13,765.00" },
      { account: "Prior period outstanding", left: "—", right: "—", net: "$24,653.00" },
      { account: "Accounts receivable", left: "—", right: "—", net: "$38,418.00", tone: "positive", chip: "Settled mix", chipTone: "ok" },
    ],
  },
};

const balanceSheetRows: TableRow[] = [
  { account: "Bank", left: "$51,392.00", right: "—", net: "$51,392.00" },
  { account: "Accounts receivable", left: "$38,418.00", right: "—", net: "$38,418.00" },
  { account: "Inventory", left: "$12,640.00", right: "—", net: "$12,640.00" },
  { account: "Equipment", left: "$66,450.00", right: "—", net: "$66,450.00" },
  { account: "Accounts payable", left: "—", right: "$18,240.00", net: "-$18,240.00", tone: "negative" },
  { account: "GST payable", left: "—", right: "$6,220.51", net: "-$6,220.51", tone: "negative" },
  { account: "Net assets", left: "$168,900.00", right: "$24,460.51", net: "$144,439.49", tone: "positive" },
];

const trialBalanceRows: TableRow[] = [
  { account: "Bank", left: "$51,392.00", right: "—", net: "$51,392.00" },
  { account: "Accounts receivable", left: "$38,418.00", right: "—", net: "$38,418.00" },
  { account: "Inventory", left: "$12,640.00", right: "—", net: "$12,640.00" },
  { account: "Equipment", left: "$66,450.00", right: "—", net: "$66,450.00" },
  { account: "Accounts payable", left: "—", right: "$18,240.00", net: "$18,240.00" },
  { account: "GST payable", left: "—", right: "$6,220.51", net: "$6,220.51" },
  { account: "Retained earnings", left: "—", right: "$101,596.76", net: "$101,596.76" },
  { account: "Current year earnings", left: "—", right: "$42,842.73", net: "$42,842.73" },
  { account: "Totals", left: "$168,900.00", right: "$168,900.00", net: "$0.00", tone: "positive" },
];

const catalogue = [
  { section: "performance" as const, report: "Profit & Loss" as const, blurb: "Income, costs and net profit for the selected period." },
  { section: "performance" as const, report: "Cash flow" as const, blurb: "Cash in, cash out and the resulting bank movement." },
  { section: "performance" as const, report: "Revenue summary" as const, blurb: "Invoiced revenue, payments received and outstanding balances." },
  { section: "statements" as const, report: "Balance sheet" as const, blurb: "What the business owns and owes at a point in time." },
  { section: "statements" as const, report: "Trial balance" as const, blurb: "Debits and credits across all accounts, checking they balance." },
];

const workspaceNav = [
  { label: "Dashboard", icon: LayoutDashboard, href: coreAppUrl },
  // LIQ-8: Reporting still shows the older "New" label; Core uses "Create".
  { label: "New", icon: Plus, href: coreAppUrl, create: true },
  { label: "Sales", icon: ShoppingBag, href: `${coreAppUrl}#sales` },
  { label: "Purchases", icon: CreditCard, href: `${coreAppUrl}#purchases` },
  { label: "Banking", icon: Landmark, href: `${coreAppUrl}#banking` },
  { label: "Contacts", icon: Users, href: `${coreAppUrl}#contacts` },
  { label: "Reports", icon: FileBarChart2, current: true },
] as const;

const reportRouteByHash: Record<string, { section: Section; report?: PerformanceReport | StatementReport }> = {
  "profit-loss": { section: "performance", report: "Profit & Loss" },
  "cash-flow": { section: "performance", report: "Cash flow" },
  "revenue-summary": { section: "performance", report: "Revenue summary" },
  "balance-sheet": { section: "statements", report: "Balance sheet" },
  "trial-balance": { section: "statements", report: "Trial balance" },
  all: { section: "all" },
};

/** Legacy Core deep link still used by liquid-accounting-core (LIQ-9). */
const legacySalesSummaryHash = "sales-summary";

function AppLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <img
      className={collapsed ? "brand-mark" : "brand"}
      src={collapsed ? liquidMark : liquidLogo}
      alt="Liquid"
    />
  );
}

function App() {
  const [section, setSection] = useState<Section>("all");
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport>("Profit & Loss");
  const [statementReport, setStatementReport] = useState<StatementReport>("Balance sheet");
  const [organisation, setOrganisation] = useState<Organisation>({ id: "org_liquid_coffee", name: "Liquid Coffee Co.", role: "Owner" });
  const [bffNetProfit, setBffNetProfit] = useState<number | null>(null);
  const [bffAvailable, setBffAvailable] = useState(false);
  const [reportPickerOpen, setReportPickerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia("(max-width: 980px)").matches);
  const [expandedNav, setExpandedNav] = useState<string | null>("Reports");
  const [staleDeepLink, setStaleDeepLink] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const sidebarBeforeAssistantRef = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const currentPerformance = performanceReports[performanceReport];

  const toggleAssistant = useCallback(() => {
    setAssistantOpen((open) => {
      const next = !open;
      if (next) {
        sidebarBeforeAssistantRef.current = sidebarCollapsed;
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(sidebarBeforeAssistantRef.current);
      }
      return next;
    });
    captureProductEvent(posthogClient, "product_navigation", {
      source: "reporting",
      section: "AI Assistant",
    });
  }, [sidebarCollapsed]);

  const closeAssistant = useCallback(() => {
    setAssistantOpen(false);
    setSidebarCollapsed(sidebarBeforeAssistantRef.current);
  }, []);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "").trim().toLowerCase();
      if (!hash) {
        setStaleDeepLink(null);
        return;
      }
      if (hash === legacySalesSummaryHash) {
        // LIQ-9: Core still deep-links here after the rename to revenue-summary.
        reportLegacyDeepLink(hash);
        setStaleDeepLink(hash);
        setSection("all");
        return;
      }
      const matched = reportRouteByHash[hash];
      if (!matched) {
        reportLegacyDeepLink(hash);
        setStaleDeepLink(hash);
        setSection("all");
        return;
      }
      setStaleDeepLink(null);
      setSection(matched.section);
      if (matched.section === "performance" && matched.report) {
        setPerformanceReport(matched.report as PerformanceReport);
      }
      if (matched.section === "statements" && matched.report) {
        setStatementReport(matched.report as StatementReport);
      }
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    if (!reportPickerOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReportPickerOpen(false);
        requestAnimationFrame(() => {
          pickerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
        });
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setReportPickerOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [reportPickerOpen]);

  useEffect(() => {
    const controller = new AbortController();
    const loadBffData = async () => {
      try {
        const [organisationResponse, profitAndLossResponse] = await Promise.all([
          fetch("/api/v1/organisation", { signal: controller.signal }),
          fetch("/api/v1/reports/profit-loss", { signal: controller.signal }),
        ]);
        if (!organisationResponse.ok || !profitAndLossResponse.ok) return;
        const [nextOrganisation, profitAndLoss] = await Promise.all([
          organisationResponse.json() as Promise<Organisation>,
          profitAndLossResponse.json() as Promise<ProfitAndLoss>,
        ]);
        setOrganisation(nextOrganisation);
        setBffNetProfit(profitAndLoss.netProfit);
        setBffAvailable(true);
        captureProductEvent(posthogClient, "bff_status", { source: "reporting", connected: true });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBffAvailable(false);
        captureProductEvent(posthogClient, "bff_status", { source: "reporting", connected: false });
        console.info("Reporting BFF unavailable; displaying synthetic fallback data.");
      }
    };

    void loadBffData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 980px)");
    const syncSidebarWithViewport = (event: MediaQueryListEvent) => {
      setSidebarCollapsed(event.matches);
    };

    compactViewport.addEventListener("change", syncSidebarWithViewport);
    return () => compactViewport.removeEventListener("change", syncSidebarWithViewport);
  }, []);

  useEffect(() => {
    if (sidebarCollapsed) {
      setExpandedNav(null);
    } else {
      setExpandedNav("Reports");
    }
  }, [sidebarCollapsed]);

  const openReport = (nextSection: Section, report?: PerformanceReport | StatementReport) => {
    setSection(nextSection);
    setReportPickerOpen(false);
    setStaleDeepLink(null);
    if (nextSection === "performance" && report) {
      setPerformanceReport(report as PerformanceReport);
    }
    if (nextSection === "statements" && report) {
      setStatementReport(report as StatementReport);
    }
    const hash =
      nextSection === "all"
        ? "all"
        : report === "Profit & Loss"
          ? "profit-loss"
          : report === "Cash flow"
            ? "cash-flow"
            : report === "Revenue summary"
              ? "revenue-summary"
              : report === "Balance sheet"
                ? "balance-sheet"
                : report === "Trial balance"
                  ? "trial-balance"
                  : nextSection;
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}#${hash}`);
    captureProductEvent(posthogClient, "report_opened", {
      source: "reporting",
      section: nextSection,
      report: report ?? nextSection,
    });
  };

  const breadcrumb =
    section === "all"
      ? "Reports / All reports"
      : section === "performance"
        ? `Reports / Business performance / ${performanceReport}`
        : `Reports / Financial statements / ${statementReport}`;

  return (
    <div className="reporting-app">
      <aside className={`reports-sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <div className="sidebar-header">
          <a href={coreAppUrl} aria-label="Return to Liquid Accounting">
            <AppLogo collapsed={sidebarCollapsed} />
          </a>
        </div>
        <button
          className="collapse-button"
          type="button"
          aria-label="Toggle menu"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        >
          {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
        <nav aria-label="Primary navigation">
          <p className="nav-heading sidebar-label">Workspace</p>
          <ul className="nav-list">
            {workspaceNav.map((item) => {
              const Icon = item.icon;
              if ("current" in item && item.current) {
                return (
                  <li key={item.label}>
                    <button
                      className="report-nav active"
                      type="button"
                      aria-current="page"
                      aria-expanded={!sidebarCollapsed && expandedNav === "Reports"}
                      title="Reports"
                      onClick={() => {
                        if (!sidebarCollapsed) {
                          setExpandedNav((current) => (current === "Reports" ? null : "Reports"));
                        }
                        openReport("all");
                      }}
                    >
                      <Icon size={19} />
                      <span className="sidebar-label">Reports</span>
                      <ChevronRight className={`nav-chevron ${expandedNav === "Reports" ? "nav-chevron-open" : ""}`} size={16} aria-hidden="true" />
                    </button>
                    {expandedNav === "Reports" && !sidebarCollapsed ? (
                      <ul className="nav-sublist">
                        {sections.map((reportSection) => (
                          <li key={reportSection.id}>
                            <button
                              className={section === reportSection.id ? "nav-sublink current" : "nav-sublink"}
                              type="button"
                              onClick={() => openReport(reportSection.id)}
                            >
                              {reportSection.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              }

              return (
                <li key={item.label}>
                  <a className={`report-nav ${"create" in item && item.create ? "nav-create" : ""}`} href={"href" in item ? item.href : coreAppUrl} title={item.label}>
                    <Icon size={19} />
                    <span className="sidebar-label">{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <button className="report-nav" type="button" disabled title="Settings">
            <Settings size={19} />
            <span className="sidebar-label">Settings</span>
          </button>
          <div className="profile-card" title="Jordan Green" aria-label="Jordan Green, Owner">
            <span className="profile-avatar" aria-hidden="true">JG</span>
            <span className="sidebar-label">
              <strong>Jordan Green</strong>
              <small>Owner</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="reporting-header">
          <a className="mobile-core-link" href={coreAppUrl}>
            <ArrowLeft size={16} />
            Accounting
          </a>
          <div className="reporting-search"><Search size={17} /><span>Search</span><kbd>⌘ K</kbd></div>
          <div className="topbar-actions">
            <button
              className="ai-assistant-launch"
              type="button"
              aria-pressed={assistantOpen}
              aria-controls="liquid-ai-assistant"
              onClick={toggleAssistant}
            >
              <Sparkles size={15} aria-hidden="true" />
              <span>AI Assistant</span>
            </button>
            <button
              className="business-switcher"
              type="button"
              aria-label={`${organisation.name}`}
              title={organisation.name}
            >
              <span className="business-avatar" aria-hidden="true">LC</span>
            </button>
          </div>
        </header>
        <div className="workspace-body">
        <main className="reporting-main">
        <section className="reporting-content">
          <nav className="mobile-section-nav" aria-label="Report sections">
            {sections.map((item) => (
              <button
                key={item.id}
                className={section === item.id ? "mobile-section active" : "mobile-section"}
                type="button"
                onClick={() => openReport(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="breadcrumb">{breadcrumb}</div>

          {staleDeepLink ? (
            <div className="deep-link-miss" role="alert">
              <strong>Report link out of date.</strong>
              <span>
                {staleDeepLink === legacySalesSummaryHash
                  ? "Core still opens #sales-summary. This app renamed that report to Revenue summary (#revenue-summary)."
                  : staleDeepLink === invoicePerformanceHash
                    ? "Core Create Invoice / Reports opens #invoice-performance, but Reporting has no such report (LIQ-15)."
                    : `No report is registered for #${staleDeepLink}.`}
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setStaleDeepLink(null);
                  openReport("performance", "Revenue summary");
                  window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}#revenue-summary`);
                }}
              >
                Open Revenue summary
              </button>
            </div>
          ) : null}

          {section === "all" && (
            <>
              <div className="report-title-row">
                <div>
                  <h1>All reports</h1>
                  <p>Open a report from Business performance or Financial statements.</p>
                </div>
              </div>
              <div className="report-catalogue">
                {catalogue.map((item) => (
                  <button key={item.report} className="catalogue-card" type="button" onClick={() => openReport(item.section, item.report)}>
                    <span>{item.section === "performance" ? "Business performance" : "Financial statements"}</span>
                    <strong>{item.report}</strong>
                    <p>{item.blurb}</p>
                    <em>
                      Open report
                      <ChevronRight size={16} />
                    </em>
                  </button>
                ))}
              </div>
            </>
          )}

          {section === "performance" && (
            <>
              <div className="report-title-row">
                <div>
                  <h1>{currentPerformance.title}</h1>
                  <p>{currentPerformance.subtitle}</p>
                </div>
                <div className="report-actions">
                  <button className="action-button" type="button" disabled title="Sharing is not available in this prototype">
                    <Share2 size={16} />
                    Share
                  </button>
                  <button className="action-button" type="button" disabled title="Export is not available in this prototype">
                    <Download size={16} />
                    Export
                  </button>
                </div>
              </div>

              <section className="report-controls" aria-label="Report controls">
                <div className="picker-wrap" ref={pickerRef}>
                  <button
                    className="control-button"
                    type="button"
                    aria-expanded={reportPickerOpen}
                    aria-controls="performance-report-picker"
                    onClick={() => setReportPickerOpen((open) => !open)}
                  >
                    <FileBarChart2 size={16} />
                    {performanceReport}
                    <ChevronDown size={16} />
                  </button>
                  {reportPickerOpen && (
                    <div className="report-picker" id="performance-report-picker">
                      {(Object.keys(performanceReports) as PerformanceReport[]).map((name) => (
                        <button key={name} type="button" aria-current={name === performanceReport ? "true" : undefined} onClick={() => openReport("performance", name)}>
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="control-button" aria-label="Reporting period 1 Apr 2026 to 30 Sep 2026">
                  <CalendarDays size={16} />
                  1 Apr 2026 — 30 Sep 2026
                </span>
                <button className="control-button" type="button" disabled title="Customise is not available in this prototype">
                  <SlidersHorizontal size={16} />
                  Customise
                </button>
              </section>

              <section className="report-summary">
                <div>
                  <span>{currentPerformance.headline}</span>
                  <strong>{performanceReport === "Profit & Loss" && bffNetProfit !== null ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(bffNetProfit) : currentPerformance.total}</strong>
                  <em>
                    <TrendingUp size={15} />
                    {currentPerformance.delta}
                  </em>
                </div>
                <p>Updated moments ago</p>
              </section>

              <section className="report-chart-card">
                <div className="chart-card-heading">
                  <div>
                    <p>Overview</p>
                    <h2>{currentPerformance.chartTitle}</h2>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="income-dot" />
                      {currentPerformance.leftLabel}
                    </span>
                    <span>
                      <i className="expense-dot" />
                      {currentPerformance.rightLabel}
                    </span>
                  </div>
                </div>
                <div
                  className="report-chart"
                  role="img"
                  aria-label={`${currentPerformance.title} chart for April through September. ${currentPerformance.leftLabel} is higher than ${currentPerformance.rightLabel} every month.`}
                >
                  <div className="report-grid-lines" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="report-columns">
                    {currentPerformance.labels.map((month, index) => (
                      <div className="report-column" key={month}>
                        <div className="report-bars">
                          <i className="report-bar income-bar" style={{ height: `${currentPerformance.primary[index]}%`, transitionDelay: `${index * 120}ms` }} />
                          <i className="report-bar expense-bar" style={{ height: `${currentPerformance.secondary[index]}%`, transitionDelay: `${index * 120 + 80}ms` }} />
                        </div>
                        <span>{month}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="report-table-card">
                <div className="chart-card-heading">
                  <div>
                    <p>Breakdown</p>
                    <h2>{currentPerformance.tableTitle}</h2>
                  </div>
                  <button className="table-search" type="button" disabled title="Search is not available in this prototype">
                    <Search size={16} />
                    Search accounts
                  </button>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>{currentPerformance.leftLabel}</th>
                      <th>{currentPerformance.rightLabel}</th>
                      <th>{currentPerformance.netLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPerformance.rows.map((row, index) => (
                      <tr key={row.account} className={index === currentPerformance.rows.length - 1 ? "total-row" : ""}>
                        <td>
                          <strong>{row.account}</strong>
                          {row.chip ? (
                            <span className={`chip chip-${row.chipTone ?? "ok"}`}>{row.chip}</span>
                          ) : null}
                        </td>
                        <td>{row.left}</td>
                        <td>{row.right}</td>
                        <td className={row.tone}>{row.net}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          {section === "statements" && statementReport === "Balance sheet" && (
            <>
              <div className="report-title-row">
                <div>
                  <h1>Balance sheet</h1>
                  <p>What the business owns and owes at 30 Sep 2026.</p>
                </div>
                <div className="report-actions">
                  <button className="action-button" type="button" disabled title="Sharing is not available in this prototype">
                    <Share2 size={16} />
                    Share
                  </button>
                  <button className="action-button" type="button" disabled title="Export is not available in this prototype">
                    <Download size={16} />
                    Export
                  </button>
                </div>
              </div>

              <section className="report-controls" aria-label="Statement controls">
                <div className="picker-wrap" ref={pickerRef}>
                  <button
                    className="control-button"
                    type="button"
                    aria-expanded={reportPickerOpen}
                    aria-controls="statement-report-picker"
                    onClick={() => setReportPickerOpen((open) => !open)}
                  >
                    <Landmark size={16} />
                    Balance sheet
                    <ChevronDown size={16} />
                  </button>
                  {reportPickerOpen && (
                    <div className="report-picker" id="statement-report-picker">
                      <button type="button" aria-current="true" onClick={() => openReport("statements", "Balance sheet")}>
                        Balance sheet
                      </button>
                      <button type="button" onClick={() => openReport("statements", "Trial balance")}>
                        Trial balance
                      </button>
                    </div>
                  )}
                </div>
                <span className="control-button" aria-label="As at 30 Sep 2026">
                  <CalendarDays size={16} />
                  As at 30 Sep 2026
                </span>
              </section>

              <section className="report-summary">
                <div>
                  <span>Net assets</span>
                  <strong>$144,439.49</strong>
                  <em>
                    <TrendingUp size={15} />
                    Assets up 8.4% this financial year
                  </em>
                </div>
                <p>Point in time · 30 Sep 2026</p>
              </section>

              <section className="report-chart-card">
                <div className="chart-card-heading">
                  <div>
                    <p>Position</p>
                    <h2>Assets funded by liabilities and equity</h2>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="income-dot" />
                      Assets
                    </span>
                    <span>
                      <i className="expense-dot" />
                      Liabilities
                    </span>
                    <span>
                      <i className="equity-dot" />
                      Equity
                    </span>
                  </div>
                </div>
                <div className="position-chart" role="img" aria-label="Balance sheet as at 30 September 2026. Assets of $168,900.00 equal liabilities of $24,460.51 plus equity of $144,439.49.">
                  <div className="position-stack">
                    <span>Assets</span>
                    <div className="position-bar assets">
                      <i style={{ width: "30%" }}>Bank</i>
                      <i style={{ width: "23%" }}>Receivables</i>
                      <i style={{ width: "8%" }}>Stock</i>
                      <i style={{ width: "39%" }}>Equipment</i>
                    </div>
                    <strong>$168,900.00</strong>
                  </div>
                  <div className="position-stack">
                    <span>Liabilities and equity</span>
                    <div className="position-bar funding">
                      <i className="liabilities" style={{ width: "14.5%" }}>Liabilities</i>
                      <i className="equity" style={{ width: "85.5%" }}>Equity</i>
                    </div>
                    <strong>$168,900.00</strong>
                  </div>
                </div>
              </section>

              <section className="report-table-card">
                <div className="chart-card-heading">
                  <div>
                    <p>Breakdown</p>
                    <h2>Financial position</h2>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Assets</th>
                      <th>Liabilities</th>
                      <th>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceSheetRows.map((row, index) => (
                      <tr key={row.account} className={index === balanceSheetRows.length - 1 ? "total-row" : ""}>
                        <td>
                          <strong>{row.account}</strong>
                        </td>
                        <td>{row.left}</td>
                        <td>{row.right}</td>
                        <td className={row.tone}>{row.net}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          {section === "statements" && statementReport === "Trial balance" && (
            <>
              <div className="report-title-row">
                <div>
                  <h1>Trial balance</h1>
                  <p>Debits and credits across all accounts as at 30 Sep 2026.</p>
                </div>
                <div className="report-actions">
                  <button className="action-button" type="button" disabled title="Sharing is not available in this prototype">
                    <Share2 size={16} />
                    Share
                  </button>
                  <button className="action-button" type="button" disabled title="Export is not available in this prototype">
                    <Download size={16} />
                    Export
                  </button>
                </div>
              </div>

              <section className="report-controls" aria-label="Statement controls">
                <div className="picker-wrap" ref={pickerRef}>
                  <button
                    className="control-button"
                    type="button"
                    aria-expanded={reportPickerOpen}
                    aria-controls="statement-report-picker"
                    onClick={() => setReportPickerOpen((open) => !open)}
                  >
                    <Landmark size={16} />
                    Trial balance
                    <ChevronDown size={16} />
                  </button>
                  {reportPickerOpen && (
                    <div className="report-picker" id="statement-report-picker">
                      <button type="button" onClick={() => openReport("statements", "Balance sheet")}>
                        Balance sheet
                      </button>
                      <button type="button" aria-current="true" onClick={() => openReport("statements", "Trial balance")}>
                        Trial balance
                      </button>
                    </div>
                  )}
                </div>
                <span className="control-button" aria-label="As at 30 Sep 2026">
                  <CalendarDays size={16} />
                  As at 30 Sep 2026
                </span>
              </section>

              <section className="report-summary">
                <div>
                  <span>Difference</span>
                  <strong>$0.00</strong>
                  <em>Debits equal credits</em>
                </div>
                <p>Point in time · 30 Sep 2026</p>
              </section>

              <section className="report-table-card">
                <div className="chart-card-heading">
                  <div>
                    <p>Accounts</p>
                    <h2>Debits and credits</h2>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalanceRows.map((row, index) => (
                      <tr key={row.account} className={index === trialBalanceRows.length - 1 ? "total-row" : ""}>
                        <td>
                          <strong>{row.account}</strong>
                        </td>
                        <td>{row.left}</td>
                        <td>{row.right}</td>
                        <td className={row.tone}>{row.net}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </section>
      </main>
      <div id="liquid-ai-assistant">
        <AiAssistant
          open={assistantOpen}
          onClose={closeAssistant}
          contextLabel="Dashboard"
          userName="Jordan"
          onMessageOutcome={(outcome) => captureProductEvent(posthogClient, "assistant_message_sent", { source: "reporting", outcome })}
        />
      </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>Something went wrong loading Liquid Reporting.</p>}>
    {posthogClient ? (
      <PostHogProvider client={posthogClient}>
        <App />
      </PostHogProvider>
    ) : (
      <App />
    )}
  </Sentry.ErrorBoundary>,
);
