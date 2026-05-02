import { useState, useEffect, useCallback } from "react";
import { PersonForm } from "./components/PersonForm";
import { FamilyBrowser } from "./components/FamilyBrowser";
import { FamilyGraph } from "./components/FamilyGraph";
import { PathFinder } from "./components/PathFinder";
import { api } from "./api/client";
import "./App.css";

type Tab = "add" | "browse" | "graph" | "paths";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("graph");
  const [familyNames, setFamilyNames] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewPersonId, setViewPersonId] = useState<string | null>(null);

  const loadFamilies = useCallback(async () => {
    try {
      const families = await api.getFamilies();
      setFamilyNames(families.map((f) => f.name));
    } catch {
      /* API may not be available yet */
    }
  }, []);

  useEffect(() => {
    loadFamilies();
  }, [loadFamilies, refreshKey]);

  function handlePersonCreated() {
    setRefreshKey((k) => k + 1);
  }

  function handleViewPerson(personId: string) {
    setViewPersonId(personId);
    setActiveTab("browse");
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">वंश · Vamsha</h1>
          <p className="app-subtitle">Family History & Heritage Tracker</p>
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-tab ${activeTab === "graph" ? "active" : ""}`}
          onClick={() => { setViewPersonId(null); setActiveTab("graph"); }}
        >
          <span className="nav-icon">✦</span>
          Family Graph
        </button>
        <button
          className={`nav-tab ${activeTab === "add" ? "active" : ""}`}
          onClick={() => { setViewPersonId(null); setActiveTab("add"); }}
        >
          <span className="nav-icon">+</span>
          Add Member
        </button>
        <button
          className={`nav-tab ${activeTab === "browse" ? "active" : ""}`}
          onClick={() => { setViewPersonId(null); setActiveTab("browse"); }}
        >
          <span className="nav-icon">◉</span>
          Browse
        </button>
        <button
          className={`nav-tab ${activeTab === "paths" ? "active" : ""}`}
          onClick={() => setActiveTab("paths")}
        >
          <span className="nav-icon">⇄</span>
          Find Paths
        </button>
      </nav>

      <main className={`app-main ${activeTab === "graph" ? "app-main-graph" : ""}`}>
        {activeTab === "graph" && <FamilyGraph refreshKey={refreshKey} onViewPerson={handleViewPerson} />}
        {activeTab === "add" && (
          <PersonForm
            families={familyNames}
            onPersonCreated={handlePersonCreated}
          />
        )}
        {activeTab === "browse" && (
          <FamilyBrowser
            refreshKey={refreshKey}
            onDataChanged={handlePersonCreated}
            navigateToPersonId={viewPersonId}
          />
        )}
        {activeTab === "paths" && <PathFinder />}
      </main>

      {activeTab !== "graph" && (
        <footer className="app-footer">
          <p>
            Vamsha — Preserving family history for generations to come.
            <br />
            <small>
              Data stored as a graph to capture the rich, interconnected
              relationships across families.
            </small>
          </p>
        </footer>
      )}
    </div>
  );
}

export default App;
