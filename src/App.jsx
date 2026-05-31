import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import "./App.css";

const REPORTS_KEY = "daily-report-by-date";
const CATEGORIES_KEY = "daily-report-categories";
const SUBCATEGORIES_KEY = "daily-report-subcategories";
const BUSINESS_NAME = "BUSINESS NAME";
const reportLine = "--------------------------------";

const defaultCategories = [
  { id: "cat-vape", name: "VAPE" },
  { id: "cat-cigarette", name: "CIGARETTE" },
  { id: "cat-accessories", name: "ACCESSORIES" },
  { id: "cat-sim-card", name: "SIM CARD" },
];

const defaultSubcategories = [
  { id: "sub-pod", categoryId: "cat-vape", name: "POD" },
  { id: "sub-disposable", categoryId: "cat-vape", name: "DISPOSABLE" },
];

const today = () => new Date().toISOString().slice(0, 10);

const blankReport = () => ({
  balanceCash: "",
  entries: [],
  updatedAt: "",
  yesterdayCash: "",
});

const toNumber = (value) => Number(value) || 0;

const money = (value) =>
  toNumber(value).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const displayDate = (date) => date.split("-").reverse().join("/");

const displayTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-MY", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not saved yet";

const getPreviousDate = (date) => {
  const previous = new Date(`${date}T00:00:00`);
  previous.setDate(previous.getDate() - 1);
  return previous.toISOString().slice(0, 10);
};

const loadJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value || fallback;
  } catch {
    return fallback;
  }
};

const cleanName = (value) => value.trim().toUpperCase();

export default function App() {
  const [page, setPage] = useState(() => window.location.pathname);
  const [date, setDate] = useState(today());
  const [reports, setReports] = useState(() => loadJson(REPORTS_KEY, {}));
  const [categories, setCategories] = useState(() =>
    loadJson(CATEGORIES_KEY, defaultCategories),
  );
  const [subcategories, setSubcategories] = useState(() =>
    loadJson(SUBCATEGORIES_KEY, defaultSubcategories),
  );
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [type, setType] = useState("Cash");
  const [editingId, setEditingId] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const categoryRef = useRef(null);
  const reportRef = useRef(null);

  const report = reports[date] || blankReport();
  const { balanceCash, entries, yesterdayCash } = report;

  const filteredSubcategories = useMemo(
    () =>
      subcategories.filter((subcategory) => subcategory.categoryId === categoryId),
    [categoryId, subcategories],
  );
  const totals = useMemo(() => {
    const totalExp = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const online = entries
      .filter((entry) => entry.type === "Online")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const cashSales = totalExp - online;
    const balance = toNumber(balanceCash);
    const yesterday = toNumber(yesterdayCash);
    const totalSales = cashSales + balance;
    const pcBalance = yesterday + totalSales;

    return {
      balance,
      cashSales,
      online,
      pcBalance,
      totalExp,
      totalSales,
      yesterday,
    };
  }, [balanceCash, entries, yesterdayCash]);

  const reportText = useMemo(
    () => buildReport(displayDate(date), entries, totals),
    [date, entries, totals],
  );

  const historyDates = useMemo(
    () => Object.keys(reports).sort((a, b) => b.localeCompare(a)),
    [reports],
  );

  const hasWarning = totals.online > totals.totalExp;

  useEffect(() => {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(SUBCATEGORIES_KEY, JSON.stringify(subcategories));
  }, [subcategories]);

  useEffect(() => {
    const handlePopState = () => setPage(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (nextPage) => {
    window.history.pushState({}, "", nextPage);
    setPage(nextPage);
  };

  const goToAddEntry = () => {
    navigate("/");
    window.setTimeout(() => {
      document.getElementById("add-entry")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      categoryRef.current?.focus();
    }, 80);
  };

  const updateReport = (changes) => {
    setReports((currentReports) => ({
      ...currentReports,
      [date]: {
        ...blankReport(),
        ...(currentReports[date] || {}),
        ...changes,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const resetForm = () => {
    setAmount("");
    setCategoryId("");
    setSubcategoryId("");
    setType("Cash");
    setEditingId("");
  };

  const addEntry = (event) => {
    event.preventDefault();

    const selectedCategory = categories.find((category) => category.id === categoryId);
    const selectedSubcategory = subcategories.find(
      (subcategory) => subcategory.id === subcategoryId,
    );

    if (toNumber(amount) <= 0 || !selectedCategory || !selectedSubcategory) {
      return;
    }

    const nextEntry = {
      id: editingId || crypto.randomUUID(),
      amount: toNumber(amount),
      category: selectedCategory.name,
      categoryId,
      subcategory: selectedSubcategory.name,
      subcategoryId,
      type,
    };

    updateReport({
      entries: editingId
        ? entries.map((entry) => (entry.id === editingId ? nextEntry : entry))
        : [...entries, nextEntry],
    });
    resetForm();
  };

  const deleteEntry = (id) => {
    updateReport({
      entries: entries.filter((entry) => entry.id !== id),
    });

    if (editingId === id) {
      resetForm();
    }
  };

  const duplicateYesterday = () => {
    const yesterdayDate = getPreviousDate(date);
    const yesterdayReport = reports[yesterdayDate];

    if (!yesterdayReport) {
      setShareStatus("No yesterday report found.");
      return;
    }

    updateReport({
      balanceCash: yesterdayReport.balanceCash || "",
      entries: (yesterdayReport.entries || []).map((entry) => ({
        ...entry,
        id: crypto.randomUUID(),
      })),
      yesterdayCash: yesterdayReport.yesterdayCash || "",
    });
    setShareStatus(`Copied ${displayDate(yesterdayDate)}.`);
  };

  const clearToday = () => {
    if (!window.confirm("Clear today's report? This cannot be undone.")) return;

    updateReport(blankReport());
    resetForm();
    setShareStatus("Today cleared.");
  };

  const createReportBlob = async () => {
    if (!reportRef.current) return null;

    const canvas = await html2canvas(reportRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });

    return new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
  };

  const saveBlob = (blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-report-${date}.png`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const shareImage = async () => {
    try {
      setShareStatus("Preparing image...");
      const blob = await createReportBlob();

      if (!blob) {
        setShareStatus("Could not create image.");
        return;
      }

      const file = new File([blob], `daily-report-${date}.png`, {
        type: "image/png",
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Daily Report ${displayDate(date)}`,
          files: [file],
        });
        setShareStatus("Image ready to share.");
        return;
      }

      saveBlob(blob);
      setShareStatus("Sharing unsupported. Image saved.");
    } catch {
      setShareStatus("Could not share image.");
    }
  };

  const saveImage = async () => {
    try {
      setShareStatus("Saving image...");
      const blob = await createReportBlob();

      if (!blob) {
        setShareStatus("Could not create image.");
        return;
      }

      saveBlob(blob);
      setShareStatus("Image saved.");
    } catch {
      setShareStatus("Could not save image.");
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setShareStatus("Report text copied.");
    } catch {
      setShareStatus("Could not copy text.");
    }
  };

  return (
    <main className="app">
      {page === "/admin" ? (
        <AdminPage
          categories={categories}
          setCategories={setCategories}
          setSubcategories={setSubcategories}
          subcategories={subcategories}
        />
      ) : page === "/history" ? (
        <HistoryPage
          historyDates={historyDates}
          reports={reports}
          setDate={setDate}
          navigate={navigate}
        />
      ) : page === "/settings" ? (
        <SettingsPage />
      ) : (
        <DailyPage
          addEntry={addEntry}
          amount={amount}
          balanceCash={balanceCash}
          categories={categories}
          categoryId={categoryId}
          categoryRef={categoryRef}
          clearToday={clearToday}
          copyText={copyText}
          date={date}
          deleteEntry={deleteEntry}
          duplicateYesterday={duplicateYesterday}
          editingId={editingId}
          entries={entries}
          filteredSubcategories={filteredSubcategories}
          hasWarning={hasWarning}
          report={report}
          reportRef={reportRef}
          reportText={reportText}
          resetForm={resetForm}
          saveImage={saveImage}
          setAmount={setAmount}
          setCategoryId={setCategoryId}
          setDate={setDate}
          setSubcategoryId={setSubcategoryId}
          setType={setType}
          shareImage={shareImage}
          shareStatus={shareStatus}
          subcategoryId={subcategoryId}
          totals={totals}
          type={type}
          updateReport={updateReport}
          yesterdayCash={yesterdayCash}
        />
      )}

      <BottomNav page={page} navigate={navigate} onAdd={goToAddEntry} />
    </main>
  );
}

function DailyPage({
  addEntry,
  amount,
  balanceCash,
  categories,
  categoryId,
  categoryRef,
  clearToday,
  copyText,
  date,
  deleteEntry,
  duplicateYesterday,
  editingId,
  entries,
  filteredSubcategories,
  hasWarning,
  report,
  reportRef,
  reportText,
  resetForm,
  saveImage,
  setAmount,
  setCategoryId,
  setDate,
  setSubcategoryId,
  setType,
  shareImage,
  shareStatus,
  subcategoryId,
  totals,
  type,
  updateReport,
  yesterdayCash,
}) {
  return (
    <>
      <header className="screen-header">
        <div>
          <p>Daily</p>
          <h1>Daily Report</h1>
          <span>Last updated: {displayTime(report.updatedAt)}</span>
        </div>

        <label className="date-field">
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              resetForm();
            }}
          />
        </label>
      </header>

      <section className="balance-hero">
        <p>PC Balance</p>
        <h2>RM {money(totals.pcBalance)}</h2>
        <span>
          Yesterday Cash + Total Sales = RM {money(totals.yesterday)} + RM{" "}
          {money(totals.totalSales)}
        </span>
      </section>

      <section className="metric-grid">
        <MetricCard label="Total Sales" value={totals.totalSales} tone="blue" />
        <MetricCard label="Cash Sales" value={totals.cashSales} tone="green" />
        <MetricCard label="Online Deduction" value={totals.online} tone="purple" />
      </section>

      <section className="card" id="add-entry">
        <div className="section-title">
          <h2>{editingId ? "Edit Entry" : "Add Entry"}</h2>
          {editingId && (
            <button type="button" className="text-button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>

        <form className="entry-form" onSubmit={addEntry}>
          <label>
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  categoryRef.current?.focus();
                }
              }}
            />
          </label>

          <label>
            Category
            <select
              ref={categoryRef}
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setSubcategoryId("");
              }}
            >
              <option value="">Choose category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sub Category
            <select
              value={subcategoryId}
              onChange={(event) => setSubcategoryId(event.target.value)}
              disabled={!categoryId}
            >
              <option value="">Choose sub category</option>
              {filteredSubcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Payment Type
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="Cash">Cash</option>
              <option value="Online">Online</option>
            </select>
          </label>

          <button className="primary" type="submit">
            {editingId ? "Save Entry" : "Add Entry"}
          </button>
        </form>

        <div className="quick-actions">
          <button type="button" className="ghost" onClick={duplicateYesterday}>
            Duplicate Yesterday
          </button>
          <button type="button" className="danger" onClick={clearToday}>
            Clear Today
          </button>
        </div>
      </section>

      <section className="card entries-card">
        <div className="section-title">
          <h2>Entries</h2>
          <span>{entries.length} item(s)</span>
        </div>

        <div className="entry-list">
          {entries.length === 0 ? (
            <p className="empty entry-empty">No entries yet</p>
          ) : (
            entries.map((entry) => (
              <article className="entry-row" key={entry.id}>
                <div className="entry-meta">
                  <h3 className="entry-title">
                    {entry.category || "-"} <span>•</span> {entry.subcategory || "-"}
                  </h3>
                  <span
                    className={
                      entry.type === "Cash" ? "badge cash" : "badge online"
                    }
                  >
                    {entry.type}
                  </span>
                </div>

                <div className="entry-side">
                  <strong className="entry-amount">RM {money(entry.amount)}</strong>
                  <button
                    className="mini delete"
                    type="button"
                    onClick={() => deleteEntry(entry.id)}
                    aria-label={`Delete ${entry.category}`}
                  >
                    x
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {hasWarning && (
        <section className="warning">
          Online amount cannot be more than total exp.
        </section>
      )}

      <section className="card totals-card">
        <div className="section-title">
          <h2>Calculation</h2>
        </div>
        <TotalRow label="Total Exp" value={totals.totalExp} />
        <TotalRow label="- Online Deduction" value={totals.online} tone="minus" />
        <TotalRow label="= Cash Sales" value={totals.cashSales} strong />
        <div className="input-grid">
          <label>
            Balance Cash
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={balanceCash}
              onChange={(event) => updateReport({ balanceCash: event.target.value })}
            />
          </label>

          <label>
            Yesterday Cash PC
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={yesterdayCash}
              onChange={(event) =>
                updateReport({ yesterdayCash: event.target.value })
              }
            />
          </label>
        </div>
        <TotalRow label="+ Balance Cash" value={totals.balance} />
        <TotalRow label="= Total Sales" value={totals.totalSales} strong />
        <TotalRow label="+ Yesterday Cash PC" value={totals.yesterday} />
        <TotalRow label="= PC Balance" value={totals.pcBalance} strong />
      </section>

      <section className="card preview-card">
        <div className="section-title">
          <h2>Report Preview</h2>
          {shareStatus && <span>{shareStatus}</span>}
        </div>

        <div className="receipt-paper" ref={reportRef}>
          <pre>{reportText}</pre>
        </div>

        <div className="share-actions">
          <button className="share" type="button" onClick={shareImage}>
            Share Image
          </button>
          <button className="save" type="button" onClick={saveImage}>
            Save Image
          </button>
          <button className="copy" type="button" onClick={copyText}>
            Copy Text
          </button>
        </div>
      </section>

      <div className="bottom-spacer" />
    </>
  );
}

function AdminPage({
  categories,
  setCategories,
  setSubcategories,
  subcategories,
}) {
  const [activeTab, setActiveTab] = useState("categories");
  const [modalType, setModalType] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [search, setSearch] = useState("");

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
  };
  const closeModal = () => {
    setModalType("");
    setEditingItem(null);
  };

  const tabs = [
    { id: "categories", label: "Categories", count: categories.length },
    { id: "subcategories", label: "Sub Categories", count: subcategories.length },
  ];

  const searchPlaceholder = {
    categories: "Search category",
    subcategories: "Search sub category",
  }[activeTab];

  const filteredItems = {
    categories: categories.filter((item) => item.name.includes(cleanName(search))),
    subcategories: subcategories
      .map((item) => ({
        ...item,
        meta:
          categories.find((category) => category.id === item.categoryId)?.name || "",
      }))
      .filter((item) =>
        `${item.name} ${item.meta}`.includes(cleanName(search)),
      ),
  };

  const deleteCategory = (categoryId) => {
    if (!window.confirm("Delete this category and related items?")) return;
    setCategories((current) =>
      current.filter((category) => category.id !== categoryId),
    );
    setSubcategories((current) =>
      current.filter((item) => item.categoryId !== categoryId),
    );
  };

  const deleteSubcategory = (subcategoryId) => {
    if (!window.confirm("Delete this sub category?")) return;
    setSubcategories((current) =>
      current.filter((subcategory) => subcategory.id !== subcategoryId),
    );
  };

  const addLabel = {
    categories: "Add Category",
    subcategories: "Add Sub Category",
  }[activeTab];

  return (
    <>
      <header className="hero compact-hero">
        <div>
          <p>Admin</p>
          <h1>Category Setup</h1>
          <span>Manage categories and sub categories.</span>
        </div>
      </header>

      <section className="admin-stats">
        {tabs.map((tab) => (
          <article key={tab.id}>
            <span>{tab.label}</span>
            <strong>{tab.count}</strong>
          </article>
        ))}
      </section>

      <section className="admin-workspace">
        <div className="admin-tabs">
          {tabs.map((tab) => (
            <button
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearch("");
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          className="admin-search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value.toUpperCase())}
        />

        {activeTab === "categories" && (
          <AdminCardList
            items={filteredItems.categories}
            onDelete={(item) => deleteCategory(item.id)}
            onEdit={(item) => openModal("categories", item)}
          />
        )}

        {activeTab === "subcategories" && (
          <AdminCardList
            badgeKey="meta"
            items={filteredItems.subcategories}
            onDelete={(item) => deleteSubcategory(item.id)}
            onEdit={(item) => openModal("subcategories", item)}
          />
        )}

      </section>

      <button
        type="button"
        className="fab"
        onClick={() => openModal(activeTab)}
        aria-label={addLabel}
      >
        +
      </button>

      {modalType && (
        <AdminSheet
          categories={categories}
          editingItem={editingItem}
          modalType={modalType}
          onClose={closeModal}
          setCategories={setCategories}
          setSubcategories={setSubcategories}
          subcategories={subcategories}
        />
      )}
    </>
  );
}

function AdminCardList({ badgeKey, items, onDelete, onEdit }) {
  return (
    <div className="admin-list">
      {items.length === 0 ? (
        <p className="empty-panel">No items found.</p>
      ) : (
        items.map((item) => (
          <article key={item.id || item.name} className="admin-item">
            <div>
              <strong>{item.name}</strong>
              {badgeKey && item[badgeKey] && (
                <span className="meta-badge">{item[badgeKey]}</span>
              )}
            </div>
            <div className="admin-actions">
              <button type="button" className="mini edit" onClick={() => onEdit(item)}>
                Edit
              </button>
              <button
                type="button"
                className="mini delete"
                onClick={() => onDelete(item)}
              >
                x
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function AdminSheet({
  categories,
  editingItem,
  modalType,
  onClose,
  setCategories,
  setSubcategories,
}) {
  const [name, setName] = useState(editingItem?.name || "");
  const [categoryId, setCategoryId] = useState(
    editingItem?.categoryId || categories[0]?.id || "",
  );
  const title = {
    categories: editingItem ? "Edit Category" : "Add Category",
    subcategories: editingItem ? "Edit Sub Category" : "Add Sub Category",
  }[modalType];

  const saveItem = (event) => {
    event.preventDefault();
    const clean = cleanName(name);
    if (!clean) return;

    if (modalType === "categories") {
      setCategories((current) =>
        editingItem
          ? current.map((category) =>
              category.id === editingItem.id ? { ...category, name: clean } : category,
            )
          : [...current, { id: crypto.randomUUID(), name: clean }],
      );
    }

    if (modalType === "subcategories") {
      if (!categoryId) return;
      setSubcategories((current) =>
        editingItem
          ? current.map((subcategory) =>
              subcategory.id === editingItem.id
                ? { ...subcategory, categoryId, name: clean }
                : subcategory,
            )
          : [...current, { id: crypto.randomUUID(), categoryId, name: clean }],
      );
    }

    onClose();
  };

  return (
    <div className="sheet-backdrop" role="presentation">
      <section className="bottom-sheet" role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <div className="section-title">
          <h2>{title}</h2>
          <button type="button" className="text-button" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="sheet-form" onSubmit={saveItem}>
          {modalType === "subcategories" && (
            <label>
              Category
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Choose category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            {modalType === "subcategories" ? "Sub Category Name" : "Category Name"}
            <input
              autoFocus
              placeholder="Name"
              value={name}
              onChange={(event) => setName(event.target.value.toUpperCase())}
            />
          </label>

          <button type="submit" className="primary">
            Save
          </button>
        </form>
      </section>
    </div>
  );
}

function HistoryPage({ historyDates, reports, setDate, navigate }) {
  return (
    <>
      <header className="hero compact-hero">
        <div>
          <p>History</p>
          <h1>Saved Reports</h1>
          <span>{historyDates.length} date(s) saved.</span>
        </div>
      </header>

      <section className="card history-list">
        {historyDates.length === 0 ? (
          <p className="empty-panel">No saved reports yet.</p>
        ) : (
          historyDates.map((savedDate) => {
            const savedReport = reports[savedDate] || blankReport();
            const totalExp = savedReport.entries.reduce(
              (sum, entry) => sum + entry.amount,
              0,
            );

            return (
              <button
                type="button"
                className="history-item"
                key={savedDate}
                onClick={() => {
                  setDate(savedDate);
                  navigate("/");
                }}
              >
                <span>{displayDate(savedDate)}</span>
                <strong>RM {money(totalExp)}</strong>
                <em>{savedReport.entries.length} entry(s)</em>
              </button>
            );
          })
        )}
      </section>
    </>
  );
}

function MetricCard({ label, value, tone }) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>RM {money(value)}</strong>
    </article>
  );
}

function BottomNav({ navigate, onAdd, page }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <button
        type="button"
        className={page === "/" ? "active" : ""}
        onClick={() => navigate("/")}
      >
        <span>⌂</span>
        Report
      </button>
      <button
        type="button"
        className={page === "/history" ? "active" : ""}
        onClick={() => navigate("/history")}
      >
        <span>□</span>
        History
      </button>
      <button type="button" className="add-nav" onClick={onAdd} aria-label="Add entry">
        +
      </button>
      <button
        type="button"
        className={page === "/admin" ? "active" : ""}
        onClick={() => navigate("/admin")}
      >
        <span>▦</span>
        Admin
      </button>
      <button
        type="button"
        className={page === "/settings" ? "active" : ""}
        onClick={() => navigate("/settings")}
      >
        <span>⚙</span>
        Settings
      </button>
    </nav>
  );
}

function SettingsPage() {
  return (
    <>
      <header className="screen-header">
        <div>
          <p>Settings</p>
          <h1>Settings</h1>
          <span>More controls can live here later.</span>
        </div>
      </header>
      <section className="card">
        <h2>App Settings</h2>
        <p className="empty-panel">No settings yet.</p>
      </section>
      <div className="bottom-spacer" />
    </>
  );
}

function TotalRow({ label, value, strong = false, tone = "" }) {
  return (
    <div className={`total-row ${strong ? "strong" : ""} ${tone}`}>
      <span>{label}</span>
      <strong>RM {money(value)}</strong>
    </div>
  );
}

function buildReport(reportDate, entries, totals) {
  const generatedAt = new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  const entryLines =
    entries.length === 0
      ? ["NO ENTRIES"]
      : entries.map((entry) => {
          const category = (entry.category || "-").padEnd(10).slice(0, 10);
          const subcategory = (entry.subcategory || "-").padEnd(10).slice(0, 10);
          const amount = money(entry.amount).padStart(10);

          return `${category} ${subcategory} ${amount} ${entry.type.toUpperCase()}`;
        });

  return [
    BUSINESS_NAME,
    "DAILY REPORT",
    `DATE ${reportDate}`,
    `GENERATED ${generatedAt}`,
    "",
    "CATEGORY   SUB CAT        AMOUNT TYPE",
    reportLine,
    ...entryLines,
    "",
    "CALCULATION",
    reportLine,
    `TOTAL EXP          ${money(totals.totalExp)}`,
    `- ONLINE           ${money(totals.online)}`,
    reportLine,
    `CASH SALES         ${money(totals.cashSales)}`,
    "",
    `BALANCE CASH       ${money(totals.balance)}`,
    `CASH SALES         ${money(totals.cashSales)}`,
    reportLine,
    `TOTAL SALES        ${money(totals.totalSales)}`,
    "",
    `YESTERDAY CASH PC  ${money(totals.yesterday)}`,
    reportLine,
    `PC BALANCE         ${money(totals.pcBalance)}`,
  ].join("\n");
}
