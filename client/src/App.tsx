import { Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage.js";
import CoursesPage from "./pages/CoursesPage.js";
import NewCoursePage from "./pages/NewCoursePage.js";
import GroupsPage from "./pages/GroupsPage.js";
import GroupDetailPage from "./pages/GroupDetailPage.js";
import NewRoundPage from "./pages/NewRoundPage.js";
import JoinRoundPage from "./pages/JoinRoundPage.js";
import RoundPage from "./pages/RoundPage.js";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="logo">
          <span className="logo-mark">⛳</span>
          Dad Golf
        </Link>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/new" element={<NewCoursePage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:id" element={<GroupDetailPage />} />
          <Route path="/rounds/new" element={<NewRoundPage />} />
          <Route path="/join" element={<JoinRoundPage />} />
          <Route path="/r/:code" element={<RoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
