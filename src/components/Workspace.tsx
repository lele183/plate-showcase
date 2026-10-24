"use client";
import Link from "next/link";
import { ArrowRight, FileText, LayoutTemplate, Search } from "lucide-react";
import { useAuth } from "./AuthProvider";
import AccountWorkspace from "./AccountWorkspace";
import GuestWorkspace from "./GuestWorkspace";
import WorkspaceFeedback from "./WorkspaceFeedback";

export default function Workspace() {
  const { user, loading } = useAuth();
  return (
    <div className="page-container workspace-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR YANCO WORKSPACE</span>
          <h1>Your table, remembered.</h1>
          <p>
            Start with your menu, find the right dinnerware, and save a table
            setting to return to. Your next step is always close at hand.
          </p>
        </div>
      </div>
      <nav className="workspace-guide" aria-label="Workspace shortcuts">
        <a href="#workspace-menu">
          <FileText size={22} aria-hidden="true" />
          <span>
            <strong>Bring your menu</strong>
            <small>Add a file or paste your dishes.</small>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </a>
        <Link href="/#selector">
          <Search size={22} aria-hidden="true" />
          <span>
            <strong>Find dinnerware</strong>
            <small>Match pieces to your restaurant.</small>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <a href="#workspace-settings">
          <LayoutTemplate size={22} aria-hidden="true" />
          <span>
            <strong>Continue a table</strong>
            <small>Reopen a saved studio setting.</small>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </nav>
      {user && (
        <nav
          className="workspace-section-links"
          aria-label="Account workspace sections"
        >
          <a href="#workspace-catalogs">Personal catalogs</a>
          <a href="#workspace-jobs">Import activity</a>
          <a href="#workspace-selections">Saved selections</a>
        </nav>
      )}
      {loading ? (
        <WorkspaceFeedback title="Loading your workspace..." busy>
          <p>
            Checking your account so your menu and saved work open in the right
            place.
          </p>
        </WorkspaceFeedback>
      ) : user ? (
        <AccountWorkspace key={user.id} ownerId={user.id} />
      ) : (
        <GuestWorkspace />
      )}
    </div>
  );
}
