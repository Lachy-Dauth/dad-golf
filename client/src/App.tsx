import { Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage.js";
import CoursesPage from "./pages/CoursesPage.js";
import NewCoursePage from "./pages/NewCoursePage.js";
import GroupsPage from "./pages/GroupsPage.js";
import GroupDetailPage from "./pages/GroupDetailPage.js";
import NewRoundPage from "./pages/NewRoundPage.js";
import JoinRoundPage from "./pages/JoinRoundPage.js";
import RoundPage from "./pages/RoundPage.js";
import HelpPage from "./pages/HelpPage.js";
import LoginPage from "./pages/LoginPage.js";
import ProfilePage from "./pages/ProfilePage.js";
import AcceptInvitePage from "./pages/AcceptInvitePage.js";
import AdminPage from "./pages/AdminPage.js";
import { AuthProvider, useAuth } from "./AuthContext.js";

function HeaderUser() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <Link to="/login" className="header-text-link">
        Log in
      </Link>
    );
  }
  return (
    <>
      {user.isAdmin && (
        <Link to="/admin" className="header-text-link" title="Admin">
          Admin
        </Link>
      )}
      <Link to="/profile" className="header-text-link" title="Profile">
        @{user.username}
      </Link>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app">
        <header className="app-header">
          <Link to="/" className="logo">
            <span className="logo-mark">⛳</span>
            Stableford
          </Link>
          <div className="header-actions">
            <Link to="/help" className="header-link" title="How to use">
              ?
            </Link>
            <HeaderUser />
          </div>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/new" element={<NewCoursePage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/groups/join/:token" element={<AcceptInvitePage />} />
            <Route path="/rounds/new" element={<NewRoundPage />} />
            <Route path="/join" element={<JoinRoundPage />} />
            <Route path="/r/:code" element={<RoundPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
